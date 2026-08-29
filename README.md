# TDA-R Mapper

```r

library(jsonlite)

export_data <- list(
  adjacency = Mapper$adjacency,
  num_vertices = Mapper$num_vertices,
  level_of_vertex = Mapper$level_of_vertex,
  points_in_vertex = Mapper$points_in_vertex,
  input_params = Mapper$input_params,
  original_data = as.data.frame(all_features)
)
write(toJSON(export_data, auto_unbox = TRUE), "~/desktop/iris.json")
```

## Introduction

This tool allows researchers and data scientists to visualise the shape of their data, identify clusters, and understand complex relationships through an interactive 2D/3D network graph.

### Key Features

*   **Interactive 2D/3D Graph**: Navigate, zoom, and inspect topological networks in a rich 3D environment.
*   **Custom Data Upload**: Support for uploading custom JSON datasets for immediate analysis.
*   **Visualisation**: Automatic column detection for adaptive node colouring and statistical insights.
*   **Node histogram**: Show the distribution of data points in each node.