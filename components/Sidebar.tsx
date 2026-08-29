import React from 'react';
import { Layers } from 'lucide-react';

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
        <div className="absolute top-6 bottom-6 left-6 z-[100] w-[280px] bg-[#3d2c22]/95 backdrop-blur-xl border border-[#614738] rounded-xl shadow-2xl text-[#fbf5f0] flex flex-col p-4 gap-2 overflow-hidden">
            {/* Header with About button */}
            <div className="flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold tracking-tight text-[#fdf8f4]">TDA-R Mapper</h1>
                <button
                    onClick={onAboutOpen}
                    className="p-1.5 rounded-full bg-[#523d30] border border-[#755745] text-[#d6c3b4] hover:text-[#fdf8f4] hover:bg-[#634b3c] transition-all"
                    title="About TDA-R Mapper"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            </div>

            {/* Dataset Selection */}
            <div className="space-y-2 shrink-0">
                <label className="text-sm font-medium text-[#d6c3b4] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#d49b6a]" /> Example Dataset
                </label>
                <select
                    value={selectedExample === 'custom' ? 'custom' : selectedExample}
                    onChange={(e) => onSelectExample(e.target.value)}
                    className="w-full bg-[#523d30] border border-[#755745] text-[#fbf5f0] text-sm rounded-lg focus:ring-[#d49b6a] focus:border-[#d49b6a] block p-2 outline-none transition-colors"
                    disabled={selectedExample === 'custom'}
                >
                    {selectedExample === 'custom' && <option value="custom">[ Custom Uploaded File ]</option>}
                    {examples.map(ex => (
                        <option key={ex} value={ex}>{ex}</option>
                    ))}
                </select>
                {selectedExample === 'custom' && (
                    <button onClick={() => onSelectExample(examples[0] || '')} className="text-xs text-[#d49b6a] hover:text-[#e2aa7a] transition-colors">
                        Reset to Example
                    </button>
                )}
            </div>

            {/* Controls injected from MapperGraph via portal */}
            <div id="sidebar-controls-slot" className="flex-1 w-full"></div>

        </div>
    );
}
