import React from 'react';
import { Settings, Sliders, Activity, Layers } from 'lucide-react';

interface SidebarProps {
    examples: string[];
    selectedExample: string;
    onSelectExample: (f: string) => void;
    onAboutOpen: () => void;
}

export function Sidebar({
    examples, selectedExample, onSelectExample, onAboutOpen,
}: SidebarProps) {
    return (
        <div className="absolute top-6 bottom-6 left-6 z-[100] w-[280px] bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl text-zinc-100 flex flex-col p-4 gap-2 overflow-hidden">
            {/* Header with About button */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                    <Activity className="w-6 h-6 text-indigo-500" />
                    <h1 className="text-xl font-bold tracking-tight">TDA-R Mapper</h1>
                </div>
                <button
                    onClick={onAboutOpen}
                    className="p-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                    title="About TDA-R Mapper"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            </div>

            {/* Dataset Selection */}
            <div className="space-y-2 shrink-0">
                <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Example Dataset
                </label>
                <select
                    value={selectedExample === 'custom' ? 'custom' : selectedExample}
                    onChange={(e) => onSelectExample(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none"
                    disabled={selectedExample === 'custom'}
                >
                    {selectedExample === 'custom' && <option value="custom">[ Custom Uploaded File ]</option>}
                    {examples.map(ex => (
                        <option key={ex} value={ex}>{ex}</option>
                    ))}
                </select>
                {selectedExample === 'custom' && (
                    <button onClick={() => onSelectExample(examples[0] || '')} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        Reset to Example
                    </button>
                )}
            </div>

            {/* Controls injected from MapperGraph via portal */}
            <div id="sidebar-controls-slot" className="flex-1 w-full"></div>

            {/* Status */}
            <div className="pt-3 border-t border-zinc-800 shrink-0">
                <div className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
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
