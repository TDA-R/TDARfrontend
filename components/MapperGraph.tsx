'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useWebR } from './WebRProvider';
import { runMapperAlgo } from '@/lib/r-script';
import { Download, Box, Square, Sun, Moon, Network, Play, ChevronDown, ChevronRight, Table2, BarChart2, X } from 'lucide-react';

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
    onGraphStats?: (nodeCount: number, edgeCount: number) => void;
}

export function MapperGraph({ interval, overlap, clusteringMethod, sourceData, onDataUpload, onGraphStats }: MapperGraphProps) {
    const { webR, isLoading: isWebRLoading } = useWebR();
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [isComputing, setIsComputing] = useState(false);
    const [is3D, setIs3D] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [useEdgeWeights, setUseEdgeWeights] = useState(true);
    const computationIdRef = useRef(0);
    const fgRef = useRef<any>(null);
    const portalSlotRef = useRef<HTMLElement | null>(null);
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => {
        const el = document.getElementById('sidebar-controls-slot');
        if (el) { portalSlotRef.current = el; setPortalReady(true); }
    }, []);

    // Dynamic Coloring State
    const [columns, setColumns] = useState<{ name: string; type: 'numerical' | 'categorical'; source?: 'cc' | 'data' }[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<string>('');
    const [nodeColors, setNodeColors] = useState<Record<string, string>>({});
    const [columnStats, setColumnStats] = useState<{ min: number; max: number } | null>(null);
    const [categoricalLegend, setCategoricalLegend] = useState<{ label: string; color: string }[]>([]);

    // Mapper Analytics State
    interface MapperStats {
        nodeCount: number;
        edgeCount: number;
        avgClusterSize: number;
        maxClusterSize: number;
        connectedComponents: number;
        clusterSizeHist: { bin: string; count: number }[];
        degreeHist: { bin: string; count: number }[];
        labelDist: { col: string; counts: { label: string; count: number; pct: number }[] }[];
    }
    const [mapperStats, setMapperStats] = useState<MapperStats | null>(null);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(true);

    // Node EDA State
    interface ColDist {
        name: string;
        type: 'categorical' | 'numerical';
        // categorical
        counts?: { label: string; count: number }[];
        // numerical
        bins?: { bin: string; lo: number; hi: number; count: number }[];
        min?: number; max?: number; mean?: number;
    }
    interface NodeEDA {
        nodeId: string;
        nodeName: string;
        size: number;
        cols: ColDist[];
    }
    const [selectedNodeEDA, setSelectedNodeEDA] = useState<NodeEDA | null>(null);

    // Node click → EDA
    const handleNodeClick = useCallback((node: any) => {
        const originalData = data.originalData as any[] | undefined;
        if (!originalData || !originalData.length) return;
        const indices: number[] = Array.isArray(node.indices) ? node.indices : [];
        const rows = indices.length > 0
            ? indices.map(i => originalData[i]).filter(Boolean)
            : [];
        if (!rows.length) return;

        const firstRow = rows[0];
        if (typeof firstRow !== 'object' || firstRow === null) return;
        const keys = Object.keys(firstRow);

        const cols: ColDist[] = keys.map(key => {
            const vals = rows.map(r => r[key]).filter(v => v !== null && v !== undefined && v !== '');
            const isNum = vals.length > 0 && vals.every(v => typeof v === 'number' && !isNaN(v));
            if (isNum) {
                const nums = vals as number[];
                const min = Math.min(...nums);
                const max = Math.max(...nums);
                const mean = nums.reduce((a: number, b: number) => a + b, 0) / nums.length;
                const BIN_COUNT = Math.min(5, nums.length);
                const binWidth = BIN_COUNT > 1 ? (max - min) / BIN_COUNT : 1;
                const bins = Array.from({ length: BIN_COUNT }, (_, i) => {
                    const lo = min + i * binWidth;
                    const hi = i === BIN_COUNT - 1 ? max : min + (i + 1) * binWidth;
                    const count = nums.filter(n => n >= lo && (i === BIN_COUNT - 1 ? n <= hi : n < hi)).length;
                    const loR = parseFloat(lo.toFixed(1));
                    const hiR = parseFloat(hi.toFixed(1));
                    return { bin: loR === hiR ? `${loR}` : `${loR}–${hiR}`, lo, hi, count };
                });
                return { name: key, type: 'numerical' as const, bins, min, max, mean };
            } else {
                const strVals = vals.map(v => String(v));
                const countMap: Record<string, number> = {};
                strVals.forEach(v => { countMap[v] = (countMap[v] || 0) + 1; });
                const counts = Object.entries(countMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([label, count]) => ({ label, count }));
                return { name: key, type: 'categorical' as const, counts };
            }
        });

        setSelectedNodeEDA({
            nodeId: node.id,
            nodeName: node.name || node.id,
            size: rows.length,
            cols,
        });
    }, [data.originalData]);

    // Manual trigger for running the toy model (Iris dataset)
    const runToyModel = useCallback(async () => {
        if (!webR || isWebRLoading || isComputing) return;

        const reqId = ++computationIdRef.current;
        setIsComputing(true);
        console.log("Starting Toy Model (Iris) Mapper computation...");
        try {
            const graphData = await runMapperAlgo(webR, interval, overlap, clusteringMethod, null);
            if (computationIdRef.current !== reqId) return;
            console.log("Mapper computation result:", graphData);
            if (graphData) {
                setData(graphData);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [webR, isWebRLoading, interval, overlap, clusteringMethod]);

    // Auto-run when user uploads new data (sourceData changes)
    const prevSourceDataRef = useRef<any[] | null>(null);
    useEffect(() => {
        if (!webR || isWebRLoading || !sourceData) return;
        if (sourceData === prevSourceDataRef.current) return;
        prevSourceDataRef.current = sourceData;

        const reqId = ++computationIdRef.current;
        setIsComputing(true);
        console.log("Running Mapper on uploaded data...");
        const computeGraph = async () => {
            try {
                const graphData = await runMapperAlgo(webR, interval, overlap, clusteringMethod, sourceData);
                if (computationIdRef.current !== reqId) return;
                if (graphData) {
                    setData(graphData);
                    if (graphData.originalData) analyzeData(graphData.originalData);
                }
            } catch (error) {
                if (computationIdRef.current !== reqId) return;
                console.error("Error running Mapper on uploaded data:", error);
            } finally {
                if (computationIdRef.current === reqId) setIsComputing(false);
            }
        };
        const timer = setTimeout(computeGraph, 500);
        return () => clearTimeout(timer);
    }, [webR, isWebRLoading, sourceData, interval, overlap, clusteringMethod]);

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
                const values = cc[key] as any[];
                let type: 'numerical' | 'categorical' = 'numerical';

                // Check if actually numerical
                if (Array.isArray(values)) {
                    // Check sample to see if any non-numbers exist
                    const sample = values.slice(0, 10);
                    for (const v of sample) {
                        if (v !== null && v !== undefined && v !== '' && (typeof v !== 'number' || isNaN(v))) {
                            type = 'categorical';
                            break;
                        }
                    }
                }

                cols.push({ name: key, type, source: 'cc' });
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
            const sampleSize = Math.min(Array.isArray(originalData) ? originalData.length : 10, 10);

            let isNumerical = true;
            let hasValidData = false;

            for (let i = 0; i < sampleSize; i++) {
                const val = Array.isArray(originalData) ? originalData[i][key] : (originalData as any)[key]?.[i];

                if (val !== null && val !== undefined && val !== '') {
                    hasValidData = true;
                    if (typeof val !== 'number' || isNaN(val)) {
                        isNumerical = false;
                        break;
                    }
                }
            }

            if (hasValidData && isNumerical) {
                type = 'numerical';
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

    // Compute Mapper Analytics when graph data changes
    useEffect(() => {
        const nodes = data.nodes;
        const links = data.links.filter((l: any) => !l.isReverse);

        if (!nodes.length) {
            setMapperStats(null);
            return;
        }

        const edgeCount = links.length;
        const sizes = nodes.map((n: any) => typeof n.val === 'number' ? n.val : (Array.isArray(n.indices) ? n.indices.length : 1));
        const avgClusterSize = sizes.reduce((a: number, b: number) => a + b, 0) / sizes.length;
        const maxClusterSize = Math.max(...sizes);

        // Degree per node
        const degreeMap: Record<string, number> = {};
        nodes.forEach((n: any) => { degreeMap[n.id] = 0; });
        links.forEach((l: any) => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            degreeMap[s] = (degreeMap[s] || 0) + 1;
            degreeMap[t] = (degreeMap[t] || 0) + 1;
        });

        // Connected components via Union-Find
        const parent: Record<string, string> = {};
        nodes.forEach((n: any) => { parent[n.id] = n.id; });
        const find = (x: string): string => parent[x] === x ? x : (parent[x] = find(parent[x]));
        links.forEach((l: any) => {
            const s = typeof l.source === 'object' ? l.source.id : l.source;
            const t = typeof l.target === 'object' ? l.target.id : l.target;
            const ps = find(s), pt = find(t);
            if (ps !== pt) parent[ps] = pt;
        });
        const connectedComponents = new Set(nodes.map((n: any) => find(n.id))).size;

        // Cluster size histogram (5 bins)
        const sizeMin = Math.min(...sizes);
        const sizeMax = Math.max(...sizes);
        const sizeBinCount = Math.min(5, sizeMax - sizeMin + 1);
        const sizeBinWidth = sizeBinCount > 1 ? (sizeMax - sizeMin) / sizeBinCount : 1;
        const sizeBins = Array.from({ length: sizeBinCount }, (_, i) => ({
            lo: Math.round(sizeMin + i * sizeBinWidth),
            hi: Math.round(sizeMin + (i + 1) * sizeBinWidth - (i === sizeBinCount - 1 ? 0 : 1))
        }));
        const clusterSizeHist = sizeBins.map(({ lo, hi }) => ({
            bin: lo === hi ? `${lo}` : `${lo}-${hi}`,
            count: sizes.filter((s: number) => s >= lo && s <= hi).length
        }));

        // Degree histogram (5 bins)
        const degrees = Object.values(degreeMap);
        const degMin = Math.min(...degrees);
        const degMax = Math.max(...degrees);
        const degBinCount = Math.min(5, degMax - degMin + 1);
        const degBinWidth = degBinCount > 1 ? (degMax - degMin) / degBinCount : 1;
        const degBins = Array.from({ length: degBinCount }, (_, i) => ({
            lo: Math.round(degMin + i * degBinWidth),
            hi: Math.round(degMin + (i + 1) * degBinWidth - (i === degBinCount - 1 ? 0 : 1))
        }));
        const degreeHist = degBins.map(({ lo, hi }) => ({
            bin: lo === hi ? `${lo}` : `${lo}-${hi}`,
            count: degrees.filter((d: number) => d >= lo && d <= hi).length
        }));

        setMapperStats({ nodeCount: nodes.length, edgeCount, avgClusterSize, maxClusterSize, connectedComponents, clusterSizeHist, degreeHist, labelDist: [] });
        onGraphStats?.(nodes.length, edgeCount);
    }, [data.nodes, data.links]);

    // Compute label distribution from originalData (separate effect so it updates when data loads)
    useEffect(() => {
        setMapperStats(prev => {
            if (!prev) return prev;
            const originalData = data.originalData as any[] | undefined;
            if (!originalData || !Array.isArray(originalData) || originalData.length === 0) return { ...prev, labelDist: [] };
            const firstRow = originalData[0];
            if (typeof firstRow !== 'object' || firstRow === null) return { ...prev, labelDist: [] };
            const COLORS_CYCLE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];
            const labelDist = Object.keys(firstRow)
                .filter(key => {
                    const sample = originalData.slice(0, 10).map(r => r[key]).filter(v => v !== null && v !== undefined && v !== '');
                    return sample.length > 0 && !sample.every(v => typeof v === 'number' && !isNaN(v));
                })
                .map(col => {
                    const countMap: Record<string, number> = {};
                    originalData.forEach(row => {
                        const v = String(row[col] ?? '');
                        if (v !== '') countMap[v] = (countMap[v] || 0) + 1;
                    });
                    const total = Object.values(countMap).reduce((a, b) => a + b, 0);
                    const counts = Object.entries(countMap)
                        .sort((a, b) => b[1] - a[1])
                        .map(([label, count], i) => ({ label, count, pct: count / total, color: COLORS_CYCLE[i % COLORS_CYCLE.length] }));
                    return { col, counts };
                });
            return { ...prev, labelDist };
        });
    }, [data.originalData]);



    // Calculate node colors when data or selected column changes
    useEffect(() => {
        if (!data.nodes.length || !selectedColumn) return;

        const newNodeColors: Record<string, string> = {};

        // 0. Check for Pre-calculated Attributes (CC)
        if (data.cc && data.cc[selectedColumn]) {
            const values = data.cc[selectedColumn] as any[];
            const colDef = columns.find(c => c.name === selectedColumn);

            if (colDef && colDef.type === 'categorical') {
                // Categorical CC
                setColumnStats(null);
                const legendMap = new Map<string, string>();

                data.nodes.forEach((node, idx) => {
                    const val = values[idx];
                    // Use string value for color hash
                    const strVal = String(val ?? 'unknown');
                    const color = colorScale(strVal);
                    newNodeColors[node.id] = color;
                    if (!legendMap.has(strVal)) legendMap.set(strVal, color);
                });
                setCategoricalLegend(Array.from(legendMap.entries()).map(([label, color]) => ({ label, color })).sort((a, b) => a.label.localeCompare(b.label)));
            } else {
                // Numerical CC
                setCategoricalLegend([]);
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
                    // Assume nodes are ordered same as cc array
                    const val = values[idx];

                    if (val !== undefined && min !== Infinity && max !== -Infinity && typeof val === 'number' && !isNaN(val)) {
                        const t = (max - min === 0) ? 0.5 : (val - min) / (max - min);
                        const hue = 240 * (1 - t);
                        newNodeColors[node.id] = `hsl(${hue}, 70%, 50%)`;
                    } else {
                        newNodeColors[node.id] = '#888';
                    }
                });
            }

            setNodeColors(newNodeColors);
            return;
        }

        if (!data.originalData) return;

        // Special handling for direct node values
        if (selectedColumn === 'Node Value' && Array.isArray(data.originalData) && typeof data.originalData[0] === 'number') {
            setCategoricalLegend([]);
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
            setCategoricalLegend([]);
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
            const legendMap = new Map<string, string>();
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
                if (!legendMap.has(dominant)) legendMap.set(dominant, colorScale(dominant));
            });
            setCategoricalLegend(Array.from(legendMap.entries()).map(([label, color]) => ({ label, color })).sort((a, b) => a.label.localeCompare(b.label)));
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
            {/* Controls Portal: rendered into Sidebar via portal */}
            {portalReady && portalSlotRef.current && createPortal(
                <div style={{ display: 'block', width: '100%' }} className="space-y-2 text-xs text-zinc-400">

                    {/* Column Selection */}
                    {columns.length > 0 && (
                        <div style={{ width: '100%' }} className={`pt-3 border-t ${isDarkMode ? 'border-zinc-700' : 'border-zinc-200'}`}>
                            <label htmlFor="color-by-select" className="block text-zinc-500 mb-1 text-xs">Color By:</label>
                            <select
                                id="color-by-select"
                                value={selectedColumn}
                                onChange={(e) => setSelectedColumn(e.target.value)}
                                style={{ width: '100%' }}
                                className={`border rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 transition-colors text-xs ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-zinc-50 border-zinc-300 text-zinc-800'}`}
                            >
                                {columns.map(col => (
                                    <option key={col.name} value={col.name}>
                                        {col.source === 'cc' ? '[Metric] ' : ''}{col.name} ({col.type === 'numerical' ? '#' : 'Aa'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ width: '100%' }} className={`pt-3 border-t space-y-2.5 ${isDarkMode ? 'border-zinc-700' : 'border-zinc-200'}`}>
                        <button
                            onClick={runToyModel}
                            disabled={isComputing || isWebRLoading || !!sourceData}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 hover:border-blue-400' : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-400 hover:border-blue-500'}`}
                        >
                            <Play className="w-3.5 h-3.5" />
                            Run Toy Model (Iris)
                        </button>

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
                </div>,
                portalSlotRef.current
            )}


            {/* Right Panel: Legend + Mapper Analytics */}
            <div className="absolute top-6 bottom-6 right-6 z-[100] pointer-events-none flex flex-col gap-3 w-[280px]">
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100%-200px)] scrollbar-hide">
                {/* Legend Card */}
                <div className={`backdrop-blur-xl border p-4 rounded-xl text-xs shadow-2xl pointer-events-auto w-full ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800 text-zinc-400' : 'bg-white/95 border-zinc-200 text-zinc-600'}`}>
                    <h4 className={`font-bold mb-2.5 text-xs ${isDarkMode ? 'text-zinc-100' : 'text-zinc-800'}`}>Legend</h4>
                    {columns.find(c => c.name === selectedColumn)?.type === 'numerical' && columnStats ? (
                        <div className="flex flex-col gap-1">
                            <div className="h-3 w-full rounded" style={{ background: 'linear-gradient(to right, hsl(240, 70%, 50%), hsl(180, 70%, 50%), hsl(120, 70%, 50%), hsl(60, 70%, 50%), hsl(0, 70%, 50%))' }}></div>
                            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                <span>{columnStats.min.toFixed(2)}</span>
                                <span>{columnStats.max.toFixed(2)}</span>
                            </div>
                        </div>
                    ) : categoricalLegend.length > 0 ? (
                        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                            {categoricalLegend.map(item => (
                                <div key={item.label} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }}></div>
                                    <span className={`text-[10px] truncate ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`} title={item.label}>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="text-[10px] text-zinc-500 italic">No legend data</span>
                    )}
                </div>

                {/* Mapper Analytics Card */}
                {mapperStats && (
                    <div className={`flex-1 flex flex-col backdrop-blur-xl border rounded-xl text-xs shadow-2xl pointer-events-auto w-full overflow-hidden ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800 text-zinc-400' : 'bg-white/95 border-zinc-200 text-zinc-600'}`}>
                        <button
                            onClick={() => setIsAnalyticsOpen(v => !v)}
                            className={`w-full flex items-center justify-between px-4 py-3 font-bold text-xs tracking-wide ${isDarkMode ? 'text-zinc-100 hover:bg-zinc-800/50' : 'text-zinc-800 hover:bg-zinc-50'} transition-colors`}
                        >
                            <span className="flex items-center gap-2">
                                <BarChart2 className="w-3.5 h-3.5" />
                                Graph Analytics
                            </span>
                            {isAnalyticsOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        </button>
                        {isAnalyticsOpen && (
                            <div className={`border-t px-4 pb-4 pt-3 space-y-3 ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {[
                                        { label: 'Nodes', value: mapperStats.nodeCount },
                                        { label: 'Edges', value: mapperStats.edgeCount },
                                        { label: 'Components', value: mapperStats.connectedComponents },
                                        { label: 'Max Size', value: mapperStats.maxClusterSize },
                                    ].map(({ label, value }) => (
                                        <div key={label} className={`rounded-lg px-2 py-1.5 text-center ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                                            <div className={`text-[9px] font-medium ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</div>
                                            <div className={`text-sm font-bold font-mono ${isDarkMode ? 'text-zinc-100' : 'text-zinc-800'}`}>{value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className={`text-[10px] font-mono ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                    Avg cluster size: <span className={isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}>{mapperStats.avgClusterSize.toFixed(1)}</span>
                                </div>
                                <div>
                                    <p className={`text-[10px] font-semibold mb-1.5 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Cluster Size Distribution</p>
                                    {(() => {
                                        const maxCount = Math.max(...mapperStats.clusterSizeHist.map(b => b.count), 1);
                                        const barColor = isDarkMode ? '#3b82f6' : '#2563eb';
                                        const W = 220, H = 52, pad = 12;
                                        const bw = (W - pad - 4) / mapperStats.clusterSizeHist.length;
                                        return (
                                            <svg width={W} height={H + 16} className="overflow-visible">
                                                {mapperStats.clusterSizeHist.map((b, i) => {
                                                    const bh = Math.max(2, (b.count / maxCount) * H);
                                                    const x = pad + i * bw;
                                                    const y = H - bh;
                                                    return (
                                                        <g key={i}>
                                                            <rect x={x + 1} y={y} width={bw - 3} height={bh} rx={2} fill={barColor} opacity={0.85} />
                                                            <text x={x + bw / 2} y={H + 11} textAnchor="middle" fontSize={7} fill={isDarkMode ? '#71717a' : '#9ca3af'}>{b.bin}</text>
                                                            {b.count > 0 && <text x={x + bw / 2} y={y - 2} textAnchor="middle" fontSize={7} fill={isDarkMode ? '#a1a1aa' : '#6b7280'}>{b.count}</text>}
                                                        </g>
                                                    );
                                                })}
                                                <line x1={pad} y1={0} x2={pad} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                                <line x1={pad} y1={H} x2={W} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                            </svg>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <p className={`text-[10px] font-semibold mb-1.5 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Degree Distribution</p>
                                    {(() => {
                                        const maxCount = Math.max(...mapperStats.degreeHist.map(b => b.count), 1);
                                        const barColor = isDarkMode ? '#8b5cf6' : '#7c3aed';
                                        const W = 220, H = 52, pad = 12;
                                        const bw = (W - pad - 4) / mapperStats.degreeHist.length;
                                        return (
                                            <svg width={W} height={H + 16} className="overflow-visible">
                                                {mapperStats.degreeHist.map((b, i) => {
                                                    const bh = Math.max(2, (b.count / maxCount) * H);
                                                    const x = pad + i * bw;
                                                    const y = H - bh;
                                                    return (
                                                        <g key={i}>
                                                            <rect x={x + 1} y={y} width={bw - 3} height={bh} rx={2} fill={barColor} opacity={0.85} />
                                                            <text x={x + bw / 2} y={H + 11} textAnchor="middle" fontSize={7} fill={isDarkMode ? '#71717a' : '#9ca3af'}>{b.bin}</text>
                                                            {b.count > 0 && <text x={x + bw / 2} y={y - 2} textAnchor="middle" fontSize={7} fill={isDarkMode ? '#a1a1aa' : '#6b7280'}>{b.count}</text>}
                                                        </g>
                                                    );
                                                })}
                                                <line x1={pad} y1={0} x2={pad} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                                <line x1={pad} y1={H} x2={W} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                            </svg>
                                        );
                                    })()}
                                </div>
                                {/* Label Distribution */}
                                {mapperStats.labelDist && mapperStats.labelDist.length > 0 && (
                                    <div>
                                        <p className={`text-[10px] font-semibold mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>Label Distribution</p>
                                        {mapperStats.labelDist.map(ld => {
                                            const COLORS_CYCLE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];
                                            return (
                                                <div key={ld.col} className="mb-3">
                                                    <p className={`text-[9px] uppercase tracking-wider mb-1 ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>{ld.col}</p>
                                                    {/* Stacked bar */}
                                                    <div className="flex w-full h-3 rounded overflow-hidden mb-1.5">
                                                        {ld.counts.map((c, i) => (
                                                            <div
                                                                key={c.label}
                                                                title={`${c.label}: ${c.count} (${(c.pct * 100).toFixed(1)}%)`}
                                                                style={{ width: `${c.pct * 100}%`, background: COLORS_CYCLE[i % COLORS_CYCLE.length] }}
                                                            />
                                                        ))}
                                                    </div>
                                                    {/* Legend dots */}
                                                    <div className="flex flex-col gap-0.5">
                                                        {ld.counts.map((c, i) => (
                                                            <div key={c.label} className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS_CYCLE[i % COLORS_CYCLE.length] }} />
                                                                <span className={`text-[9px] truncate ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} title={c.label}>{c.label}</span>
                                                                <span className={`text-[9px] font-mono ml-auto shrink-0 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>{c.count} ({(c.pct * 100).toFixed(0)}%)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                </div>
                {/* Node EDA: Click to Explore */}
                <div className={`flex-1 flex flex-col backdrop-blur-xl border rounded-xl text-xs shadow-2xl pointer-events-auto w-full overflow-hidden ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800 text-zinc-400' : 'bg-white/95 border-zinc-200 text-zinc-600'}`}>
                    <div className={`flex items-center gap-2 px-4 py-3 border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedNodeEDA ? (nodeColors[selectedNodeEDA.nodeId] || '#888') : (isDarkMode ? '#3f3f46' : '#d4d4d8') }} />
                        <span className={`font-bold text-xs ${isDarkMode ? 'text-zinc-100' : 'text-zinc-800'}`}>
                            {selectedNodeEDA ? selectedNodeEDA.nodeName : 'Node Inspector'}
                        </span>
                        {selectedNodeEDA && (
                            <>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>{selectedNodeEDA.size} pts</span>
                                <button onClick={() => setSelectedNodeEDA(null)} className={`ml-auto p-0.5 rounded hover:bg-zinc-700/50 transition-colors ${isDarkMode ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-700'}`}>
                                    <X className="w-3 h-3" />
                                </button>
                            </>
                        )}
                    </div>
                    {selectedNodeEDA ? (
                        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                            <div className="flex gap-3 px-4 py-3" style={{ minWidth: 'max-content' }}>
                                {selectedNodeEDA.cols.map(col => {
                                    if (col.type === 'categorical' && col.counts) {
                                        const maxC = Math.max(...col.counts.map(c => c.count), 1);
                                        const W = Math.max(80, col.counts.length * 26 + 16);
                                        const H = 44, pad = 14;
                                        const bw = (W - pad) / col.counts.length;
                                        const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
                                        return (
                                            <div key={col.name} className="flex flex-col items-start shrink-0">
                                                <p className={`text-[8px] font-semibold mb-1 uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>{col.name}</p>
                                                <svg width={W} height={H + 18} className="overflow-visible">
                                                    {col.counts.map((c, i) => {
                                                        const bh = Math.max(2, (c.count / maxC) * H);
                                                        const x = pad + i * bw;
                                                        const y = H - bh;
                                                        return (
                                                            <g key={c.label}>
                                                                <rect x={x + 1} y={y} width={bw - 3} height={bh} rx={2} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                                                                <text x={x + bw / 2} y={H + 9} textAnchor="middle" fontSize={6.5} fill={isDarkMode ? '#71717a' : '#9ca3af'} transform={`rotate(-30, ${x + bw/2}, ${H + 9})`}>{c.label.length > 7 ? c.label.slice(0,6)+'…' : c.label}</text>
                                                                <text x={x + bw / 2} y={y - 2} textAnchor="middle" fontSize={7} fontWeight="600" fill={isDarkMode ? '#e4e4e7' : '#3f3f46'}>{c.count}</text>
                                                            </g>
                                                        );
                                                    })}
                                                    <line x1={pad} y1={0} x2={pad} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                                    <line x1={pad} y1={H} x2={W} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                                </svg>
                                            </div>
                                        );
                                    } else if (col.type === 'numerical' && col.bins) {
                                        const maxC = Math.max(...col.bins.map(b => b.count), 1);
                                        const W = Math.max(80, col.bins.length * 24 + 16);
                                        const H = 44, pad = 14;
                                        const bw = (W - pad) / col.bins.length;
                                        return (
                                            <div key={col.name} className="flex flex-col items-start shrink-0">
                                                <p className={`text-[8px] font-semibold mb-0.5 uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-zinc-400'}`}>{col.name}</p>
                                                <p className={`text-[8px] font-mono mb-0.5 ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>μ={col.mean?.toFixed(1)}</p>
                                                <svg width={W} height={H + 18} className="overflow-visible">
                                                    {col.bins.map((b, i) => {
                                                        const bh = Math.max(2, (b.count / maxC) * H);
                                                        const x = pad + i * bw;
                                                        const y = H - bh;
                                                        return (
                                                            <g key={i}>
                                                                <rect x={x + 1} y={y} width={bw - 3} height={bh} rx={2} fill={'#3b82f6'} opacity={0.7 + 0.3 * (b.count / maxC)} />
                                                                <text x={x + bw / 2} y={H + 9} textAnchor="middle" fontSize={6} fill={isDarkMode ? '#71717a' : '#9ca3af'}>{b.bin}</text>
                                                                {b.count > 0 && <text x={x + bw / 2} y={y - 2} textAnchor="middle" fontSize={7} fontWeight="600" fill={isDarkMode ? '#e4e4e7' : '#3f3f46'}>{b.count}</text>}
                                                            </g>
                                                        );
                                                    })}
                                                    <line x1={pad} y1={0} x2={pad} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                                    <line x1={pad} y1={H} x2={W} y2={H} stroke={isDarkMode ? '#3f3f46' : '#e4e4e7'} strokeWidth={1} />
                                                </svg>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className={`flex-1 flex flex-col items-center justify-center px-4 py-5 gap-2 ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            <svg className="w-6 h-6 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            <p className="text-[10px] text-center leading-relaxed">Click a node<br />to explore its data</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Full Data Table: shows all originalData, positioned below left panel */}
            {Array.isArray(data.originalData) && data.originalData.length > 0 && (() => {
                const allRows = data.originalData as any[];
                const headers = typeof allRows[0] === 'object' && allRows[0] !== null ? Object.keys(allRows[0]) : [];
                if (!headers.length) return null;
                return (
                    <div
                        className={`absolute z-[99] pointer-events-auto overflow-hidden rounded-xl border shadow-2xl ${isDarkMode ? 'bg-zinc-900/95 border-zinc-800 text-zinc-400' : 'bg-white/95 border-zinc-200 text-zinc-600'}`}
                        style={{ left: '320px', right: '320px', bottom: '24px', maxHeight: '220px' }}
                    >
                        <div className={`flex items-center gap-2 px-4 py-2 border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-200'}`}>
                            <span className={`font-bold text-[10px] ${isDarkMode ? 'text-zinc-300' : 'text-zinc-700'}`}>Dataset</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400'}`}>{allRows.length} rows · {headers.length} cols</span>
                        </div>
                        <div className="overflow-auto" style={{ maxHeight: '180px', scrollbarWidth: 'thin' as any }}>
                            <table className="w-full text-[9px] border-collapse" style={{ minWidth: 'max-content' }}>
                                <thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                                    <tr>
                                        <th className={`px-3 py-1.5 text-left font-semibold ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} style={{ borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}` }}>#</th>
                                        {headers.map(h => (
                                            <th key={h} className={`px-3 py-1.5 text-left font-semibold whitespace-nowrap ${isDarkMode ? 'text-zinc-400' : 'text-zinc-500'}`} style={{ borderBottom: `1px solid ${isDarkMode ? '#3f3f46' : '#e4e4e7'}` }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {allRows.map((row: any, i: number) => (
                                        <tr key={i} className={isDarkMode ? (i % 2 === 0 ? 'bg-zinc-900/60' : 'bg-zinc-800/30') : (i % 2 === 0 ? 'bg-white' : 'bg-zinc-50')}>
                                            <td className={`px-3 py-1 font-mono ${isDarkMode ? 'text-zinc-600' : 'text-zinc-400'}`}>{i}</td>
                                            {headers.map(h => (
                                                <td key={h} className={`px-3 py-1 font-mono whitespace-nowrap ${isDarkMode ? 'text-zinc-400' : 'text-zinc-600'}`}>{String(row[h] ?? '')}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}
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
                    linkColor={() => isDarkMode ? '#ffffff20' : '#00000020'}
                    linkWidth={1}
                    linkOpacity={0.6}
                    backgroundColor={isDarkMode ? "#000000" : "#ffffff"}
                    showNavInfo={false}
                    onNodeDragEnd={handleNodeDragEnd}
                    onNodeClick={handleNodeClick}
                    enablePointerInteraction={true}
                />
            ) : (
                <ForceGraph2D
                    ref={fgRef}
                    graphData={data}
                    nodeLabel="desc"
                    nodeCanvasObject={drawNode2D}
                    nodePointerAreaPaint={drawNodePointerArea2D}
                    linkColor={() => isDarkMode ? '#ffffff20' : '#00000020'}
                    linkWidth={1}
                    backgroundColor={isDarkMode ? "#000000" : "#ffffff"}
                    onNodeDragEnd={handleNodeDragEnd}
                    onNodeClick={handleNodeClick}
                    enablePointerInteraction={true}
                />
            )}
        </div>
    );
}
