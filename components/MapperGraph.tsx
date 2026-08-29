'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { parseMapperJson, validateMapperJson, MapperFormatError, checkMapperWarnings } from '@/lib/r-script';
import { JsonErrorModal, JsonErrorInfo } from './JsonErrorModal';
import { JsonWarningModal, JsonWarningInfo } from './JsonWarningModal';
import { TypeSwitchErrorModal, TypeSwitchErrorInfo } from './TypeSwitchErrorModal';
import { Download, Box, Square, Play, ChevronDown, ChevronRight, Table2, BarChart2, X, ArrowRightLeft } from 'lucide-react';

// Dynamically import ForceGraph3D with no SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-[#8f7d70]">Loading 3D Engine...</div>
});

// Dynamically import ForceGraph2D with no SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-[#8f7d70]">Loading 2D Engine...</div>
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
    inputParams?: any;
    rawNodes?: any[];
    adjacency?: any;
    cc?: Record<string, number[]>; // Pre-calculated node attributes
}

interface MapperGraphProps {
    selectedExample: string;
    onCustomUpload: () => void;
    onGraphStats?: (stats: { nodes: number; edges: number } | null) => void;
}

const CATEGORICAL_PALETTE = [
    '#3b82f6', // Vivid Blue
    '#f97316', // Bright Orange
    '#10b981', // Emerald Green
    '#ef4444', // Crimson Red
    '#8b5cf6', // Violet Purple
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#84cc16', // Lime Green
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#e11d48', // Rose
    '#d97706', // Ochre
    '#a855f7', // Purple
    '#0284c7', // Sky Blue
    '#059669', // Mint
    '#dc2626', // Deep Red
    '#7c3aed', // Deep Violet
    '#ea580c', // Dark Orange
    '#2563eb', // Royal Blue
];

const colorScale = (val: string, uniqueList?: string[]) => {
    if (uniqueList && uniqueList.length > 0) {
        const idx = uniqueList.indexOf(val);
        if (idx >= 0 && idx < CATEGORICAL_PALETTE.length) {
            return CATEGORICAL_PALETTE[idx];
        } else if (idx >= 0) {
            // Golden angle (137.5 deg) ensures adjacent categories are maximally separated
            const hue = Math.round((idx * 137.5) % 360);
            return `hsl(${hue}, 75%, 52%)`;
        }
    }
    // If val is a single digit or integer index
    const num = Number(val);
    if (!isNaN(num) && Number.isInteger(num) && num >= 0 && num < CATEGORICAL_PALETTE.length) {
        return CATEGORICAL_PALETTE[num];
    }
    // Hash using prime multiplier & golden angle for high contrast
    const hash = val.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000, 0);
    const hue = Math.abs(hash * 137.5) % 360;
    return `hsl(${hue}, 75%, 52%)`;
};

const formatParamValue = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'object') {
        if (Array.isArray(val)) {
            return val.map(formatParamValue).join(', ');
        }
        return Object.entries(val)
            .map(([k, v]) => `${k}: ${Array.isArray(v) && v.length === 1 ? v[0] : formatParamValue(v)}`)
            .join(', ');
    }
    return String(val);
};

