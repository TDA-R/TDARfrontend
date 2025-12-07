#' Perform clustering within a level set
#'
#' @param points_in_this_level Points in the current level set.
#' @param filter_values The filter values.
#' @param methods Specify the clustering method to be used, e.g., "hclust" or "kmeans".
#' @param method_params A list of parameters for the clustering method.
#' @return A list containing the number of vertices, external indices, and internal indices.
#' @importFrom stats as.dist hclust cutree dist kmeans
#' @export
perform_clustering <- function(
    points_in_this_level,
    filter_values,
    methods,
    method_params = list()
) {
  num_points_in_this_level <- length(points_in_this_level)
  
  if (num_points_in_this_level == 0) {
    return(list(num_vertices = 0, external_indices = NULL, internal_indices = NULL))
  }
  
  if (num_points_in_this_level == 1) {
    return(list(num_vertices = 1, external_indices = points_in_this_level, internal_indices = c(1)))
  }

  clustering_methods <- list(
    hierarchical = function() {

      sub <- filter_values[points_in_this_level, , drop = FALSE]
      level_dist_object <- dist(sub)

      level_max_dist <- max(level_dist_object)
      level_hclust <- hclust(level_dist_object, method = method_params$method)
      level_heights <- level_hclust$height
      # find the best cutoff
      level_cutoff <- cluster_cutoff_at_first_empty_bin(level_heights, level_max_dist, method_params$num_bins_when_clustering)
      level_external_indices <- points_in_this_level[level_hclust$order]
      level_internal_indices <- as.vector(cutree(list(
        merge = level_hclust$merge,
        height = level_hclust$height,
        labels = level_external_indices), h = level_cutoff))
      num_vertices_in_this_level <- max(level_internal_indices)
      list(level_external_indices, level_internal_indices, num_vertices_in_this_level)
    },
    kmeans = function() {
      max_clusters <- min(method_params$max_kmeans_clusters, num_points_in_this_level)
      level_filter_values <- filter_values[points_in_this_level, , drop = FALSE]
      if (max_clusters < nrow(level_filter_values)) {
        level_kmean <- kmeans(level_filter_values, centers = max_clusters)
        list(
          points_in_this_level[order(level_kmean$cluster)], 
          as.vector(level_kmean$cluster), 
          max(level_kmean$cluster)
        )
      } else {
        list(points_in_this_level, rep(1, num_points_in_this_level), 1)
      }
    },
    dbscan = function() {
      level_filter_values <- filter_values[points_in_this_level, , drop = FALSE]
      dbscan_result <- dbscan::dbscan(
        level_filter_values, 
        eps = method_params$eps, 
        minPts = method_params$minPts
      )
      if (max(dbscan_result$cluster) > 0) {
        list(
          points_in_this_level[order(dbscan_result$cluster)], 
          as.vector(dbscan_result$cluster), 
          max(dbscan_result$cluster)
        )
      } else {
        list(points_in_this_level, rep(1, num_points_in_this_level), 1)
      }
    },
    pam = function() {
      level_filter_values <- filter_values[points_in_this_level, , drop = FALSE]
      if (nrow(level_filter_values) >= 2) {
        num_clusters <- min(method_params$num_clusters, nrow(level_filter_values) - 1)
        pam_result <- cluster::pam(level_filter_values, k = num_clusters)
        if (max(pam_result$clustering) > 0) {
          list(
            points_in_this_level[order(pam_result$clustering)], 
            as.vector(pam_result$clustering), 
            max(pam_result$clustering)
          )
        } else {
          list(points_in_this_level, rep(1, num_points_in_this_level), 1)
        }
      } else {
        list(points_in_this_level, rep(1, num_points_in_this_level), 1)
      }
    }
  )
  
  if (!methods %in% names(clustering_methods)) {
    stop("Invalid method provided")
  }
  clustering_result <- clustering_methods[[methods]]()
  
  return(list(
    num_vertices = clustering_result[[3]],
    external_indices = clustering_result[[1]],
    internal_indices = clustering_result[[2]]
  ))
}

