'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebR } from './WebRProvider';
import { runMapperAlgo } from '@/lib/r-script';

// Dynamically import ForceGraph3D with no SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-zinc-500">Loading Graph Engine...</div>
});

interface Node {
    id: string;
    group: number;
    val: number; // size
    name: string;
    desc: string;
}

interface Link {
    source: string;
    target: string;
    value: number; // thickness
    isReverse?: boolean;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
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
    const fgRef = useRef<any>();

    // Run Mapper Algorithm using WebR
    useEffect(() => {
        if (!webR || isWebRLoading) return;

        const computeGraph = async () => {
            setIsComputing(true);
            try {
                const graphData = await runMapperAlgo(webR, interval, overlap);
                setData(graphData);
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
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-zinc-900/90 px-4 py-2 rounded-full border border-zinc-800 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span className="text-xs text-zinc-300">Computing Topology in R...</span>
                </div>
            )}
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-4 rounded-lg text-xs text-zinc-400 shadow-xl">
                    <h3 className="text-zinc-100 font-semibold mb-2 text-sm">Topology Stats</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span>Nodes (Clusters):</span>
                        <span className="text-zinc-200 font-mono text-right">{data.nodes.length}</span>
                        <span>Edges (Overlaps):</span>
                        <span className="text-zinc-200 font-mono text-right">{data.links.length / 2}</span>
                        <span>Betti-1 (Holes):</span>
                        <span className="text-zinc-200 font-mono text-right">1</span>
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
                nodeColor={(node: any) => {
                    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
                    return colors[node.group % colors.length];
                }}
                nodeRelSize={6}
                nodeResolution={16}
                nodeOpacity={0.9}

                // Link styling
                linkColor={() => '#ffffff40'}
                linkWidth={(link: any) => link.isReverse ? 0 : 1} // Hide reverse links lines
                linkOpacity={0.3}

                // Environment
                backgroundColor="#000000"
                showNavInfo={false}

                // Interaction
                onNodeDragEnd={handleNodeDragEnd}

                // Particles for visual flair (data flowing) - Bidirectional now
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.005}
            />
        </div>
    );
}
