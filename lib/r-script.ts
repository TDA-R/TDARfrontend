import { WebR } from 'webr';

export const MAPPER_R_SCRIPT = (interval: number, overlap: number, clusteringMethod: string) => `
library(jsonlite)

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
# Load Iris dataset
data(iris)
iris_data <- iris[, 1:4]
iris_labels <- iris$Species

# -----------------------------------------------------------------------------
# Simple Mapper Implementation (Self-contained)
# -----------------------------------------------------------------------------
run_simple_mapper <- function(data, labels, interval_count, percent_overlap, clustering_method) {
  # 1. Filter: PCA (First principal component)
    pca <- prcomp(data, scale. = TRUE)
    filter_values <- pca$x[, 1]
  
  # 2. Cover: Create overlapping intervals
    min_val <- min(filter_values)
    max_val <- max(filter_values)
    range_val <- max_val - min_val
    if (range_val == 0) range_val <- 1

    interval_length <- range_val / (interval_count - (interval_count - 1) * percent_overlap / 100)
    step_size <- interval_length * (1 - percent_overlap / 100)

    intervals <- list()
    for (i in 0:(interval_count - 1)) {
      start <- min_val + i * step_size
      end <- start + interval_length
      intervals[[i + 1]] <- list(start = start, end = end, indices = which(filter_values >= start & filter_values <= end))
    }
  
  # 3. Cluster: Cluster data points within each interval
    nodes <- list()
    node_id_counter <- 0

    for (i in 1:length(intervals)) {
      indices <- intervals[[i]]$indices
      if (length(indices) > 0) {
        subset_data <- data[indices, ]

        clusters <- NULL
        if (nrow(subset_data) <= 2) {
          clusters <- rep(1, nrow(subset_data))
        } else {
          if (clustering_method == "kmeans") {
             # Simple k-means with heuristic k
            k <- min(nrow(subset_data), 2)
            km <- kmeans(subset_data, centers = k)
            clusters <- km$cluster
          } else if (clustering_method == "dbscan") {
             # Proxy for DBSCAN using hclust
             dist_mat <- dist(subset_data)
            hc <- hclust(dist_mat, method = "single")
            cut_height <- mean(dist_mat) * 0.8
            clusters <- cutree(hc, h = cut_height)
          } else {
             # Default: Agglomerative Clustering
            dist_mat <- dist(subset_data)
            hc <- hclust(dist_mat, method = "complete")
            k <- min(nrow(subset_data), 2)
            clusters <- cutree(hc, k = k)
          }
        }

        if (!is.null(clusters)) {
          for (cid in unique(clusters)) {
            node_indices <- indices[clusters == cid]
            node_id_counter <- node_id_counter + 1
            
            # Determine dominant species
            node_labels <- labels[node_indices]
            dominant_species <- names(sort(table(node_labels), decreasing = TRUE))[1]

            nodes[[node_id_counter]] <- list(
              id = paste0("node_", node_id_counter),
              level = i,
              indices = node_indices,
              size = length(node_indices),
              species = dominant_species
            )
          }
        }
      }
    }
  
  # 4. Adjacency Matrix
  num_nodes <- length(nodes)
  adjacency <- matrix(0, nrow = num_nodes, ncol = num_nodes)
  
  if (num_nodes > 1) {
    for (i in 1:(num_nodes-1)) {
      for (j in (i+1):num_nodes) {
        if (abs(nodes[[i]]$level - nodes[[j]]$level) <= 1) {
            intersection <- intersect(nodes[[i]]$indices, nodes[[j]]$indices)
            if (length(intersection) > 0) {
                adjacency[i, j] <- 1
                adjacency[j, i] <- 1
            }
        }
      }
    }
  }
  
  # Convert nodes list to TDAmapper format vectors
  level_of_vertex <- numeric(num_nodes)
  points_in_vertex <- list()
  
  for (k in 1:num_nodes) {
      level_of_vertex[k] <- nodes[[k]]$level
      points_in_vertex[[k]] <- nodes[[k]]$indices
  }

  # Combine data with labels for export
  original_data_with_labels <- data
  original_data_with_labels$Species <- labels
  
  # Return TDAmapper-like structure + original data
  return(list(
      adjacency = adjacency,
      num_vertices = num_nodes,
      level_of_vertex = level_of_vertex,
      points_in_vertex = points_in_vertex,
      original_data = original_data_with_labels
  ))
}

# Run Mapper
result <- run_simple_mapper(iris_data, iris_labels, ${interval}, ${overlap}, "${clusteringMethod}")

# Convert to JSON
toJSON(result, auto_unbox = TRUE)
`;

