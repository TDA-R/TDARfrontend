import { WebR } from 'webr';

// R script template for Mapper algorithm implementation
const MAPPER_R_SCRIPT = `
# Function to generate noisy circle data
make_noisy_circle <- function(radius, num_points, noise_sd = 0.1) {
  theta <- runif(num_points, 0, 2 * pi)
  x <- radius * cos(theta) + rnorm(num_points, sd = noise_sd)
  y <- radius * sin(theta) + rnorm(num_points, sd = noise_sd)
  data.frame(x = x, y = y)
}

# Generate Data
set.seed(123)
noisy_inner_circle <- make_noisy_circle(radius = 1, num_points = 200)
noisy_outer_circle <- make_noisy_circle(radius = 2, num_points = 200)
data <- rbind(
  data.frame(circle = "inner", noisy_inner_circle),
  data.frame(circle = "outer", noisy_outer_circle)
)

# Simple Mapper Implementation in R
run_simple_mapper <- function(data, interval_count, percent_overlap) {
  # 1. Filter: Projection to x-axis
  filter_values <- data$x
  
  # 2. Cover: Create intervals
  min_val <- min(filter_values)
  max_val <- max(filter_values)
  range_val <- max_val - min_val
  
  interval_length <- range_val / (interval_count - (interval_count - 1) * percent_overlap/100)
  step_size <- interval_length * (1 - percent_overlap/100)
  
  intervals <- list()
  for (i in 0:(interval_count-1)) {
    start <- min_val + i * step_size
    end <- start + interval_length
    intervals[[i+1]] <- list(start=start, end=end, indices=which(filter_values >= start & filter_values <= end))
  }
  
  # 3. Cluster: Clustering within each interval
  nodes <- list()
  node_id_counter <- 0
  
  for (i in 1:length(intervals)) {
    indices <- intervals[[i]]$indices
    if (length(indices) > 0) {
      subset_data <- data[indices, c("x", "y")]
      
      # Use hierarchical clustering
      if (nrow(subset_data) > 2) {
        dist_mat <- dist(subset_data)
        hc <- hclust(dist_mat)
        clusters <- cutree(hc, h = 0.5) 
        
        for (cid in unique(clusters)) {
            node_indices <- indices[clusters == cid]
            node_id_counter <- node_id_counter + 1
            nodes[[node_id_counter]] <- list(
                id = paste0("node_", node_id_counter),
                level = i,
                indices = node_indices,
                size = length(node_indices)
            )
        }
      }
    }
  }
  
  # 4. Graph: Connect nodes if they share data points
  links <- list()
  if (length(nodes) > 1) {
    for (i in 1:(length(nodes)-1)) {
      for (j in (i+1):length(nodes)) {
        if (abs(nodes[[i]]$level - nodes[[j]]$level) <= 1) {
            intersection <- intersect(nodes[[i]]$indices, nodes[[j]]$indices)
            if (length(intersection) > 0) {
                links[[length(links)+1]] <- list(
                    source = nodes[[i]]$id,
                    target = nodes[[j]]$id,
                    weight = length(intersection)
                )
            }
        }
      }
    }
  }
  
  return(list(nodes = nodes, links = links))
}

# Run Mapper
result <- run_simple_mapper(data, interval_count = INTERVAL_PARAM, percent_overlap = OVERLAP_PARAM)

# Convert to JSON
library(jsonlite)
toJSON(result, auto_unbox = TRUE)
`;

export async function runMapperAlgo(webR: WebR, interval: number, overlap: number) {
  if (!webR) throw new Error('WebR not initialized');

  // Inject parameters
  const script = MAPPER_R_SCRIPT
    .replace('INTERVAL_PARAM', interval.toString())
    .replace('OVERLAP_PARAM', overlap.toString());

  console.log('Running R Script...');

  // Evaluate the R code
  const result = await webR.evalR(script);

  // Parse the JSON output
  const jsonString = await result.toString();
  const parsedData = JSON.parse(jsonString);

  // Transform to GraphData format
  const nodes = parsedData.nodes.map((n: any) => ({
    id: n.id,
    group: n.level,
    val: Math.sqrt(n.size) * 2,
    name: n.id,
    desc: `Level ${n.level}, Points: ${n.size}`
  }));

  const links = parsedData.links.map((l: any) => ({
    source: l.source,
    target: l.target,
    value: 1,
    isReverse: false
  }));

  // Add reverse links for bidirectional flow
  const reverseLinks = links.map((l: any) => ({
    source: l.target,
    target: l.source,
    value: 1,
    isReverse: true
  }));

  return {
    nodes,
    links: [...links, ...reverseLinks]
  };
}