#' Cut the hierarchical clustering tree to define clusters
#'
#' @param heights Heights of the clusters.
#' @param diam Diameter of the clusters.
#' @param num_bins_when_clustering Number of bins when clustering.
#' @return The cutoff height for the clusters.
#' @importFrom graphics hist
#' @export
cluster_cutoff_at_first_empty_bin <- function(heights, diam, num_bins_when_clustering) {
  if (length(heights) == 1) {
    if (heights == diam) {
      return(Inf)
    }
  }
  # keep bin_breaks cover in the range
  min_height <- min(heights)
  max_height <- max(c(heights, diam))
  # if bins is too small, we need to add a small number to max_height to make sure the last bin is not empty
  if (min_height == max_height) {
    bin_breaks <- seq(from = min_height, to = max_height + 1e-6, length.out = num_bins_when_clustering + 1)
  } else {
    bin_breaks <- seq(from = min_height, to = max_height, length.out = num_bins_when_clustering + 1)
  }
  
  myhist <- hist(c(heights, diam), breaks = bin_breaks, plot = FALSE)
  z <- (myhist$counts == 0)
  
  if (sum(z) == 0) {
    return(Inf)
  } else {
    cutoff <- myhist$mids[min(which(z == TRUE))]
    return(cutoff)
  }
}

#' Find the optimal number of clusters for k-means
#'
#' This function calculates the total within-cluster sum of squares (WSS) for a range
#' of cluster numbers and identifies the best number of clusters (k) based on the 
#' elbow method.
#'
#' @param dist_object A distance matrix or data frame containing the data to be clustered.
#' @param max_clusters The maximum number of clusters to test for k-means. Default is 10.
#' @return The optimal number of clusters (k) based on the elbow method.
#' @importFrom stats kmeans
#' @export
find_best_k_for_kmeans <- function(dist_object, max_clusters = 10) {
  # elbow method
  wss_values <- numeric(max_clusters)
  
  for (k in 1:max_clusters) {
    kmean_result <- kmeans(dist_object, centers = k, nstart = 25)  # nstart for more stable results
    wss_values[k] <- kmean_result$tot.withinss  # Total within-cluster sum of squares
  }
  
  differences <- diff(wss_values)
  second_differences <- diff(differences)
  
  best_k <- which(second_differences == min(second_differences)) + 1
  
  return(best_k)
}#' Convert level set flat index (lsfi) to multi-index (lsmi)
#'
#' @param lsfi Level set flat index.
#' @param num_intervals Number of intervals.
#' @return A multi-index corresponding to the flat index.
#' @export
to_lsmi <- function(lsfi, num_intervals) {
  # level set flat index (lsfi)
  j <- c(1, num_intervals) # put 1 in front to make indexing easier in the product prod(j[1:k])
  f <- c()
  for (k in 1:length(num_intervals)) {
    # use lsfi-1 to shift from 1-based indexing to 0-based indexing
    f[k] <- floor((lsfi-1) / prod(j[1:k])) %% num_intervals[k]
  }
  # lsmi = f+1 = level set multi index
  return(f+1) # shift from 0-based indexing back to 1-based indexing
}

#' Convert level set multi-index (lsmi) to flat index (lsfi)
#'
#' @param lsmi Level set multi-index.
#' @param num_intervals Number of intervals.
#' @return A flat index corresponding to the multi-index.
#' @export
to_lsfi <- function(lsmi, num_intervals) {
  # level set multi index (lsmi)
  lsfi <- lsmi[1]
  if (length(num_intervals) > 1) {
    for (i in 2:length(num_intervals)) {
      lsfi <- lsfi + prod(num_intervals[1:(i-1)]) * (lsmi[i]-1)
    }
  }
  return(lsfi)
}#' Cover points based on intervals and overlap
#'
#' @param lsfi Level set flat index.
#' @param filter_min Minimum filter value.
#' @param interval_width Width of the interval.
#' @param percent_overlap Percentage overlap between intervals.
#' @param filter_values The filter values to be analyzed.
#' @param num_intervals Number of intervals.
#' @param type Type of interval, either 'stride' or 'extension'.
#' @return Indices of points in the range.
#' @export
cover_points <- function(
    lsfi, filter_min, interval_width, percent_overlap,
    filter_values, num_intervals, type='stride'
    ) {
  # level set flat index (lsfi), which is a number, has a corresponding
  # level set multi index (lsmi), which is a vector
  lsmi <- to_lsmi(lsfi, num_intervals)

  # set the range of the interval
  if (type == 'stride') {
    # This is the original code in paper, but not performing well
    stride <- interval_width * (1 - percent_overlap / 100)
    anchor <- filter_min + (lsmi - 1) * stride
    lsfmin <- anchor
    lsfmax <- anchor + interval_width
  } else if (type == 'extension') {
    # the anchor is the leftmost point of the interval, center point is anchor + 0.5 * interval_width
    anchor <- filter_min + (lsmi - 1) * interval_width
    extension <- 0.5 * interval_width * percent_overlap / 100
    lsfmin <- anchor - extension
    lsfmax <- anchor + interval_width + extension
  }

  # compute whether each point is in the range
  in_range <- apply(filter_values, 1, function(x) all(lsfmin <= x & x <= lsfmax))
  # return the indices of the points that are in the range
  return(which(in_range))
}

