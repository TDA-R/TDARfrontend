'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebR } from './WebRProvider';
import { runMapperAlgo } from '@/lib/r-script';
import { Download, Box, Square, Sun, Moon, Network } from 'lucide-react';

// Dynamically import ForceGraph3D with no SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-zinc-500">Loading 3D Engine...</div>
});

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-zinc-500">Loading 2D Engine...</div>
});

interface Node {
    id: string;
    group: number;
    val: number;
    name: string;
    desc: string;
    species: string;
    indices: number[];
}

interface Link {
    source: string;
    target: string;
    value: number;
    isReverse?: boolean;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
    originalData?: any[];
    rawNodes?: any[];
    adjacency?: any;
    cc?: Record<string, number[]>; // Pre-calculated node attributes
}

interface MapperGraphProps {
    interval: number;
    overlap: number;
    clusteringMethod: string;
    sourceData: any[] | null;
    onDataUpload: (data: any[]) => void;
}

export function MapperGraph({ interval, overlap, clusteringMethod, sourceData, onDataUpload }: MapperGraphProps) {
    const { webR, isLoading: isWebRLoading } = useWebR();
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [isComputing, setIsComputing] = useState(false);
    const [is3D, setIs3D] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [useEdgeWeights, setUseEdgeWeights] = useState(true);
    const computationIdRef = useRef(0);
    const fgRef = useRef<any>(null);

    // Dynamic Coloring State
    const [columns, setColumns] = useState<{ name: string; type: 'numerical' | 'categorical'; source?: 'cc' | 'data' }[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<string>('');
    const [nodeColors, setNodeColors] = useState<Record<string, string>>({});
    const [columnStats, setColumnStats] = useState<{ min: number; max: number } | null>(null);

    // Run Mapper Algorithm using WebR
    useEffect(() => {
        // Only run if webR is ready
        if (!webR || isWebRLoading) return;

        const reqId = ++computationIdRef.current;

        const computeGraph = async () => {
            if (computationIdRef.current !== reqId) return;

            setIsComputing(true);
            console.log("Starting Mapper computation...");
            try {
                // Pass sourceData to runMapperAlgo
                const graphData = await runMapperAlgo(webR, interval, overlap, clusteringMethod, sourceData);

                if (computationIdRef.current !== reqId) return;

                console.log("Mapper computation result:", graphData);
                if (graphData) {
                    setData(graphData);

                    // Also analyze original data if present in graphData (for default/initial load)
                    if (graphData.originalData) {
                        analyzeData(graphData.originalData);
                    }
                }
            } catch (error) {
                if (computationIdRef.current !== reqId) return;
                console.error("Error running Mapper:", error);
            } finally {
                if (computationIdRef.current === reqId) {
                    setIsComputing(false);
                }
            }
        };

        // Debounce to avoid too many R calls
        const timer = setTimeout(computeGraph, 500);
        return () => clearTimeout(timer);
    }, [webR, isWebRLoading, interval, overlap, clusteringMethod, sourceData]); // Add sourceData dependency

    // Adjust Force Graph Simulation
    useEffect(() => {
        if (!fgRef.current) return;

        // Add a small delay to ensure graph is initialized
        const timer = setTimeout(() => {
            if (fgRef.current) {
                // Increase link distance (Edge length)
                if (fgRef.current.d3Force) {
                    const linkForce = fgRef.current.d3Force('link');
                    if (linkForce) {
                        if (useEdgeWeights) {
                            linkForce.distance((link: any) => {
                                const val = link.value || 1;
                                return 30 + (100 / (Math.sqrt(val) || 1));
                            });
                        } else {
                            linkForce.distance(50); // Fixed distance
                        }
                    }

                    const chargeForce = fgRef.current.d3Force('charge');
                    if (chargeForce) chargeForce.strength(-120); // More repulsion

                    if (fgRef.current.d3ReheatSimulation) {
                        fgRef.current.d3ReheatSimulation();
                    }
                }
            }
        }, 300); // Wait for render

        return () => clearTimeout(timer);
    }, [data, is3D, useEdgeWeights]);

    const analyzeData = (data: any[], cc?: Record<string, number[]>) => {
        const cols: { name: string, type: 'numerical' | 'categorical', source?: 'cc' | 'data' }[] = [];

        // 1. Add Pre-calculated Attributes (CC)
        if (cc) {
            Object.keys(cc).forEach(key => {
                cols.push({ name: key, type: 'numerical', source: 'cc' });
            });
        }

        // 2. Add Original Data Columns
        if (data && data.length > 0) {
            const firstRow = data[0];
            if (typeof firstRow === 'object') {
                Object.keys(firstRow).forEach(key => {
                    // Avoid duplicates if key matches cc
                    if (cols.find(c => c.name === key)) return;

                    const val = firstRow[key];
                    const isNum = typeof val === 'number';
                    cols.push({ name: key, type: isNum ? 'numerical' : 'categorical', source: 'data' });
                });
            }
        }

        setColumns(cols);

        // Default to first numerical column or first column if not set
        if (!selectedColumn) {
            const defaultCol = cols.find(c => c.type === 'numerical')?.name || cols[0]?.name;
            if (defaultCol) setSelectedColumn(defaultCol);
        }
    };

    const handleNodeDragEnd = useCallback((node: any) => {
        // Lock the node position after dragging
        node.fx = node.x;
        node.fy = node.y;
        node.fz = node.z;
    }, []);

    // Custom 2D Rendering
    const drawNode2D = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const radius = Math.sqrt(node.val || 0.1) * 3;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = nodeColors[node.id] || node.color || '#888';
        ctx.fill();

        // Black stroke
        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
    }, [nodeColors]);

    const drawNodePointerArea2D = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        const radius = Math.sqrt(node.val || 0.1) * 3 + 1; // Slight padding
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();
    }, []);

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Analyze data to find columns and types
    useEffect(() => {
        if (!data.originalData) return;

        const originalData = data.originalData;
        const cc = data.cc;

        const cols: { name: string, type: 'numerical' | 'categorical', source?: 'cc' | 'data' }[] = [];

        // 1. Add Pre-calculated Attributes (CC)
        if (cc) {
            Object.keys(cc).forEach(key => {
                cols.push({ name: key, type: 'numerical', source: 'cc' });
            });
        }

        // Safety check for empty data
        if (Array.isArray(originalData) && originalData.length === 0) {
            setColumns(cols);
            return;
        }
        if (typeof originalData === 'object' && !Array.isArray(originalData) && Object.keys(originalData).length === 0) {
            setColumns(cols);
            return;
        }

        // Check for direct node values (flat numeric array)
        if (Array.isArray(originalData) && typeof originalData[0] === 'number') {
            console.log("Detected direct node values.");
            cols.push({ name: 'Node Value', type: 'numerical', source: 'data' });
            setColumns(cols);

            // Default to CC if present, else Node Value
            if (!selectedColumn) {
                const defaultCol = cols.find(c => c.source === 'cc')?.name || 'Node Value';
                setSelectedColumn(defaultCol);
            }
            return;
        }

        let firstRow: any = null;
        if (Array.isArray(originalData)) {
            firstRow = originalData[0];
        } else if (originalData && typeof originalData === 'object') {
            // Fallback if column-based: construct a mock first row from the first value of each column
            const keys = Object.keys(originalData);
            if (keys.length > 0) {
                firstRow = {};
                keys.forEach(k => {
                    const col = (originalData as any)[k];
                    firstRow[k] = Array.isArray(col) ? col[0] : col;
                });
            }
        }

        if (!firstRow) {
            setColumns(cols);
            console.warn("Could not determine data structure from original_data");
            return;
        }

        const keys = Object.keys(firstRow);

        keys.forEach(key => {
            // Avoid duplicates with CC
            if (cols.find(c => c.name === key)) return;

            // Check type based on first few non-null values
            let type: 'numerical' | 'categorical' = 'categorical';
            const sampleSize = Math.min(Array.isArray(originalData) ? originalData.length : 5, 5);

            for (let i = 0; i < sampleSize; i++) {
                const val = Array.isArray(originalData) ? originalData[i][key] : (originalData as any)[key]?.[i];
                if (typeof val === 'number' && !isNaN(val)) { // Ensure it's a valid number
                    type = 'numerical';
                    break;
                }
            }
            cols.push({ name: key, type, source: 'data' });
        });

        setColumns(cols);

        // Default to Species if exists, else first categorical, else first numerical
        if (!selectedColumn || !cols.find(c => c.name === selectedColumn)) {
            // Priority: CC -> Species -> Categorical -> First
            const defaultCol =
                cols.find(c => c.source === 'cc')?.name ||
                cols.find(c => c.name.toLowerCase() === 'species')?.name ||
                cols.find(c => c.type === 'categorical')?.name ||
                cols[0]?.name;

            if (defaultCol) setSelectedColumn(defaultCol);
        }
    }, [data.originalData, data.cc]);

    // Calculate node colors when data or selected column changes
    useEffect(() => {
        if (!data.nodes.length || !selectedColumn) return;

        const newNodeColors: Record<string, string> = {};

        // 0. Check for Pre-calculated Attributes (CC)
        if (data.cc && data.cc[selectedColumn]) {
            const values = data.cc[selectedColumn];
            let min = Infinity;
            let max = -Infinity;

            // Find min/max
            values.forEach(v => {
                if (typeof v === 'number' && !isNaN(v)) {
                    min = Math.min(min, v);
                    max = Math.max(max, v);
                }
            });

            setColumnStats({ min, max });

            data.nodes.forEach((node, idx) => {
                // Assume nodes are ordered same as cc array (created in loop 0..N)
                // Use index from creation or parse ID if safer, but array index is reliable here.
                const val = values[idx];

                if (val !== undefined && min !== Infinity && max !== -Infinity && !isNaN(val)) {
                    const t = (max - min === 0) ? 0.5 : (val - min) / (max - min);
                    const hue = 240 * (1 - t);
                    newNodeColors[node.id] = `hsl(${hue}, 70%, 50%)`;
                } else {
                    newNodeColors[node.id] = '#888';
                }
            });

            setNodeColors(newNodeColors);
            return;
        }

        if (!data.originalData) return;

        // Special handling for direct node values
        if (selectedColumn === 'Node Value' && Array.isArray(data.originalData) && typeof data.originalData[0] === 'number') {
            const values = data.originalData as number[];

            // 1. Calculate stats for numerical (average per node)
            const nodeValues: Record<string, number> = {};
            let min = Infinity;
            let max = -Infinity;

            data.nodes.forEach(node => {
                const indices = Array.isArray(node.indices) ? node.indices : [node.indices];
                if (!indices.length) return;

                // Map indices to values in the flat array
                // Assume indices are 1-based from R, so subtract 1
                const nodeVals = indices.map((idx: number) => values[idx - 1]).filter((v: any) => typeof v === 'number' && !isNaN(v));

                if (nodeVals.length) {
                    const sum = nodeVals.reduce((a: number, b: number) => a + b, 0);
                    const avg = sum / nodeVals.length;
                    nodeValues[node.id] = avg;
                    min = Math.min(min, avg);
                    max = Math.max(max, avg);
                }
            });

            setColumnStats({ min, max });

            // 2. Assign colors
            data.nodes.forEach(node => {
                const val = nodeValues[node.id];
                if (val !== undefined && min !== Infinity && max !== -Infinity) {
                    const t = (max - min === 0) ? 0.5 : (val - min) / (max - min);
                    const hue = 240 * (1 - t);
                    newNodeColors[node.id] = `hsl(${hue}, 70%, 50%)`;
                } else {
                    newNodeColors[node.id] = '#888';
                }
            });

            setNodeColors(newNodeColors);
            return;
        }

        const colDef = columns.find(c => c.name === selectedColumn);
        if (!colDef) return;

        let min = Infinity;
        let max = -Infinity;

        // Helper to get value from original data
        const getValue = (idx: number, col: string) => {
            // Handle 1-based index from R if needed. We assume indices in nodes are 1-based from R.
            // Adjust to 0-based for JS array access.
            const arrayIdx = idx - 1;
            if (Array.isArray(data.originalData)) {
                return data.originalData[arrayIdx]?.[col];
            } else if (data.originalData && (data.originalData as any)[col]) {
                return (data.originalData as any)[col][arrayIdx];
            }
            return undefined;
        };

        if (colDef.type === 'numerical') {
            // 1. Calculate stats for numerical
            const nodeValues: Record<string, number> = {};

            data.nodes.forEach(node => {
                const indices = Array.isArray(node.indices) ? node.indices : [node.indices];
                if (!indices.length) return;

                const values = indices.map((idx: number) => getValue(idx, selectedColumn)).filter((v: any) => typeof v === 'number' && !isNaN(v));
                if (values.length) {
                    const sum = values.reduce((a: number, b: number) => a + b, 0);
                    const avg = sum / values.length;
                    nodeValues[node.id] = avg;
                    min = Math.min(min, avg);
                    max = Math.max(max, avg);
                }
            });

            setColumnStats({ min, max });

            // 2. Assign colors (Blue -> Red gradient)
            data.nodes.forEach(node => {
                const val = nodeValues[node.id];
                if (val !== undefined && min !== Infinity && max !== -Infinity) {
                    const t = (max - min === 0) ? 0.5 : (val - min) / (max - min); // Normalize to [0, 1]
                    const hue = 240 * (1 - t);
                    newNodeColors[node.id] = `hsl(${hue}, 70%, 50%)`;
                } else {
                    newNodeColors[node.id] = '#888';
                }
            });

        } else {
            // Categorical
            setColumnStats(null);
            data.nodes.forEach(node => {
                const indices = Array.isArray(node.indices) ? node.indices : [node.indices];
                const counts: Record<string, number> = {};

                indices.forEach((idx: number) => {
                    const val = getValue(idx, selectedColumn);
                    const key = String(val);
                    counts[key] = (counts[key] || 0) + 1;
                });

                // Find dominant
                let dominant = 'unknown';
                let maxCount = -1;
                Object.entries(counts).forEach(([k, v]) => {
                    if (v > maxCount) {
                        maxCount = v;
                        dominant = k;
                    }
                });

                newNodeColors[node.id] = colorScale(dominant);
            });
        }

        setNodeColors(newNodeColors);

    }, [selectedColumn, columns, data.nodes.length, data.originalData, data.cc]);

    const handleDownloadNodes = () => {
        if (!data.nodes.length) return;

        // Create CSV content
        // Header
        const headers = ["Id", "Label", "Size", "Species", "Indices", "Adjacency"];

        // Rows
        const rows = data.nodes.map(node => {
            // Find connected nodes
            const connectedIds = data.links
                .filter(link => link.source === node.id || link.target === node.id)
                .map(link => link.source === node.id ? link.target : link.source);

            // Remove duplicates and self-loops if any
            const uniqueConnectedIds = Array.from(new Set(connectedIds)).filter(id => id !== node.id);

            // Get raw node data if available to ensure we have all fields
            const rawNode = data.rawNodes?.find((n: any) => n.id === node.id);
            const indices = rawNode?.indices || node.indices;

            return [
                node.id,
                node.name,
                node.val,
                node.species,
                Array.isArray(indices) ? indices.join('|') : indices,
                uniqueConnectedIds.join('|')
            ].map(field => `"${field}"`).join(",");
        });

        const csvContent = [headers.join(","), ...rows].join("\n");
        downloadCSV(csvContent, "mapper_nodes.csv");
    };

    const handleDownloadData = () => {
        if (!data.originalData) return;

        // Convert original data (array of objects) to CSV
        // We assume originalData is an array of objects from R
        // R returns a list of columns, we need to convert to row-based for CSV if it's column-based
        // But our R script returns a data frame which jsonlite converts to array of objects usually

        let csvContent = "";

        if (Array.isArray(data.originalData) && data.originalData.length > 0) {
            const headers = Object.keys(data.originalData[0]);
            const rows = data.originalData.map((row: any) =>
                headers.map(header => `"${row[header]}"`).join(",")
            );
            csvContent = [headers.join(","), ...rows].join("\n");
        } else if (data.originalData && typeof data.originalData === 'object' && Object.keys(data.originalData).length > 0) {
            // Handle column-based format (list of vectors)
            const originalData = data.originalData;
            const columns = Object.keys(originalData);
            const rowCount = (originalData as any)[columns[0]].length;
            const headers = columns;
            const rows = [];
            for (let i = 0; i < rowCount; i++) {
                const row = columns.map(col => `"${(originalData as any)[col][i]}"`);
                rows.push(row.join(","));
            }
            csvContent = [headers.join(","), ...rows].join("\n");
        }

        downloadCSV(csvContent, "mapper_original_data.csv");
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            try {
                const parsedData = JSON.parse(text);

                // Check if it's a Mapper Output (has adjacency)
                if (parsedData.adjacency && parsedData.level_of_vertex) {
                    console.log("Detected Mapper Output JSON. Visualizing directly...");

                    // Stop any ongoing computation
                    computationIdRef.current++;
                    setIsComputing(false);

                    const numVertices = parsedData.num_vertices || parsedData.level_of_vertex.length;
                    const nodes: any[] = [];

                    // Helper to find dominant species (if original_data exists)
                    const getSpecies = (indices: number[]) => {
                        if (!indices || indices.length === 0 || !parsedData.original_data) return "unknown";

                        const originalData = parsedData.original_data;
                        const speciesCounts: Record<string, number> = {};

                        indices.forEach(idx => {
                            // R indices are 1-based
                            let species = "unknown";
                            if (Array.isArray(originalData)) {
                                const row = originalData[idx - 1];
                                if (row) species = row.Species || row.label || "unknown";
                            }
                            speciesCounts[species] = (speciesCounts[species] || 0) + 1;
                        });

                        const entries = Object.entries(speciesCounts);
                        if (entries.length === 0) return "unknown";
                        return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
                    };

                    for (let i = 0; i < numVertices; i++) {
                        let indices = parsedData.points_in_vertex[i];
                        if (typeof indices === 'number') indices = [indices];
                        if (!indices) indices = [];

                        const level = parsedData.level_of_vertex[i];
                        const size = indices.length;
                        const id = `node_${i + 1}`;
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

                    for (let i = 0; i < numVertices; i++) {
                        for (let j = i + 1; j < numVertices; j++) {
                            if (adjacency[i] && adjacency[i][j] === 1) {
                                links.push({
                                    source: nodes[i].id,
                                    target: nodes[j].id,
                                    value: 1
                                });
                            }
                        }
                    }

                    const reverseLinks = links.map(link => ({
                        source: link.target,
                        target: link.source,
                        value: link.value,
                        isReverse: true
                    }));

                    // Normalize CC data (handle row-based array from R/JSON)
                    let ccData = parsedData.cc;
                    console.log("Raw CC Data:", ccData); // Log 1

                    if (Array.isArray(ccData) && ccData.length > 0) {
                        const firstRow = ccData[0];
                        if (typeof firstRow === 'object') {
                            console.log("Detected Array of Objects for CC. Transposing..."); // Log 2
                            const newCC: Record<string, number[]> = {};
                            Object.keys(firstRow).forEach(key => {
                                newCC[key] = ccData.map((row: any) => row[key]);
                            });
                            ccData = newCC;
                        }
                    }
                    console.log("Normalized CC Data:", ccData); // Log 3

                    setData({
                        nodes,
                        links: [...links, ...reverseLinks],
                        originalData: parsedData.original_data,
                        rawNodes: nodes,
                        adjacency: parsedData.adjacency,
                        cc: ccData
                    });

                    if (parsedData.original_data || ccData) {
                        // analyzeData(parsedData.original_data, ccData);
                    }

                } else {
                    // Raw Data
                    console.log("Detected Raw Data. Computing topology...");
                    console.log("Uploaded Data Sample:", Array.isArray(parsedData) ? parsedData[0] : parsedData);

                    // Set source data to trigger Mapper computation
                    onDataUpload(parsedData);

                    // Analyze columns immediately for coloring options
                    analyzeData(parsedData);
                }

            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    };

    // Helper for coloring nodes based on categorical values (generic palette)
    const colorScale = (val: string) => {
        // Simple hash to color
        const hash = val.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 50%)`;
    };

    if (isWebRLoading) {
        return (
            <div className="h-full w-full bg-black flex flex-col items-center justify-center text-zinc-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                <p>Initializing R Environment...</p>
                <p className="text-xs text-zinc-600 mt-2">Downloading WebAssembly binaries</p>
            </div>
        );
    }

    return (
        <div className={`h-full w-full relative overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
            {isComputing && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900/90 px-4 py-2 rounded-full border border-zinc-800 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span className="text-xs text-zinc-300">Computing Topology in R...</span>
                    </div>
                </div>
            )}
            <div className="absolute top-6 right-48 z-50 pointer-events-none flex flex-col items-end gap-2 max-h-[calc(100vh-3rem)] w-64">
                <div className={`backdrop-blur-xl border p-5 rounded-xl text-xs shadow-2xl pointer-events-auto w-full overflow-y-auto ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800 text-zinc-400' : 'bg-white/95 border-zinc-200 text-zinc-600'
                    }`}>
                    <h3 className={`font-bold mb-3 text-sm tracking-wide ${isDarkMode ? 'text-zinc-100' : 'text-zinc-800'}`}>Topology Stats</h3>
                    <div className="flex justify-between mb-2">
                        <span className="font-medium">Nodes (Clusters):</span>
                        <span className={`font-mono ${isDarkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>{data.nodes.length}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="font-medium">Edges (Overlaps):</span>
                        <span className={`font-mono ${isDarkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>{data.links.filter(l => !l.isReverse).length}</span>
                    </div>

                    {/* Column Selection */}
                    {columns.length > 0 && (
                        <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                            <label htmlFor="color-by-select" className="block text-zinc-500 mb-1">Color By:</label>
                            <select
                                id="color-by-select"
                                value={selectedColumn}
                                onChange={(e) => setSelectedColumn(e.target.value)}
                                className={`w-full border rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors text-xs ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-zinc-50 border-zinc-300 text-zinc-800'
                                    }`}
                            >
                                {columns.map(col => (
                                    <option key={col.name} value={col.name}>
                                        {col.source === 'cc' ? '[Metric] ' : ''}{col.name} ({col.type === 'numerical' ? '#' : 'Aa'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className={`mt-4 pt-4 border-t space-y-2.5 ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                        <button
                            onClick={() => setIs3D(!is3D)}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                                }`}
                        >
                            {is3D ? <Square className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
                            Switch to {is3D ? '2D' : '3D'}
                        </button>

                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                                }`}
                        >
                            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                            {isDarkMode ? 'Light' : 'Dark'} Mode
                        </button>

                        <button
                            onClick={() => setUseEdgeWeights(!useEdgeWeights)}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 hover:border-zinc-400'} ${useEdgeWeights && isDarkMode ? 'border-zinc-500' : ''}`}
                        >
                            <Network className="w-3.5 h-3.5" />
                            Weights: {useEdgeWeights ? 'Dynamic' : 'Fixed'}
                        </button>

                        <button
                            onClick={handleDownloadNodes}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                                }`}
                        >
                            <Download className="w-3.5 h-3.5" /> Download Nodes CSV
                        </button>
                        <button
                            onClick={handleDownloadData}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                                }`}
                        >
                            <Download className="w-3.5 h-3.5" /> Download Original Data
                        </button>
                        <label className={`block w-full cursor-pointer px-3 py-2.5 rounded-lg transition-colors border text-center text-xs font-medium ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                            }`}>
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m-4-4v12" /></svg>
                                Upload JSON
                            </span>
                            <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className={`mt-5 pt-3 border-t ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                        <h4 className={`font-bold mb-2.5 text-xs ${isDarkMode ? 'text-zinc-100' : 'text-zinc-800'}`}>Legend</h4>
                        {columns.find(c => c.name === selectedColumn)?.type === 'numerical' && columnStats ? (
                            <div className="flex flex-col gap-1">
                                <div className="h-3 w-full rounded" style={{ background: 'linear-gradient(to right, hsl(240, 70%, 50%), hsl(180, 70%, 50%), hsl(120, 70%, 50%), hsl(60, 70%, 50%), hsl(0, 70%, 50%))' }}></div>
                                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                    <span>{columnStats.min.toFixed(2)}</span>
                                    <span>{columnStats.max.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 max-h-32 overflow-y-auto">
                                <span className="text-[10px] text-zinc-500 italic">Categorical coloring active</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                <p className={`${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'} text-xs`}>
                    Left-click: Rotate • Right-click: Pan • Scroll: Zoom • Drag Node: Move
                </p>
            </div>

            {is3D ? (
                <ForceGraph3D
                    ref={fgRef}
                    graphData={data}
                    nodeLabel="desc"
                    nodeColor={node => nodeColors[node.id!] || (node as any).color || '#888'}
                    nodeRelSize={3}
                    nodeResolution={8}
                    nodeOpacity={0.9}

                    // Link styling
                    linkColor={() => isDarkMode ? '#ffffff20' : '#00000020'}
                    linkWidth={1}
                    linkOpacity={0.6}

                    // Environment
                    backgroundColor={isDarkMode ? "#000000" : "#ffffff"}
                    showNavInfo={false}

                    // Interaction
                    onNodeDragEnd={handleNodeDragEnd}
                    enablePointerInteraction={true}
                />
            ) : (
                <ForceGraph2D
                    ref={fgRef}
                    graphData={data}
                    nodeLabel="desc"
                    // Use custom rendering for black edges
                    nodeCanvasObject={drawNode2D}
                    nodePointerAreaPaint={drawNodePointerArea2D}

                    // Link styling
                    linkColor={() => isDarkMode ? '#ffffff20' : '#00000020'}
                    linkWidth={1}

                    // Environment
                    backgroundColor={isDarkMode ? "#000000" : "#ffffff"}

                    // Interaction
                    onNodeDragEnd={handleNodeDragEnd}
                    enablePointerInteraction={true}
                />
            )}
        </div>
    );
}
