import React from 'react';
import { Settings, Sliders, Activity, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
    interval: number;
    setInterval: (value: number) => void;
    overlap: number;
    setOverlap: (value: number) => void;
    clusteringMethod: string;
    setClusteringMethod: (value: string) => void;
}

export function Sidebar({
    interval,
    setInterval,
    overlap,
    setOverlap,
    clusteringMethod,
    setClusteringMethod,
}: SidebarProps) {
    return (
        <div className="w-80 bg-zinc-900 border-r border-zinc-800 text-zinc-100 flex flex-col h-full p-6 space-y-8">
            <div className="flex items-center space-x-3 mb-4">
                <Activity className="w-6 h-6 text-indigo-500" />
                <h1 className="text-xl font-bold tracking-tight">TDA Mapper</h1>
            </div>

            <div className="space-y-6">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                            <Layers className="w-4 h-4" /> Interval
                        </label>
                        <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-300">{interval}</span>
                    </div>
                    <input
                        type="range"
                        min="5"
                        max="50"
                        value={interval}
                        onChange={(e) => setInterval(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                    />
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                            <Sliders className="w-4 h-4" /> Overlap
                        </label>
                        <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-300">{overlap}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="80"
                        value={overlap}
                        onChange={(e) => setOverlap(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                    />
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Clustering Method
                    </label>
                    <select
                        value={clusteringMethod}
                        onChange={(e) => setClusteringMethod(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none transition-all"
                    >
                        <option value="dbscan">DBSCAN</option>
                        <option value="kmeans">K-Means</option>
                        <option value="agglomerative">Agglomerative</option>
                    </select>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-zinc-800">
                <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 backdrop-blur-sm">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Status</h3>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        System Ready
                    </div>
                </div>
            </div>
        </div>
    );
}
