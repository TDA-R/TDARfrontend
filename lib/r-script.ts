import { WebR } from 'webr';

export const MAPPER_R_SCRIPT = (interval: number, overlap: number, clusteringMethod: string) => `
library(jsonlite)
# library(MapperAlgo) # Loaded via source in WebRProvider

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
# Load Data
if (file.exists('/input.json')) {
  input_data <- fromJSON('/input.json')
  # Check if it's a list (JSON array of objects) or matrix
  if (is.list(input_data) && !is.data.frame(input_data)) {
     # Try to convert to data frame
     input_data <- as.data.frame(input_data)
  }
  
  # Select numeric columns for Mapper
  nums <- unlist(lapply(input_data, is.numeric))
  filter_values <- input_data[, nums, drop = FALSE]
  
  # If no numeric columns, try to use all (maybe they are strings but convertible?)
  if (ncol(filter_values) == 0) {
     filter_values <- input_data
  }
  
  original_data <- input_data
} else {
  data(iris)
  filter_values <- iris[, 1:4]
  original_data <- iris
}

# -----------------------------------------------------------------------------
# Run MapperAlgo
# -----------------------------------------------------------------------------

# Define method params based on method
method_params <- list()
if ("${clusteringMethod}" == "dbscan") {
    method_params <- list(eps = 0.5, minPts = 5) # Default/Heuristic
} else if ("${clusteringMethod}" == "kmeans") {
    method_params <- list(max_kmeans_clusters = 3)
} else {
    # hierarchical
    method_params <- list(num_bins_when_clustering = 10, method = 'ward.D2')
}

Mapper <- MapperAlgo(
    filter_values = filter_values,
    percent_overlap = ${overlap},
    methods = "${clusteringMethod}",
    method_params = method_params,
    cover_type = 'stride',
    intervals = ${interval}, # Use intervals count from UI
    num_cores = 1 # WebR is single threaded usually
)

# -----------------------------------------------------------------------------
# Prepare Output
# -----------------------------------------------------------------------------
# We need to ensure the output matches what the frontend expects:
# adjacency, num_vertices, level_of_vertex, points_in_vertex, original_data

export_data <- list(
  adjacency = Mapper$adjacency,
  num_vertices = Mapper$num_vertices,
  level_of_vertex = Mapper$level_of_vertex,
  points_in_vertex = Mapper$points_in_vertex,
  original_data = original_data # Include original data for coloring
)

# Convert to JSON
toJSON(export_data, auto_unbox = TRUE)
`;

export async function runMapperAlgo(
    webR: any,
    interval: number,
    overlap: number,
    clusteringMethod: string,
    customData?: any[] | null
): Promise<any> {

    // Handle Custom Data
    if (customData && customData.length > 0) {
        console.log("Writing custom data to /input.json...", customData.length, "rows");
        await webR.FS.writeFile('/input.json', JSON.stringify(customData));
    } else {
        console.log("No custom data provided, using Iris default.");
        try {
            // Remove input.json if it exists to force Iris usage
            await webR.FS.unlink('/input.json');
        } catch (e) {
            // Ignore if file doesn't exist
        }
    }

    const script = MAPPER_R_SCRIPT(interval, overlap, clusteringMethod);
    console.log(`Running R Script (Method: ${clusteringMethod})...`);


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
                    // Calculate overlap size (weight)
                    const indicesA = nodes[i].indices || [];
                    const indicesB = nodes[j].indices || [];

                    // Helper for intersection
                    // Note: indices might be numbers or strings, should be consistent
                    const setA = new Set(indicesA);
                    const intersectionCount = indicesB.filter((idx: any) => setA.has(idx)).length;

                    links.push({
                        source: nodes[i].id,
                        target: nodes[j].id,
                        value: intersectionCount || 1 // Ensure at least 1 if connected
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
        adjacency: parsedData.adjacency,
        cc: parsedData.cc // Pass pre-calculated attributes
    };
}