#' Conditional Probability Embedding for Mapper Nodes
#'
#' The origin Mapper includes mean and majority label embeddings.
#' And this function provides another way to color the Mapper nodes.
#' The function is useful to connect original data for color labeling, especially if you're interested in characteristic attributes.
#'
#' @param mapper A Mapper object created by the `MapperAlgo` function.
#' @param original_data Original dataframe, not the filter values.
#' @param columns Two columns in original_data to compute conditional probability.
#' @param a_level The level (attribute) of column A to condition on. If NULL, the first level is used.
#' @param b_level The level (attribute) of column B for which the conditional probability is computed. If NULL, the first level is used.
#' @return A list of conditional probabilities value for each Mapper node.
#'
#' @export
CPEmbedding <- function(
    mapper, original_data, columns=list(), a_level = NULL, b_level = NULL
) {

  rows <- length(mapper$level_of_vertex)
  df_for_search <- data.frame()
  target_lst <- list()

  for (i in 1:rows) {
    original_row_lst <- mapper$points_in_vertex[[i]]
    df_for_search <- rbind(
      df_for_search,
      data.frame(
        node = i,
        original_indexes = I(list(original_row_lst))
      )
    )

    indexes <- df_for_search[i, ]$original_indexes[[1]]

    if (length(columns) != 2) {
      stop("Columns must be a list of length 2: list(A, B)")
    }

    colA <- columns[[1]]
    colB <- columns[[2]]

    if (!(colA %in% names(original_data)) || !(colB %in% names(original_data))) {
      stop("Specified columns not found in original_data.")
    }

    sub <- original_data[indexes, c(colA, colB), drop = FALSE]
    A <- as.character(sub[[colA]])
    B <- as.character(sub[[colB]])
    if (is.logical(A) || is.character(A)) A <- factor(A)
    if (is.logical(B) || is.character(B)) B <- factor(B)

    A <- droplevels(A)
    B <- droplevels(B)

    # Default levels: if not specified, take the first level of each factor
    a_lv <- if (is.null(a_level)) levels(A)[1] else a_level
    b_lv <- if (is.null(b_level)) levels(B)[1] else b_level

    # Formula: P(B=b_lv | A=a_lv) = count(A=a_lv & B=b_lv) / count(A=a_lv)
    denom <- sum(A == a_lv, na.rm = TRUE)
    if (denom == 0) {
      col_data <- NA_real_
    } else {
      num <- sum(A == a_lv & B == b_lv, na.rm = TRUE)
      col_data <- num / denom
    }

    target_lst[[i]] <- col_data
  }

  ret <- unlist(target_lst)
  ret[is.na(ret)] <- 0
  return(ret)
}
#' Create Mapper Edges
#'
#' This function generates the edges of the Mapper graph by analyzing the adjacency matrix.
#' It returns a data frame with source and target vertices that are connected by edges.
#'
#' @param m The Mapper output object that contains the adjacency matrix and other graph components.
#' @return A data frame containing the source (`Linksource`), target (`Linktarget`), and edge values (`Linkvalue`) for the graph's edges.
#' @export
mapperEdges <- function(m) {
  linksource <- c()
  linktarget <- c()
  linkvalue <- c()
  k <- 1
  for (i in 2:m$num_vertices) {
    for (j in 1:(i-1)) {
      if (m$adjacency[i,j] == 1) {
        linksource[k] <- i - 1
        linktarget[k] <- j - 1
        linkvalue[k] <- 2
        k <- k + 1
      }
    }
  }
  return(data.frame(Linksource = linksource,
                    Linktarget = linktarget, 
                    Linkvalue = linkvalue))
}

