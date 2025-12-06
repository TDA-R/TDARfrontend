'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebR } from './WebRProvider';
import { runMapperAlgo } from '@/lib/r-script';
import { Download } from 'lucide-react';

// Dynamically import ForceGraph3D with no SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-zinc-500">Loading Graph Engine...</div>
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
}

interface MapperGraphProps {
    interval: number;
    overlap: number;
    clusteringMethod: string;
}

export function MapperGraph({ interval, overlap, clusteringMethod }: MapperGraphProps) {
    const { webR, isLoading: isWebRLoading } = useWebR();
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [isComputing, setIsComputing] = useState(false);
    const fgRef = useRef<any>(null);

    // Dynamic Coloring State
    const [columns, setColumns] = useState<{ name: string; type: 'numerical' | 'categorical' }[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<string>('');
    const [nodeColors, setNodeColors] = useState<Record<string, string>>({});
    const [columnStats, setColumnStats] = useState<{ min: number; max: number } | null>(null);

    // Run Mapper Algorithm using WebR
    useEffect(() => {
        if (!webR || isWebRLoading) return;

        const computeGraph = async () => {
            setIsComputing(true);
            console.log("Starting Mapper computation...");
            try {
                const graphData = await runMapperAlgo(webR, interval, overlap, clusteringMethod);
                console.log("Mapper computation result:", graphData);
                if (graphData) {
                    setData(graphData);
                }
            } catch (error) {
                console.error("Error running Mapper:", error);
            } finally {
                setIsComputing(false);
            }
        };

        // Debounce to avoid too many R calls
        const timer = setTimeout(computeGraph, 500);
        return () => clearTimeout(timer);
    }, [webR, isWebRLoading, interval, overlap, clusteringMethod]);

    const handleNodeDragEnd = useCallback((node: any) => {
        // Lock the node position after dragging
        node.fx = node.x;
        node.fy = node.y;
        node.fz = node.z;
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

        // Safety check for empty data
        if (Array.isArray(originalData) && originalData.length === 0) return;
        if (typeof originalData === 'object' && !Array.isArray(originalData) && Object.keys(originalData).length === 0) return;

        // Check for direct node values (flat numeric array)
        if (Array.isArray(originalData) && typeof originalData[0] === 'number') {
            console.log("Detected direct node values.");
            setColumns([{ name: 'Node Value', type: 'numerical' }]);
            setSelectedColumn('Node Value');
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
            console.warn("Could not determine data structure from original_data");
            return;
        }

        const keys = Object.keys(firstRow);

        const cols = keys.map(key => {
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
            return { name: key, type };
        });

        setColumns(cols);

        // Default to Species if exists, else first categorical, else first numerical
        if (!selectedColumn || !cols.find(c => c.name === selectedColumn)) {
            const defaultCol = cols.find(c => c.name.toLowerCase() === 'species') || cols.find(c => c.type === 'categorical') || cols[0];
            if (defaultCol) setSelectedColumn(defaultCol.name);
        }
    }, [data.originalData]);

    // Calculate node colors when data or selected column changes
    useEffect(() => {
        if (!data.nodes.length || !selectedColumn || !data.originalData) return;

        const newNodeColors: Record<string, string> = {};

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

    }, [selectedColumn, columns, data.nodes.length, data.originalData]);

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
        } else if (typeof data.originalData === 'object' && Object.keys(data.originalData).length > 0) {
            // Handle column-based format (list of vectors)
            const columns = Object.keys(data.originalData);
            const rowCount = data.originalData[columns[0]].length;
            const headers = columns;
            const rows = [];
            for (let i = 0; i < rowCount; i++) {
                const row = columns.map(col => `"${data.originalData[col][i]}"`);
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
            try {
                const json = JSON.parse(e.target?.result as string);
                console.log("Uploaded JSON:", json);

                // Validate structure (TDAmapper style)
                if (!json.adjacency || !json.points_in_vertex || !json.level_of_vertex) {
                    alert("Invalid file format. Expected TDAmapper JSON structure (adjacency, points_in_vertex, level_of_vertex).");
                    return;
                }

                const numVertices = json.num_vertices || json.level_of_vertex.length;
                const nodes: any[] = [];
                const originalData = json.original_data;
                console.log("Original Data Type:", Array.isArray(originalData) ? "Array" : typeof originalData);
                if (Array.isArray(originalData)) console.log("Rows:", originalData.length);
                else if (originalData) console.log("Keys:", Object.keys(originalData));

                // Helper to find dominant species
                const getSpecies = (indices: number[]) => {
                    if (!indices || indices.length === 0 || !originalData) return "unknown";

                    const speciesCounts: Record<string, number> = {};
                    indices.forEach(idx => {
                        let species = "unknown";
                        // Handle 1-based indices from R if needed (usually R indices are 1-based)
                        // We'll try idx-1 first if originalData is array
                        if (Array.isArray(originalData)) {
                            const row = originalData[idx - 1];
                            if (row) species = (row as any).Species || (row as any).species || "unknown";
                        } else if ((originalData as any).Species) {
                            species = (originalData as any).Species[idx - 1];
                        }
                        speciesCounts[species] = (speciesCounts[species] || 0) + 1;
                    });

                    // Find max
                    const entries = Object.entries(speciesCounts);
                    if (entries.length === 0) return "unknown";
                    return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
                };

                for (let i = 0; i < numVertices; i++) {
                    let indices = json.points_in_vertex[i];

                    // Fix: Handle unboxed single numbers from R JSON
                    if (typeof indices === 'number') {
                        indices = [indices];
                    } else if (!indices) {
                        indices = [];
                    }

                    const level = json.level_of_vertex[i];
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
                const adjacency = json.adjacency;

                if (Array.isArray(adjacency)) {
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
                }

                const reverseLinks = links.map(link => ({
                    source: link.target,
                    target: link.source,
                    value: link.value,
                    isReverse: true
                }));

                setData({
                    nodes,
                    links: [...links, ...reverseLinks],
                    originalData: json.original_data,
                    rawNodes: nodes,
                });

            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Error parsing JSON file.");
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
        <div className="h-full w-full bg-black relative overflow-hidden">
            {isComputing && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900/90 px-4 py-2 rounded-full border border-zinc-800 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span className="text-xs text-zinc-300">Computing Topology in R...</span>
                    </div>
                </div>
            )}
            <div className="absolute top-6 right-48 z-50 pointer-events-none flex flex-col items-end gap-2 max-h-[calc(100vh-3rem)] w-64">
                <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 p-5 rounded-xl text-xs text-zinc-400 shadow-2xl pointer-events-auto w-full overflow-y-auto">
                    <h3 className="text-zinc-100 font-bold mb-3 text-sm tracking-wide">Topology Stats</h3>
                    <div className="flex justify-between mb-2">
                        <span className="font-medium">Nodes (Clusters):</span>
                        <span className="text-zinc-200 font-mono">{data.nodes.length}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span className="font-medium">Edges (Overlaps):</span>
                        <span className="text-zinc-200 font-mono">{data.links.filter(l => !l.isReverse).length}</span>
                    </div>

                    {/* Column Selection */}
                    {columns.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                            <label htmlFor="color-by-select" className="block text-zinc-500 mb-1">Color By:</label>
                            <select
                                id="color-by-select"
                                value={selectedColumn}
                                onChange={(e) => setSelectedColumn(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors text-xs"
                            >
                                {columns.map(col => (
                                    <option key={col.name} value={col.name}>
                                        {col.name} ({col.type === 'numerical' ? '#' : 'Aa'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2.5">
                        <button
                            onClick={handleDownloadNodes}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-lg transition-all border border-zinc-700 hover:border-zinc-600 font-medium active:scale-95"
                        >
                            <Download className="w-3.5 h-3.5" /> Download Nodes CSV
                        </button>
                        <button
                            onClick={handleDownloadData}
                            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-lg transition-all border border-zinc-700 hover:border-zinc-600 font-medium active:scale-95"
                        >
                            <Download className="w-3.5 h-3.5" /> Download Original Data
                        </button>
                        <label className="block w-full cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2.5 rounded-lg transition-colors border border-zinc-700 text-center text-xs font-medium">
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m-4-4v12" /></svg>
                                Upload JSON
                            </span>
                            <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
                        </label>
                    </div>

                    <div className="mt-5 pt-3 border-t border-zinc-800">
                        <h4 className="text-zinc-100 font-bold mb-2.5 text-xs">Legend</h4>
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
                <p className="text-zinc-500 text-xs">
                    Left-click: Rotate • Right-click: Pan • Scroll: Zoom • Drag Node: Move
                </p>
            </div>

            <ForceGraph3D
                ref={fgRef}
                graphData={data}
                nodeLabel="desc"
                nodeColor={node => nodeColors[node.id] || (node as any).color || '#888'}
                nodeRelSize={6}
                nodeResolution={8} // Reduced resolution for potentially better performance
                nodeOpacity={0.9}

                // Link styling
                linkColor={() => '#ffffff20'} // Softer link color
                linkWidth={1} // Uniform link width
                linkOpacity={0.6} // Increased link opacity

                // Environment
                backgroundColor="#000000"
                showNavInfo={false}

                // Interaction
                onNodeDragEnd={handleNodeDragEnd}
                enablePointerInteraction={true}

                // Particles for visual flair (data flowing) - Bidirectional now
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.005}
            />
        </div>
    );
}