export function MapperGraph({ selectedExample, onCustomUpload, onGraphStats }: MapperGraphProps) {
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [isComputing, setIsComputing] = useState(false);
    const [is3D, setIs3D] = useState(true);
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
    const [uploadError, setUploadError] = useState<JsonErrorInfo | null>(null);
    const [uploadWarnings, setUploadWarnings] = useState<JsonWarningInfo | null>(null);
    const [typeSwitchError, setTypeSwitchError] = useState<TypeSwitchErrorInfo | null>(null);

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
        if (!originalData || !originalData.length) {
            setSelectedNodeEDA({
                nodeId: node.id,
                nodeName: node.name || node.id,
                size: Array.isArray(node.indices) ? node.indices.length : (node.val || 1),
                cols: [],
            });
            return;
        }
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
            const colDef = columns.find(c => c.name === key);
            const isNum = colDef 
                ? colDef.type === 'numerical' 
                : (vals.length > 0 && vals.every(v => typeof v === 'number' && !isNaN(v)));

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
    }, [data.originalData, columns]);


    const processMapperData = (json: any) => {
        try {
            const graphData = parseMapperJson(json);
            if (graphData) {
                setData(graphData);
                if (graphData.originalData) {
                    analyzeData(graphData.originalData);
                }
            }
        } catch (e: any) {
            console.error("Error processing mapper JSON", e);
            if (e instanceof MapperFormatError) {
                setUploadError({
                    title: 'Invalid TDA-R Mapper JSON Schema',
                    errors: e.errors,
                    missingFields: e.missingFields
                });
            }
        }
    };

    useEffect(() => {
        if (!selectedExample || selectedExample === 'custom') return;

        setIsComputing(true);
        fetch(`/example/${selectedExample}`)
            .then(res => res.json())
            .then(result => {
                processMapperData(result);
            })
            .catch(err => {
                console.error("Failed to load example:", err);
            })
            .finally(() => {
                setIsComputing(false);
            });
    }, [selectedExample]);

    // Adjust Force Graph Simulation & 3D Environment
    useEffect(() => {
        if (!fgRef.current) return;

        // Add a small delay to ensure graph is initialized
        const timer = setTimeout(() => {
            if (fgRef.current) {
                // Configure 3D Camera Controls & Lighting for high-end aesthetic
                if (is3D) {
                    if (fgRef.current.controls) {
                        const controls = fgRef.current.controls();
                        if (controls) {
                            controls.enableDamping = true;
                            controls.dampingFactor = 0.08;
                            controls.rotateSpeed = 0.8;
                        }
                    }

                    if (fgRef.current.scene) {
                        const scene = fgRef.current.scene();
                        if (!scene.userData.enhancedLights) {
                            try {
                                const THREE = typeof window !== 'undefined' ? (window as any).THREE || require('three') : null;
                                if (THREE) {
                                    // Ambient hemisphere light
                                    const hemiLight = new THREE.HemisphereLight(0xfff5ea, 0x2c1e17, 1.2);
                                    scene.add(hemiLight);

                                    // Key light (warm bright highlight)
                                    const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.5);
                                    keyLight.position.set(120, 160, 100);
                                    scene.add(keyLight);

                                    // Fill light (cool contrast)
                                    const fillLight = new THREE.DirectionalLight(0xb4d2ff, 0.7);
                                    fillLight.position.set(-120, -60, -100);
                                    scene.add(fillLight);

                                    // Rim light (accentuate sphere contours)
                                    const rimLight = new THREE.DirectionalLight(0xe5b88f, 1.1);
                                    rimLight.position.set(0, -140, 80);
                                    scene.add(rimLight);

                                    scene.userData.enhancedLights = true;
                                }
                            } catch (e) {}
                        }
                    }
                }

                // Increase link distance (Edge length)
                if (fgRef.current.d3Force) {
                    const linkForce = fgRef.current.d3Force('link');
                    if (linkForce) {
                        linkForce.distance(50); // Fixed distance
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
    }, [data, is3D]);

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

    // Refresh graph immediately when selected node changes
    useEffect(() => {
        if (fgRef.current?.refresh) {
            fgRef.current.refresh();
        }
    }, [selectedNodeEDA]);

    // Custom 3D Object for Selected Node (Black Outer Ring / Precision Orbit)
    const getNodeThreeObject = useCallback((node: any) => {
        if (!selectedNodeEDA || selectedNodeEDA.nodeId !== node.id) return undefined;
        try {
            const THREE = typeof window !== 'undefined' ? (window as any).THREE || require('three') : null;
            if (!THREE) return undefined;
            const r = (Math.cbrt(node.val || 1) * 3.5) + 1.2;
            const group = new THREE.Group();

            // 1. Sleek metallic black torus orbital ring
            const ringGeom = new THREE.TorusGeometry(r, 0.4, 16, 48);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0x0a0a0a,
                roughness: 0.25,
                metalness: 0.8
            });
            const ring1 = new THREE.Mesh(ringGeom, ringMat);
            ring1.rotation.x = Math.PI / 2.5;
            group.add(ring1);

            // 2. Second ring for a precision gyroscope look
            const ring2 = ring1.clone();
            ring2.rotation.x = -Math.PI / 2.5;
            ring2.rotation.y = Math.PI / 3;
            group.add(ring2);

            // 3. Delicate outer black wireframe bounding sphere for instant visual recognition
            const wireGeom = new THREE.SphereGeometry(r + 0.8, 14, 14);
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0x000000,
                wireframe: true,
                transparent: true,
                opacity: 0.6
            });
            const wireSphere = new THREE.Mesh(wireGeom, wireMat);
            group.add(wireSphere);

            return group;
        } catch (e) {
            return undefined;
        }
    }, [selectedNodeEDA]);

    // Custom 2D Rendering
    const drawNode2D = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const radius = Math.sqrt(node.val || 0.1) * 3;
        const isSelected = selectedNodeEDA?.nodeId === node.id;

        // Draw selected outer black ring
        if (isSelected) {
            // Bold outer black ring
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + (4.5 / globalScale), 0, 2 * Math.PI, false);
            ctx.lineWidth = 3 / globalScale;
            ctx.strokeStyle = '#000000';
            ctx.stroke();

            // Inner light gap outline for sharp contrast against background
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + (1.6 / globalScale), 0, 2 * Math.PI, false);
            ctx.lineWidth = 1.2 / globalScale;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = nodeColors[node.id] || node.color || '#3b82f6';
        ctx.fill();

        ctx.lineWidth = (isSelected ? 2.5 : 1.5) / globalScale;
        ctx.strokeStyle = isSelected ? '#000000' : '#3d2c22';
        ctx.stroke();
    }, [nodeColors, selectedNodeEDA]);

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
        onGraphStats?.({ nodes: nodes.length, edges: edgeCount });
    }, [data.nodes, data.links]);

    // Compute label distribution from originalData (separate effect so it updates when data loads)
    useEffect(() => {
        setMapperStats(prev => {
            if (!prev) return prev;
            const originalData = data.originalData as any[] | undefined;
            if (!originalData || !Array.isArray(originalData) || originalData.length === 0) return { ...prev, labelDist: [] };
            const firstRow = originalData[0];
            if (typeof firstRow !== 'object' || firstRow === null) return { ...prev, labelDist: [] };
            const COLORS_CYCLE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
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
                const rawUnique = Array.from(new Set(values.filter(v => v !== undefined && v !== null).map(v => String(v))));
                rawUnique.sort((a, b) => {
                    const numA = Number(a), numB = Number(b);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return a.localeCompare(b);
                });
                const legendMap = new Map<string, string>();

                data.nodes.forEach((node, idx) => {
                    const val = values[idx];
                    if (val !== undefined && val !== null && val !== '') {
                        const strVal = String(val);
                        const color = colorScale(strVal, rawUnique);
                        newNodeColors[node.id] = color;
                        if (!legendMap.has(strVal)) legendMap.set(strVal, color);
                    } else {
                        newNodeColors[node.id] = '#888888';
                    }
                });
                setCategoricalLegend(
                    rawUnique.filter(cat => legendMap.has(cat)).map(cat => ({ label: cat, color: legendMap.get(cat)! }))
                );
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

        // Helper to get value from original data (supports both 1-based and 0-based indexing)
        const getValue = (idx: number, col: string) => {
            if (!data.originalData) return undefined;
            const numIdx = typeof idx === 'number' ? idx : parseInt(String(idx), 10);
            if (isNaN(numIdx)) return undefined;

            if (Array.isArray(data.originalData)) {
                // Try 1-based first (R standard output)
                const row1 = data.originalData[numIdx - 1];
                if (row1 && row1[col] !== undefined && row1[col] !== null) return row1[col];
                // Fallback to 0-based index
                const row0 = data.originalData[numIdx];
                if (row0 && row0[col] !== undefined && row0[col] !== null) return row0[col];
                return undefined;
            } else if (typeof data.originalData === 'object') {
                const colData = (data.originalData as any)[col];
                if (Array.isArray(colData)) {
                    if (colData[numIdx - 1] !== undefined && colData[numIdx - 1] !== null) return colData[numIdx - 1];
                    if (colData[numIdx] !== undefined && colData[numIdx] !== null) return colData[numIdx];
                }
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

            // 1. Pre-scan all column values across originalData to build consistent unique categories
            const allColVals: any[] = [];
            if (Array.isArray(data.originalData)) {
                allColVals.push(...data.originalData.map(r => r?.[selectedColumn]));
            } else if (data.originalData && (data.originalData as any)[selectedColumn]) {
                allColVals.push(...((data.originalData as any)[selectedColumn] as any[]));
            }

            const rawUnique = Array.from(
                new Set(
                    allColVals
                        .filter(v => v !== undefined && v !== null && v !== '')
                        .map(v => String(v))
                )
            );

            // Sort unique categories (numeric natural order if numbers, else alphabetical)
            rawUnique.sort((a, b) => {
                const numA = Number(a), numB = Number(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });

            const uniqueCategories = rawUnique;
            const legendMap = new Map<string, string>();

            data.nodes.forEach(node => {
                const indices = Array.isArray(node.indices) ? node.indices : [node.indices];
                const counts: Record<string, number> = {};

                indices.forEach((idx: number) => {
                    const val = getValue(idx, selectedColumn);
                    if (val !== undefined && val !== null && val !== '') {
                        const key = String(val);
                        counts[key] = (counts[key] || 0) + 1;
                    }
                });

                // Find dominant category for this node
                let dominant = '';
                let maxCount = -1;
                Object.entries(counts).forEach(([k, v]) => {
                    if (v > maxCount) {
                        maxCount = v;
                        dominant = k;
                    }
                });

                if (dominant !== '') {
                    const color = colorScale(dominant, uniqueCategories);
                    newNodeColors[node.id] = color;
                    if (!legendMap.has(dominant)) legendMap.set(dominant, color);
                } else {
                    // Node has no valid data for this column
                    newNodeColors[node.id] = '#888888';
                }
            });

            // Populate categorical legend preserving sorted order
            const sortedLegend = uniqueCategories
                .filter(cat => legendMap.has(cat))
                .map(cat => ({ label: cat, color: legendMap.get(cat)! }));

            legendMap.forEach((color, label) => {
                if (!sortedLegend.find(item => item.label === label)) {
                    sortedLegend.push({ label, color });
                }
            });

            setCategoricalLegend(sortedLegend);
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

    const handleToggleColumnType = () => {
        if (!selectedColumn) return;
        const colDef = columns.find(c => c.name === selectedColumn);
        if (!colDef) return;

        const currentType = colDef.type;
        const targetType: 'categorical' | 'numerical' = currentType === 'numerical' ? 'categorical' : 'numerical';

        // Extract all values for this column from data
        let values: any[] = [];
        if (colDef.source === 'cc' && data.cc && data.cc[selectedColumn]) {
            values = data.cc[selectedColumn];
        } else if (Array.isArray(data.originalData)) {
            values = data.originalData.map(row => row?.[selectedColumn]).filter(v => v !== undefined && v !== null && v !== '');
        } else if (data.originalData && (data.originalData as any)[selectedColumn]) {
            values = ((data.originalData as any)[selectedColumn] as any[]).filter(v => v !== undefined && v !== null && v !== '');
        }

        if (values.length === 0) {
            setTypeSwitchError({
                columnName: selectedColumn,
                currentType,
                targetType,
                reason: `No data points were found for variable '${selectedColumn}'.`
            });
            return;
        }

        // Case 1: Switching from Numerical -> Categorical
        if (targetType === 'categorical') {
            const uniqueValues = new Set(values.map(v => String(v)));
            const uniqueCount = uniqueValues.size;

            if (uniqueCount > 30) {
                setTypeSwitchError({
                    columnName: selectedColumn,
                    currentType,
                    targetType,
                    reason: `The variable contains ${uniqueCount} unique values, which exceeds the limit of 30 categories. Converting continuous variables with more than 30 unique values to categorical is not allowed to prevent visual palette clutter. Categorical visualization is intended for discrete labels (such as digits 0–9 or cluster classes).`
                });
                return;
            }

            // Successfully switch to categorical
            setColumns(prev => prev.map(c => c.name === selectedColumn ? { ...c, type: 'categorical' } : c));
        }
        // Case 2: Switching from Categorical -> Numerical
        else {
            // Check if column values are natively non-numeric
            const nonNumericValues = values.filter(v => {
                if (typeof v === 'number') return isNaN(v);
                if (typeof v === 'string') {
                    const trimmed = v.trim();
                    return trimmed === '' || isNaN(Number(trimmed));
                }
                return true;
            });

            if (nonNumericValues.length > 0) {
                const sample = String(nonNumericValues[0]);
                setTypeSwitchError({
                    columnName: selectedColumn,
                    currentType,
                    targetType,
                    reason: `The variable contains non-numeric text data (e.g., '${sample}') and cannot be converted to Numerical. Numerical visualization requires numeric values to compute continuous color gradients, averages, and histogram ranges.`
                });
                return;
            }

            // Successfully switch to numerical
            setColumns(prev => prev.map(c => c.name === selectedColumn ? { ...c, type: 'numerical' } : c));
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input value so selecting the same file will trigger onChange
        event.target.value = '';

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const txt = e.target?.result as string;
                let json: any;
                try {
                    json = JSON.parse(txt);
                } catch (parseErr: any) {
                    setUploadError({
                        title: 'JSON Syntax Error',
                        fileName: file.name,
                        errors: [
                            'The uploaded file is not valid JSON syntax (syntax error, unclosed brackets, trailing commas, or non-text file).',
                            `Parser error: ${parseErr?.message || String(parseErr)}`
                        ],
                        hint: 'Please check that the file is a properly formatted JSON text file.'
                    });
                    return;
                }

                // Validate TDA-R Mapper JSON schema
                const validation = validateMapperJson(json);
                if (!validation.valid) {
                    setUploadError({
                        title: 'Invalid TDA-R Mapper JSON Schema',
                        fileName: file.name,
                        errors: validation.errors,
                        missingFields: validation.missingFields,
                        hint: 'TDA-R Mapper requires a JSON file containing adjacency, num_vertices, level_of_vertex, and points_in_vertex.'
                    });
                    return;
                }

                // Check optional fields: original_data, input_params
                const warnings = checkMapperWarnings(json);
                if (warnings.length > 0) {
                    setUploadWarnings({
                        fileName: file.name,
                        warnings
                    });
                } else {
                    setUploadWarnings(null);
                }

                setUploadError(null);
                onCustomUpload();
                processMapperData(json);
            } catch (err: any) {
                console.error("Error parsing JSON file:", err);
                if (err instanceof MapperFormatError) {
                    setUploadError({
                        title: 'Invalid TDA-R Mapper JSON Schema',
                        fileName: file.name,
                        errors: err.errors,
                        missingFields: err.missingFields
                    });
                } else {
                    setUploadError({
                        title: 'Error Processing JSON File',
                        fileName: file.name,
                        errors: [err?.message || 'An unexpected error occurred while parsing the dataset.']
                    });
                }
            }
        };

        reader.onerror = () => {
            setUploadError({
                title: 'File Read Error',
                fileName: file.name,
                errors: ['The browser failed to read the local file. Please verify file permissions.']
            });
        };

        reader.readAsText(file);
    };



    return (
        <div className="h-full w-full relative overflow-hidden bg-[#2c1e17]">
            {isComputing && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#2c1e17]/80 backdrop-blur-sm">
                    <div className="bg-[#3d2c22]/95 px-4 py-2 rounded-full border border-[#614738] flex items-center gap-2 shadow-xl">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#d49b6a]"></div>
                        <span className="text-xs text-[#e5cfbc]">Processing Graph Data...</span>
                    </div>
                </div>
            )}
            {/* Controls Portal: rendered into Sidebar via portal */}
            {portalReady && portalSlotRef.current && createPortal(
                <div style={{ display: 'block', width: '100%' }} className="space-y-2 text-xs text-[#d6c3b4]">

                    {/* Column Selection */}
                    {columns.length > 0 ? (
                        <div style={{ width: '100%' }} className="pt-3 border-t border-[#614738]">
                            <label htmlFor="color-by-select" className="block text-[#d6c3b4] mb-1 text-xs">Color By:</label>
                            <select
                                id="color-by-select"
                                value={selectedColumn}
                                onChange={(e) => setSelectedColumn(e.target.value)}
                                style={{ width: '100%' }}
                                className="border rounded px-2 py-1.5 focus:outline-none focus:border-[#d49b6a] transition-colors text-xs bg-[#523d30] border-[#755745] text-[#fbf5f0]"
                            >
                                {columns.map(col => (
                                    <option key={col.name} value={col.name}>
                                        {col.source === 'cc' ? '[Metric] ' : ''}{col.name} ({col.type === 'numerical' ? '#' : 'Aa'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div style={{ width: '100%' }} className="pt-3 border-t border-[#614738]">
                            <div className="text-[11px] text-amber-300/90 bg-[#4f3a2e]/60 border border-amber-600/40 rounded-lg p-2.5 leading-relaxed">
                                ⚠️ <b>original_data missing</b>: Variable coloring and feature distributions are disabled.
                            </div>
                        </div>
                    )}

                    <div style={{ width: '100%' }} className="pt-3 border-t border-[#614738] space-y-2.5">

                        <button
                            onClick={() => setIs3D(!is3D)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 bg-[#523d30] hover:bg-[#634b3c] text-[#fbf5f0] border-[#755745] hover:border-[#8f6b55]"
                        >
                            {is3D ? <Square className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
                            Switch to {is3D ? '2D' : '3D'}
                        </button>

                        <button
                            onClick={handleDownloadNodes}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 bg-[#523d30] hover:bg-[#634b3c] text-[#fbf5f0] border-[#755745] hover:border-[#8f6b55]"
                        >
                            <Download className="w-3.5 h-3.5" /> Download Nodes CSV
                        </button>
                        <button
                            onClick={handleDownloadData}
                            disabled={!data.originalData}
                            title={!data.originalData ? "Unavailable: original_data was not included in this JSON" : undefined}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${
                                !data.originalData
                                    ? 'opacity-40 cursor-not-allowed bg-[#433227] text-[#9c897c] border-[#594234]'
                                    : 'bg-[#523d30] hover:bg-[#634b3c] text-[#fbf5f0] border-[#755745] hover:border-[#8f6b55]'
                            }`}
                        >
                            <Download className="w-3.5 h-3.5" /> Download Original Data
                        </button>

                        {/* Switch Label / Variable Type Button (Directly above Upload JSON) */}
                        <button
                            onClick={handleToggleColumnType}
                            disabled={!selectedColumn}
                            title={selectedColumn ? `Toggle '${selectedColumn}' between Categorical and Numerical` : 'Select a variable first'}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all border font-medium active:scale-95 ${
                                !selectedColumn
                                    ? 'opacity-40 cursor-not-allowed bg-[#433227] text-[#9c897c] border-[#594234]'
                                    : 'bg-[#523d30] hover:bg-[#634b3c] text-[#fbf5f0] border-[#755745] hover:border-[#8f6b55]'
                            }`}
                        >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-[#d49b6a]" />
                            <span>
                                Switch to {columns.find(c => c.name === selectedColumn)?.type === 'numerical' ? 'Categorical' : 'Numerical'}
                            </span>
                        </button>

                        <label className="block w-full cursor-pointer px-3 py-2.5 rounded-lg transition-colors border text-center text-xs font-medium bg-[#523d30] hover:bg-[#634b3c] text-[#fbf5f0] border-[#755745] hover:border-[#8f6b55]">
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
            <div className="absolute top-6 bottom-6 right-6 z-[100] pointer-events-none flex flex-col gap-3.5 w-[350px]">
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100%-200px)] scrollbar-hide">
                    {/* Legend Card */}
                    <div className="backdrop-blur-xl border border-[#614738] p-4 rounded-xl shadow-2xl pointer-events-auto w-full bg-[#3d2c22]/95 text-[#d6c3b4]">
                        <h4 className="font-bold mb-2.5 text-sm text-[#fdf8f4]">Legend</h4>
                        {columns.find(c => c.name === selectedColumn)?.type === 'numerical' && columnStats ? (
                            <div className="flex flex-col gap-1.5">
                                <div className="h-3.5 w-full rounded" style={{ background: 'linear-gradient(to right, hsl(240, 70%, 50%), hsl(180, 70%, 50%), hsl(120, 70%, 50%), hsl(60, 70%, 50%), hsl(0, 70%, 50%))' }}></div>
                                <div className="flex justify-between text-xs text-[#af9684] font-mono">
                                    <span>{columnStats.min.toFixed(2)}</span>
                                    <span>{columnStats.max.toFixed(2)}</span>
                                </div>
                            </div>
                        ) : categoricalLegend.length > 0 ? (
                            <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                                {categoricalLegend.map(item => (
                                    <div key={item.label} className="flex items-center gap-2.5">
                                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: item.color }}></div>
                                        <span className="text-xs font-medium truncate text-[#d6c3b4]" title={item.label}>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span className="text-xs text-[#9e8777] italic">No legend data</span>
                        )}
                    </div>

                    {/* Mapper Analytics Card */}
                    {mapperStats && (
                        <div className="flex-1 flex flex-col backdrop-blur-xl border border-[#614738] rounded-xl shadow-2xl pointer-events-auto w-full overflow-hidden bg-[#3d2c22]/95 text-[#d6c3b4]">
                            <button
                                onClick={() => setIsAnalyticsOpen(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 font-bold text-sm tracking-wide text-[#fdf8f4] hover:bg-[#523d30]/60 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-[#d49b6a]" />
                                    Graph Analytics
                                </span>
                                {isAnalyticsOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                            {isAnalyticsOpen && (
                                <div className="border-t border-[#614738] px-4 pb-4 pt-3.5 space-y-3.5 text-xs">
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: 'Nodes', value: mapperStats.nodeCount },
                                            { label: 'Edges', value: mapperStats.edgeCount },
                                            { label: 'Components', value: mapperStats.connectedComponents },
                                            { label: 'Max Size', value: mapperStats.maxClusterSize },
                                        ].map(({ label, value }) => (
                                            <div key={label} className="rounded-lg px-2.5 py-2 text-center bg-[#4f3a2e] border border-[#6b503f]">
                                                <div className="text-[11px] font-medium text-[#af9684]">{label}</div>
                                                <div className="text-base font-bold font-mono text-[#fdf8f4]">{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-xs font-mono text-[#af9684]">
                                        Avg cluster size: <span className="text-[#e5cfbc] font-semibold">{mapperStats.avgClusterSize.toFixed(1)}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold mb-2 text-[#e5cfbc]">Cluster Size Distribution</p>
                                        {(() => {
                                            const maxCount = Math.max(...mapperStats.clusterSizeHist.map(b => b.count), 1);
                                            const barColor = '#3b82f6';
                                            const W = 290, H = 60, pad = 14;
                                            const bw = (W - pad - 4) / mapperStats.clusterSizeHist.length;
                                            return (
                                                <svg width={W} height={H + 18} className="overflow-visible">
                                                    {mapperStats.clusterSizeHist.map((b, i) => {
                                                        const bh = Math.max(3, (b.count / maxCount) * H);
                                                        const x = pad + i * bw;
                                                        const y = H - bh;
                                                        return (
                                                            <g key={i}>
                                                                <rect x={x + 1} y={y} width={bw - 4} height={bh} rx={2} fill={barColor} opacity={0.9} />
                                                                <text x={x + bw / 2} y={H + 13} textAnchor="middle" fontSize={8} fill="#af9684">{b.bin}</text>
                                                                {b.count > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#fdf8f4">{b.count}</text>}
                                                            </g>
                                                        );
                                                    })}
                                                    <line x1={pad} y1={0} x2={pad} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                    <line x1={pad} y1={H} x2={W} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                </svg>
                                            );
                                        })()}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold mb-2 text-[#e5cfbc]">Degree Distribution</p>
                                        {(() => {
                                            const maxCount = Math.max(...mapperStats.degreeHist.map(b => b.count), 1);
                                            const barColor = '#8b5cf6';
                                            const W = 290, H = 60, pad = 14;
                                            const bw = (W - pad - 4) / mapperStats.degreeHist.length;
                                            return (
                                                <svg width={W} height={H + 18} className="overflow-visible">
                                                    {mapperStats.degreeHist.map((b, i) => {
                                                        const bh = Math.max(3, (b.count / maxCount) * H);
                                                        const x = pad + i * bw;
                                                        const y = H - bh;
                                                        return (
                                                            <g key={i}>
                                                                <rect x={x + 1} y={y} width={bw - 4} height={bh} rx={2} fill={barColor} opacity={0.9} />
                                                                <text x={x + bw / 2} y={H + 13} textAnchor="middle" fontSize={8} fill="#af9684">{b.bin}</text>
                                                                {b.count > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#fdf8f4">{b.count}</text>}
                                                            </g>
                                                        );
                                                    })}
                                                    <line x1={pad} y1={0} x2={pad} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                    <line x1={pad} y1={H} x2={W} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                </svg>
                                            );
                                        })()}
                                    </div>
                                    {/* Label Distribution */}
                                    {mapperStats.labelDist && mapperStats.labelDist.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold mb-2 text-[#e5cfbc]">Label Distribution</p>
                                            {mapperStats.labelDist.map(ld => {
                                                const COLORS_CYCLE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
                                                return (
                                                    <div key={ld.col} className="mb-3">
                                                        <p className="text-[11px] uppercase tracking-wider mb-1.5 text-[#af9684] font-medium">{ld.col}</p>
                                                        {/* Stacked bar */}
                                                        <div className="flex w-full h-3.5 rounded overflow-hidden mb-2">
                                                            {ld.counts.map((c, i) => (
                                                                <div
                                                                    key={c.label}
                                                                    title={`${c.label}: ${c.count} (${(c.pct * 100).toFixed(1)}%)`}
                                                                    style={{ width: `${c.pct * 100}%`, background: COLORS_CYCLE[i % COLORS_CYCLE.length] }}
                                                                />
                                                            ))}
                                                        </div>
                                                        {/* Legend dots */}
                                                        <div className="flex flex-col gap-1">
                                                            {ld.counts.map((c, i) => (
                                                                <div key={c.label} className="flex items-center gap-2">
                                                                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS_CYCLE[i % COLORS_CYCLE.length] }} />
                                                                    <span className="text-xs truncate text-[#d6c3b4]" title={c.label}>{c.label}</span>
                                                                    <span className="text-xs font-mono ml-auto shrink-0 text-[#af9684]">{c.count} ({(c.pct * 100).toFixed(0)}%)</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Mapper Parameters (if input_params provided) */}
                                    {data.inputParams && typeof data.inputParams === 'object' && (
                                        <div className="pt-2.5 border-t border-[#614738]">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-semibold text-[#e5cfbc]">Mapper Parameters</p>
                                                <span className="text-[10px] text-[#af9684] italic">scrollable</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                {Object.entries(data.inputParams).map(([k, v]) => {
                                                    const formattedVal = formatParamValue(v);
                                                    return (
                                                        <div
                                                            key={k}
                                                            className="p-2 rounded bg-[#4f3a2e] border border-[#6b503f] overflow-x-auto whitespace-nowrap select-text cursor-grab active:cursor-grabbing"
                                                            style={{ scrollbarWidth: 'thin' }}
                                                            title={`${k}: ${formattedVal}`}
                                                        >
                                                            <span className="text-[#af9684]">{k}: </span>
                                                            <span className="text-[#fdf8f4] font-semibold">{formattedVal}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>
                {/* Node EDA: Click to Explore */}
                <div className="flex-1 flex flex-col backdrop-blur-xl border border-[#614738] rounded-xl shadow-2xl pointer-events-auto w-full overflow-hidden bg-[#3d2c22]/95 text-[#d6c3b4]">
                    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#614738]">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedNodeEDA ? (nodeColors[selectedNodeEDA.nodeId] || '#3b82f6') : '#614738' }} />
                        <span className="font-bold text-sm text-[#fdf8f4]">
                            {selectedNodeEDA ? selectedNodeEDA.nodeName : 'Node Inspector'}
                        </span>
                        {selectedNodeEDA && (
                            <>
                                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-[#4f3a2e] text-[#d49b6a] border border-[#6b503f]">{selectedNodeEDA.size} pts</span>
                                <button onClick={() => setSelectedNodeEDA(null)} className="ml-auto p-1 rounded hover:bg-[#523d30] transition-colors text-[#af9684] hover:text-[#fdf8f4]">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                    {selectedNodeEDA ? (
                        <div className="overflow-y-auto overflow-x-hidden flex-1" style={{ scrollbarWidth: 'thin', minHeight: 0 }}>
                            {selectedNodeEDA.cols.length === 0 ? (
                                <div className="py-8 px-4 text-center space-y-2">
                                    <p className="text-sm text-[#e5cfbc] font-semibold">Feature Distributions Unavailable</p>
                                    <p className="text-xs text-[#af9684] leading-relaxed">
                                        Raw feature rows were not included in this JSON (<code>original_data</code> missing).
                                        <br />Node size: <span className="font-mono text-amber-300 font-bold">{selectedNodeEDA.size}</span> data points.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6 px-4 py-3.5">
                                {selectedNodeEDA.cols.map(col => {
                                    if (col.type === 'categorical' && col.counts) {
                                        const maxC = Math.max(...col.counts.map(c => c.count), 1);
                                        const W = Math.max(100, col.counts.length * 32 + 20);
                                        const H = 50, pad = 16;
                                        const bw = (W - pad) / col.counts.length;
                                        const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
                                        return (
                                            <div key={col.name} className="flex flex-col items-start shrink-0">
                                                <p className="text-[11px] font-semibold mb-1 uppercase tracking-wider text-[#af9684]">{col.name}</p>
                                                <svg width={W} height={H + 22} className="overflow-visible">
                                                    {col.counts.map((c, i) => {
                                                        const bh = Math.max(3, (c.count / maxC) * H);
                                                        const x = pad + i * bw;
                                                        const y = H - bh;
                                                        return (
                                                            <g key={c.label}>
                                                                <rect x={x + 1} y={y} width={bw - 4} height={bh} rx={2} fill={COLORS[i % COLORS.length]} opacity={0.9} />
                                                                <text x={x + bw / 2} y={H + 11} textAnchor="middle" fontSize={8} fill="#af9684" transform={`rotate(-30, ${x + bw / 2}, ${H + 11})`}>{c.label.length > 7 ? c.label.slice(0, 6) + '…' : c.label}</text>
                                                                <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#fdf8f4">{c.count}</text>
                                                            </g>
                                                        );
                                                    })}
                                                    <line x1={pad} y1={0} x2={pad} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                    <line x1={pad} y1={H} x2={W} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                </svg>
                                            </div>
                                        );
                                    } else if (col.type === 'numerical' && col.bins) {
                                        const maxC = Math.max(...col.bins.map(b => b.count), 1);
                                        const W = Math.max(100, col.bins.length * 30 + 20);
                                        const H = 50, pad = 16;
                                        const bw = (W - pad) / col.bins.length;
                                        return (
                                            <div key={col.name} className="flex flex-col items-start shrink-0">
                                                <p className="text-[11px] font-semibold mb-0.5 uppercase tracking-wider text-[#af9684]">{col.name}</p>
                                                <p className="text-[10px] font-mono mb-1 text-[#af9684]">μ={col.mean?.toFixed(1)}</p>
                                                <svg width={W} height={H + 22} className="overflow-visible">
                                                    {col.bins.map((b, i) => {
                                                        const bh = Math.max(3, (b.count / maxC) * H);
                                                        const x = pad + i * bw;
                                                        const y = H - bh;
                                                        return (
                                                            <g key={i}>
                                                                <rect x={x + 1} y={y} width={bw - 4} height={bh} rx={2} fill={'#3b82f6'} opacity={0.7 + 0.3 * (b.count / maxC)} />
                                                                <text x={x + bw / 2} y={H + 11} textAnchor="middle" fontSize={7.5} fill="#af9684">{b.bin}</text>
                                                                {b.count > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize={8.5} fontWeight="600" fill="#fdf8f4">{b.count}</text>}
                                                            </g>
                                                        );
                                                    })}
                                                    <line x1={pad} y1={0} x2={pad} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                    <line x1={pad} y1={H} x2={W} y2={H} stroke="#6b503f" strokeWidth={1} />
                                                </svg>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-2.5 text-[#9e8777]">
                            <svg className="w-7 h-7 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            <p className="text-xs text-center leading-relaxed">Click a node<br />to explore its data</p>
                        </div>
                    )}
                </div>
            </div>


            {/* <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                <p className="text-[#af9684] text-xs">
                    Left-click: Rotate • Right-click: Pan • Scroll: Zoom • Drag Node: Move
                </p>
            </div> */}

            {is3D ? (
                <ForceGraph3D
                    ref={fgRef}
                    graphData={data}
                    nodeLabel="desc"
                    nodeColor={node => nodeColors[node.id!] || (node as any).color || '#3b82f6'}
                    nodeRelSize={3.5}
                    nodeResolution={28}
                    nodeOpacity={0.96}
                    nodeThreeObject={getNodeThreeObject}
                    nodeThreeObjectExtend={true}
                    linkColor={() => '#d49b6a50'}
                    linkWidth={0.8}
                    linkResolution={8}
                    linkOpacity={0.5}
                    backgroundColor="#2c1e17"
                    showNavInfo={false}
                    rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
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
                    linkColor={() => '#e2aa7a45'}
                    linkWidth={1}
                    backgroundColor="#2c1e17"
                    onNodeDragEnd={handleNodeDragEnd}
                    onNodeClick={handleNodeClick}
                    enablePointerInteraction={true}
                />
            )}

            {/* JSON Error Modal */}
            <JsonErrorModal error={uploadError} onClose={() => setUploadError(null)} />

            {/* JSON Optional Fields Warning Modal */}
            <JsonWarningModal warningInfo={uploadWarnings} onClose={() => setUploadWarnings(null)} />

            {/* Type Switch Error Modal */}
            <TypeSwitchErrorModal error={typeSwitchError} onClose={() => setTypeSwitchError(null)} />
        </div>
    );
}