#' Create Mapper Vertices
#'
#' This function generates the vertices of the Mapper graph, including their labels and groupings.
#' It returns a data frame with the vertex names, the group each vertex belongs to, and the size of each vertex.
#'
#' @param m The Mapper output object that contains information about the vertices and level sets.
#' @param pt_labels A vector of point labels to be assigned to the points in each vertex.
#' @return A data frame containing the vertex names (`Nodename`), group information (`Nodegroup`), and vertex sizes (`Nodesize`).
#' @export
mapperVertices <- function(m, pt_labels) {
  labels_in_vertex <- lapply(m$points_in_vertex, FUN = function(v) { pt_labels[v] })
  nodename <- sapply(sapply(labels_in_vertex, as.character), paste0, collapse = ", ")
  nodename <- paste0("V", 1:m$num_vertices, ": ", nodename)
  
  nodegroup <- m$level_of_vertex
  nodesize <- sapply(m$points_in_vertex, length)
  
  return(data.frame(Nodename = nodename, 
                    Nodegroup = nodegroup, 
                    Nodesize = nodesize))
}
#' GridSearch searched over a list of interval width and overlap,
#' useful for visualizing the convergence of the Mapper.
#'
#' @param filter_values A numeric matrix or data frame of filter values (rows are samples, columns are filter dimensions).
#' @param label A vector of labels for coloring the Mapper nodes.
#' @param column The original column name (use when use_embedding=TRUE).
#' @param cover_type The type of cover to use "stride" or "extension".
#' @param width_vec A vector of interval widths.
#' @param overlap_vec A vector of percent overlaps.
#' @param num_cores Number of cores to use for parallel computing.
#' @param out_dir Directory to save the output.
#' @param avg Whether coloring the nodes by average label or majority label.
#' @param use_embedding Whether to use embedding for coloring (NULL or embedding vector).
#' @return A folder containing the PNG files of the Mapper visualizations.
#' @export

GridSearch <- function(
    filter_values,
    label,
    column = "label",
    cover_type = "stride",
    width_vec = c(0.5, 1.0, 1.5),
    overlap_vec = c(10, 20, 30, 40),
    num_cores = 12,
    out_dir = "mapper_grid_outputs",
    avg = FALSE,
    use_embedding = NULL
) {

  dir.create(out_dir, showWarnings = FALSE)

  if (!is.null(use_embedding)) {
    data <- cbind(as.data.frame(filter_values), label)
    colnames(data)[ncol(data)] <- column
  }

  for (w in width_vec) {

    for (ov in overlap_vec) {

      cat(sprintf("Cover=%s, Width=%.2f, Overlap=%d%%\n", cover_type, w, ov))

      time_taken <- system.time({
        Mapper <- MapperAlgo(
          filter_values = filter_values,
          percent_overlap = ov,
          methods  = "dbscan",
          method_params = list(eps = 0.3, minPts = 1),
          cover_type = cover_type,
          interval_width = w,
          num_cores = num_cores
        )
      })
      if (!is.null(use_embedding)){
        embedded <- CPEmbedding(Mapper, data,
                                columns = list(use_embedding[[1]][1], use_embedding[[2]][1]),
                                a_level = use_embedding[[3]], b_level = use_embedding[[4]])
      }

      wdg <- MapperPlotter(Mapper=Mapper,
                           label=if (!is.null(use_embedding)) embedded else label,
                           data=data,
                           type="forceNetwork",
                           avg=avg,
                           use_embedding=if (!is.null(use_embedding)) TRUE else FALSE
      )

      png_file <- file.path(out_dir, sprintf("mapper_%s_w%.2f_ov%02d.png", cover_type, w, ov))
      save_mapper_png(wdg, png_file, vwidth = 1400, vheight = 1000, zoom = 2, delay = 0.7)

      cat("Saved:", png_file, ", Elapsed:", time_taken["elapsed"], "sec\n")
      gc()
    }
  }
}

