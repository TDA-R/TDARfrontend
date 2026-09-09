# TDA-R Playgrounds

An interactive website for **Topological Data Analysis (TDA)**, connecting theory, algebraic invariants, and interactive data visualisation.


## Playgrounds Overview

### 1. MapperAlgo
An interactive graph visualisation workspace for the R package **MapperAlgo**.
* **Interactive 2D/3D Network Graph**: Switch seamlessly between ForceGraph 2D and 3D rendering with orbit controls, zoom, and node pinning.
* **Feature Colouring & Histograms**: Adaptive colour mapping for both continuous and categorical variables with real-time distribution charts for clusters.
* **Custom Dataset Upload**: Upload custom JSON outputs generated from R Mapper pipelines.
* **Sub-Group Analysis**: Shift-drag multi-node selection with comparative statistical breakdowns and cluster inspector.

You can export your Mapper results directly from R for visualisation in the playground:

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

write(toJSON(export_data, auto_unbox = TRUE), "~/Desktop/iris_mapper.json")
```


### 2. SimplicialComplex
A visual & algebraic guide exploring the foundation of computational topology:
* **Boundary Operators & Homology**: Matrix representations of boundary maps, kernels, images, and algebraic computation of Betti numbers.
* **Complex Families**: Comparison of Abstract Simplicial Complexes, Vietoris–Rips complexes, Čech complexes, and Cubical complexes for voxel/pixel data.
* **Persistent Homology**: Interactive step-by-step filtration slider with dynamic persistence barcode tracker and birth-death lifecycle.
* **Zigzag Persistence**: Demonstration of non-monotonic inclusions and algebraic interval decomposition.
* **Topological Laplacians**: Discrete combinatorial Hodge Laplacians with spectrum eigenvalue decomposition showing harmonic components.


## Author & Organization

* **Author**: Chi-Chien Wang ([kennywang2003@gmail.com](mailto:kennywang2003@gmail.com))
* **Organisation**: [TDA-R (GitHub)](https://github.com/TDA-R)