export async function runMapperAlgo(webR: any, interval: number, overlap: number, clusteringMethod: string): Promise<any> {
  // await webR.init(); // Removed redundant init
  const script = MAPPER_R_SCRIPT(interval, overlap, clusteringMethod);
  console.log(`Running R Script with Iris Data(Method: ${clusteringMethod})...`);

  // Evaluate the R code
  const result = await webR.evalR(script);

  // Parse the JSON output
  const output = await result.toJs();
  console.log("WebR Raw Output Type:", typeof output);
  console.log("WebR Raw Output:", output);

  let parsedData;

  if (typeof output === 'string') {
    // It's a single string
    parsedData = JSON.parse(output);
  } else if (output && typeof output === 'object' && 'values' in output && Array.isArray(output.values)) {
    // WebR character vector object: { type: 'character', values: [...] }
    const jsonStr = output.values[0];
    if (typeof jsonStr === 'string') {
      parsedData = JSON.parse(jsonStr);
    } else {
      parsedData = jsonStr;
    }
  } else if (Array.isArray(output)) {
    if (output.length === 0) {
      throw new Error("WebR returned empty array");
    }
    const firstItem = output[0];
    if (typeof firstItem === 'string') {
      // It's an array of strings (standard R character vector)
      parsedData = JSON.parse(firstItem);
    } else if (typeof firstItem === 'object') {
      // It's already an object (maybe WebR auto-converted?)
      parsedData = firstItem;
    } else {
      parsedData = firstItem;
    }
  } else if (typeof output === 'object') {
    // It's already an object
    parsedData = output;
  } else {
    throw new Error(`Unexpected WebR output type: ${typeof output}`);
  }

  console.log("Parsed R Output:", Object.keys(parsedData));
  if (parsedData.original_data) {
    console.log("Original Data Sample:", Array.isArray(parsedData.original_data) ? parsedData.original_data[0] : "Not an array");
  }

  // Transform TDAmapper format to GraphData
  // parsedData has: adjacency, num_vertices, level_of_vertex, points_in_vertex, original_data

  const numVertices = parsedData.num_vertices;
  const nodes: any[] = [];

  // Helper to find dominant species for a node
  // We need to look up the original data using indices
  const originalData = parsedData.original_data; // Array of objects or columns

  // Check if originalData is array of objects or column-based
  const getSpecies = (indices: number[]) => {
    if (!indices || indices.length === 0) return "unknown";

    const speciesCounts: Record<string, number> = {};
    indices.forEach(idx => {
      // R indices are 1-based, JS 0-based? 
      // Usually R -> JSON preserves values. If R indices are 1..N, we might need to adjust if we access JS array.
      // But here we just need the species label.
      // Let's assume originalData is an array of objects (jsonlite default for data.frame)
      // AND that indices are 1-based from R.

      let species = "unknown";
      if (Array.isArray(originalData)) {
        // 0-based access, so idx-1
        const row = originalData[idx - 1];
        if (row) species = row.Species;
      } else if (originalData.Species) {
        // Column based
        species = originalData.Species[idx - 1];
      }

      speciesCounts[species] = (speciesCounts[species] || 0) + 1;
    });

    // Find max
    return Object.entries(speciesCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  };

  for (let i = 0; i < numVertices; i++) {
    // R lists are 1-based, but JSON array is 0-based
    const rawIndices = parsedData.points_in_vertex[i];
    // Handle auto_unbox: if single item, it might be a number, not an array
    const indices = Array.isArray(rawIndices) ? rawIndices : [rawIndices];

    const level = parsedData.level_of_vertex[i];
    const size = indices.length;
    const id = `node_${i + 1}`; // Removed trailing space
    const species = getSpecies(indices);

    nodes.push({
      id: id,
      group: level,
      val: size,
      name: id,
      desc: `Cluster ${id} (Size: ${size}, Species: ${species})`,
      species: species,
      indices: indices
    });
  }

  const links: any[] = [];
  const adjacency = parsedData.adjacency;

  if (Array.isArray(adjacency)) {
    for (let i = 0; i < numVertices; i++) {
      for (let j = i + 1; j < numVertices; j++) {
        // Check if connected
        if (adjacency[i] && adjacency[i][j] === 1) {
          links.push({
            source: nodes[i].id,
            target: nodes[j].id,
            value: 1
          });
        }
      }
    }
  }

  // Create reverse links for bidirectional flow
  const reverseLinks = links.map(link => ({
    source: link.target,
    target: link.source,
    value: link.value,
    isReverse: true
  }));

  return {
    nodes,
    links: [...links, ...reverseLinks],
    originalData: parsedData.original_data,
    rawNodes: nodes, // We reconstructed nodes, so this is fine
    adjacency: parsedData.adjacency
  };
}