#' GridSearch searched over a list of interval width and overlap,
#' useful for visualizing the convergence of the Mapper.
#'
#' @param widget The htmlwidget object to be saved as PNG.
#' @param png_path The file path to save the PNG image.
#' @param vwidth The viewport width for the webshot.
#' @param vheight The viewport height for the webshot.
#' @param zoom The zoom factor for the webshot.
#' @param delay The delay in seconds before taking the snapshot. Useful for allowing time for the widget to fully render.
#' @return The snapshot is saved to the specified path.
#' @import htmlwidgets
#' @import webshot2
#' @export
save_mapper_png <- function(
    widget, png_path, vwidth = 1200, vheight = 900, zoom = 2, delay = 0.5
    ) {
  tmp_html <- tempfile(fileext = ".html")
  on.exit(try(unlink(tmp_html), silent = TRUE), add = TRUE)
  saveWidget(widget, tmp_html, selfcontained = TRUE)
  webshot(tmp_html, file = png_path, vwidth = vwidth, vheight = vheight, zoom = zoom, delay = delay)
}
#' Mapper Algorithm
#'
#' Implements the Mapper algorithm for Topological Data Analysis (TDA).
#' It divides data into intervals, applies clustering within each interval, and constructs a
#' simplicial complex representing the structure of the data.
#'
#' @param filter_values A data frame or matrix of the data to be analyzed.
#' @param intervals An integer specifying the number of intervals.
#' @param interval_width The width of each interval.
#' @param percent_overlap Percentage of overlap between consecutive intervals.
#' @param methods Specify the clustering method to be used, e.g., "hclust" or "kmeans".
#' @param method_params A list of parameters for the clustering method.
#' @param cover_type Type of interval, either 'stride' or 'extension'.
#' @param num_cores Number of cores to use for parallel computing.
#' @return A list containing the Mapper graph components:
#' \describe{
#'   \item{adjacency}{The adjacency matrix of the Mapper graph.}
#'   \item{num_vertices}{The number of vertices in the Mapper graph.}
#'   \item{level_of_vertex}{A vector specifying the level of each vertex.}
#'   \item{points_in_vertex}{A list of the indices of the points in each vertex.}
#'   \item{points_in_level_set}{A list of the indices of the points in each level set.}
#'   \item{vertices_in_level_set}{A list of the indices of the vertices in each level set.}
#' }
#'
#' @importFrom parallel makeCluster stopCluster
#' @importFrom doParallel registerDoParallel
#' @import foreach
#' @export
MapperAlgo <- function(
    filter_values, # dist_df[,1:col]
    percent_overlap, # 50
    methods,
    method_params = list(), # params in each clustering method
    cover_type = 'extension',
    intervals = NULL,
    interval_width = NULL,
    num_cores = 1
) {

  filter_values <- data.frame(filter_values)

  num_points <- dim(filter_values)[1] # row

  # define some vectors of length k = number of columns
  filter_min <- as.vector(sapply(filter_values, min))
  filter_max <- as.vector(sapply(filter_values, max))
  L <- (filter_max - filter_min)

  # four conditions:
  # 1. No intervals, with width
  # 2. No intervals, no width : This couldn't be computed
  # 3. Intervals, with width
  # 4. Intervals, no width
  if (is.null(intervals) & !is.null(interval_width)) {
    # if only width is specified, calculate the number of intervals
    if (cover_type == 'stride') {
      # stride: n = ceil((L - w) / (w*(1 - p))) + 1, L<=w → n=1
      stride <- interval_width * (1 - percent_overlap/100)
      num_intervals <- ifelse(
        L <= interval_width,
        1L,
        as.integer(ceiling((L - interval_width) / pmax(stride, .Machine$double.eps)) + 1L)
      )
    } else if (cover_type == 'extension') {
      # extension: n = ceil(L / w - p/100)
      num_intervals <- pmax(1L, as.integer(ceiling(L / interval_width - percent_overlap/100)))
    } else {
      stop("cover_type must be 'stride' or 'extension'")
    }

  } else if (!is.null(intervals) & is.null(interval_width)) {
    # if only intervals is specified, calculate the widths
    num_intervals <- rep(intervals, ncol(filter_values)) # rep(2,4) = (2,2,2,2)
    interval_width <- (filter_max - filter_min) / num_intervals
  } else {
     stop("Invalid combination of intervals and interval_width.")
  }

  num_levelsets <- prod(num_intervals)

  # initialize variables
  vertex_index <- 0
  level_of_vertex <- c()
  points_in_vertex <- list()
  points_in_level_set <- vector("list", num_levelsets)
  # store the data points owned by each individual interval
  vertices_in_level_set <- vector("list", num_levelsets)

  # Set up parallel computing
  # cl <- makeCluster(num_cores)
  # registerDoParallel(cl)

  # begin loop through all level sets
  for (lsfi in 1:num_levelsets) {

    points_in_level_set_val <- cover_points(
      lsfi, filter_min, interval_width, percent_overlap,
      filter_values, num_intervals, cover_type
    )

    # Store points in level set
    points_in_level_set[[lsfi]] <- points_in_level_set_val

    clustering_result <- perform_clustering(
      points_in_level_set_val,
      filter_values,
      methods,
      method_params
    )

    num_vertices_in_this_level <- clustering_result$num_vertices
    level_external_indices <- clustering_result$external_indices
    level_internal_indices <- clustering_result$internal_indices

    # Begin vertex construction
    if (num_vertices_in_this_level > 0) { # check admissibility condition
      # add the number of vertices in the current level set to the vertex index
      vertices_in_level_set[[lsfi]] <- vertex_index + (1:num_vertices_in_this_level)
      for (j in 1:num_vertices_in_this_level) {
        vertex_index <- vertex_index + 1
        level_of_vertex[vertex_index] <- lsfi # put the current loop count into the corresponding index vertex
        # let all points that satisfy the condition "the number of internal clusters of the current lsfi ==
        # the maximum value of the current vertices" be put into points_in_vertex
        points_in_vertex[[vertex_index]] <- level_external_indices[level_internal_indices == j]
      }
    }
    # note : compute the number of points in each cluster of a single interval,
    # and then loop over the number of intervals
  }

  # Begin simplicial complex
  adja <- simplcial_complex(filter_values, vertex_index, num_levelsets, num_intervals,
                            vertices_in_level_set, points_in_vertex)

  mapperoutput <- list(adjacency = adja,
                       num_vertices = vertex_index,
                       level_of_vertex = level_of_vertex,
                       points_in_vertex = points_in_vertex,
                       points_in_level_set = points_in_level_set,
                       vertices_in_level_set = vertices_in_level_set)

  class(mapperoutput) <- "TDAmapper"
  return(mapperoutput)
}
#' Visualizes the correlation between two Mapper colorings.
#'
#' @param mapper A Mapper object created by the `MapperAlgo` function.
#' @param data Data.
#' @param labels List of two Mapper color.
#' @param use_embedding List of two booleans indicating whether to use original data or embedding data.
#' @return Plot of the correlation between two Mapper.
#' @importFrom stats cor
#' @importFrom ggplot2 ggplot geom_point geom_smooth theme_minimal
#' @export
MapperCorrelation <- function(
    mapper, data, labels = list(), use_embedding = list(FALSE, FALSE)
) {
  graph1 <- MapperPlotter(mapper, label=labels[[1]], data=data, type="ggraph", avg=TRUE, use_embedding=use_embedding[[1]])
  graph2 <- MapperPlotter(mapper, label=labels[[2]], data=data, type="ggraph", avg=TRUE, use_embedding=use_embedding[[2]])

  x <- graph1$data$AvgLabel
  y <- graph2$data$AvgLabel

  cc <- cor(x, y, method = "pearson", use = "complete.obs")

  df <- data.frame(x=x, y=y)
  # plot
  plt <- ggplot(data = df, aes(x, y)) +
    geom_point(color='#447356') +
    geom_smooth(method = "lm", se = FALSE, color = "#58ad90") +
    labs(
      title = paste("Correlation between two Mapper", round(cc, 3)),
      x = "Avg label 1",
      y = "Avg label 2"
    ) +
    theme_minimal()

  return(plt)
}
#' Plot Mapper Result
#'
#' Visualizes the Mapper output using either networkD3 or ggraph.
#'
#' @param Mapper Mapper object.
#' @param label Label of the data.
#' @param data Data.
#' @param type Visualization type: "forceNetwork" or "ggraph".
#' @param avg Whether coloring the nodes by average label or majority label.
#' @param use_embedding Whether to use original data for coloring (TRUE or FALSE).
#' @return Plot of the Mapper.
#' @importFrom igraph graph.adjacency V
#' @importFrom networkD3 forceNetwork
#' @importFrom htmlwidgets JS
#' @importFrom ggraph ggraph geom_edge_link geom_node_point geom_node_text
#' @importFrom tidygraph tbl_graph
#' @importFrom ggplot2 aes labs theme_void
#' @importFrom stats quantile
#' @importFrom rlang .data
#' @export
MapperPlotter <- function(
    Mapper, label, data, type="forceNetwork", avg=FALSE,
    use_embedding=FALSE
) {

  Graph <- graph.adjacency(Mapper$adjacency, mode="undirected")
  l = length(V(Graph))
  piv <- Mapper$points_in_vertex
  nbins <- 5
  vertex.size <- sapply(piv, length)

  if (avg) {
    legend <- FALSE
    avg_label <- vapply(piv, \(idx) mean(label[idx], na.rm = TRUE), numeric(1))
    Group_col <- avg_label
    color_title <- "Avg(label)"
  }else {
    legend <- TRUE
    lab_chr <- as.character(label)
    majority <- character(l)

    for (i in seq_len(l)) {
      pts <- piv[[i]]
      ux <- unique(lab_chr[pts])
      majority[i] <- ux[which.max(tabulate(match(lab_chr[pts], ux)))]
    }
    Group_col <- factor(majority)
    color_title <- "Majority label"
  }
  if (use_embedding) {
    Group_col <- label
    # if (!avg) legend <- FALSE
  }

  if (type == "forceNetwork") {

    Graph <- igraph::graph.adjacency(Mapper$adjacency, mode = "undirected")
    MapperNodes <- mapperVertices(Mapper, 1:nrow(data))
    MapperNodes$Group <- Group_col
    MapperNodes$Nodesize <- vertex.size * 5
    if (avg) MapperNodes$AvgLabel <- Group_col
    if (!avg && !use_embedding) MapperNodes$majority <- Group_col

    MapperLinks <- mapperEdges(Mapper)

    if (is.numeric(MapperNodes$Group)) {
      rng <- range(MapperNodes$Group, na.rm = TRUE)
      colourScale <- htmlwidgets::JS(sprintf(
        "d3.scaleSequential(d3.interpolateViridis).domain([%f, %f])",
        rng[1], rng[2]
      ))
      is_continuous <- TRUE
    } else {
      colourScale <- htmlwidgets::JS("d3.scaleOrdinal(d3.schemeCategory10)")
      is_continuous <- FALSE
    }

    p <- forceNetwork(
      Nodes = MapperNodes,
      Links = MapperLinks,
      Source = "Linksource",
      Target = "Linktarget",
      Value  = "Linkvalue",
      NodeID = "Nodename",
      Nodesize = "Nodesize",
      Group = "Group",
      opacity = 1,
      zoom = TRUE,
      radiusCalculation = JS("Math.sqrt(d.nodesize)"),
      colourScale = colourScale,
      linkDistance = JS("function(d){ return (d.value ? 40 + 8*Math.sqrt(d.value) : 60); }"),
      charge = JS("function(d){ return - (60 + 2*Math.sqrt(d.nodesize)); }"),
      legend = legend
    )
    if (avg && is_continuous) {
      pal <- viridisLite::viridis(100)
      pal_json <- jsonlite::toJSON(pal, auto_unbox = TRUE)
      p <- htmlwidgets::onRender(p, htmlwidgets::JS(sprintf(
        "function(el, x) {
           var colors = %s;
           var minv = %f, maxv = %f;
           var root = d3.select(el);
           var container = root.append('div')
             .attr('class','rd3-colorbar')
             .style('position','absolute')
             .style('right','10px')
             .style('top','10px')
             .style('padding','6px')
             .style('background','rgba(255,255,255,0.95)')
             .style('border','1px solid #ddd')
             .style('border-radius','3px')
             .style('font-family','sans-serif')
             .style('font-size','11px')
             .style('pointer-events','none');

           container.append('div').text('%s').style('margin-bottom','4px').style('font-weight','500');

           // gradient bar
           var grad = container.append('div')
             .style('width','140px')
             .style('height','12px')
             .style('border','1px solid #ccc')
             .style('background', 'linear-gradient(to right,' + colors.join(',') + ')');

           // min / max labels
           var labels = container.append('div').style('display','flex').style('justify-content','space-between').style('margin-top','4px');
           labels.append('div').text(minv);
           labels.append('div').text(maxv);
         }",
        pal_json, rng[1], rng[2], color_title
      )))
    }

  }
  else if (type == "ggraph") {

    # create node data frame
    node_df <- data.frame(
      id = seq_len(l),
      level = Mapper$level_of_vertex,
      size = vertex.size,
      Group = Group_col,
      stringsAsFactors = FALSE
    )

    if (use_embedding) {
      node_df$Group <- label
    }

    if (avg) node_df$AvgLabel <- avg_label

    adj <- Mapper$adjacency
    edge_df <- which(adj == 1, arr.ind = TRUE)
    edge_df <- edge_df[edge_df[, 1] < edge_df[, 2], , drop = FALSE]
    edges <- data.frame(from = edge_df[, 1], to = edge_df[, 2])

    graph <- tbl_graph(nodes = node_df, edges = edges, directed = FALSE)

    set.seed(123)
    p <- ggraph(graph, layout = "fr") +  # Fruchterman-Reingold layout
      geom_edge_link(color = "gray") +
      geom_node_point(aes(size = size, color = .data$Group)) +
      # geom_node_text(aes(label = id), repel = TRUE, size = 3) +
      theme_void() +
      labs(color = 'Group', size = "Points in Cluster")
  }

  return(p)
}
#' Construct adjacency matrix of the simplicial complex
#'
#' @param filter_values A matrix of filter values.
#' @param vertex_index The number of vertices.
#' @param num_levelsets The total number of level sets.
#' @param num_intervals A vector representing the number of intervals for each filter.
#' @param vertices_in_level_set A list where each element contains the vertices corresponding to each level set.
#' @param points_in_vertex A list where each element contains the points corresponding to each vertex.
#' @return An adjacency matrix representing the simplicial complex.
#' @export
simplcial_complex <- function(
    filter_values, vertex_index, num_levelsets, num_intervals, vertices_in_level_set, points_in_vertex
) {
  filter_output_dim <- dim(filter_values)[2] # columns
  # create empty adjacency matrix to store the connections between vertices
  adja <- mat.or.vec(vertex_index, vertex_index)
  for (lsfi in 1:num_levelsets) {

    lsmi <- to_lsmi(lsfi, num_intervals)
    # Find adjacent level sets +1 of each entry in lsmi (within bounds of num_intervals)
    # Need to_lsfi to do this easily.
    for (k in 1:filter_output_dim) {
      # check admissibility condition
      if (lsmi[k] >= num_intervals[k]) { next }
      lsmi_adjacent <- lsmi + diag(filter_output_dim)[, k]
      lsfi_adjacent <- to_lsfi(lsmi_adjacent, num_intervals)
      
      v1_set <- vertices_in_level_set[[lsfi]]
      v2_set <- vertices_in_level_set[[lsfi_adjacent]]
      
      if (length(v1_set) < 1 | length(v2_set) < 1) { next }
      # construct adjacency matrix
      for (v1 in v1_set) {
        for (v2 in v2_set) {
          adja[v1, v2] <- (length(intersect(
            points_in_vertex[[v1]], points_in_vertex[[v2]])) > 0)
          
          adja[v2, v1] <- adja[v1,v2]
        }
      }
    }
  }
  return(adja)
}# This file is to solve MapperPlotter: no visible binding for global variable while using devtools::check()
utils::globalVariables(c("id", "level", "size"))