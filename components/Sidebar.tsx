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
        <div className="absolute top-5 bottom-5 left-5 z-[100] w-[280px] bg-[#fffdf8]/95 backdrop-blur-xl border border-[#d8d1c3] rounded-xl shadow-[0_12px_40px_rgba(21,33,29,0.08)] text-[#15211d] flex flex-col p-4 gap-3 overflow-hidden">
            {/* Dataset Selection */}
            <div className="space-y-2 shrink-0">
                <label className="text-sm font-medium text-[#52605a] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#1d5c45]" /> Example Dataset
                </label>
                <select
                    value={selectedExample === 'custom' ? 'custom' : selectedExample}
                    onChange={(e) => onSelectExample(e.target.value)}
                    className="w-full bg-[#f5f1e8] border border-[#d8d1c3] text-[#15211d] text-sm rounded-lg focus:ring-[#1d5c45] focus:border-[#1d5c45] block p-2 outline-none transition-colors"
                    disabled={selectedExample === 'custom'}
                >
                    {selectedExample === 'custom' && <option value="custom">[ Custom Uploaded File ]</option>}
                    {examples.map(ex => (
                        <option key={ex} value={ex}>{ex}</option>
                    ))}
                </select>
                {selectedExample === 'custom' && (
                    <button onClick={() => onSelectExample(examples[0] || '')} className="text-xs text-[#1d5c45] hover:text-[#183f35] font-semibold transition-colors">
                        Reset to Example
                    </button>
                )}
            </div>

            {/* Controls injected from MapperGraph via portal */}
            <div id="sidebar-controls-slot" className="flex-1 w-full"></div>

        </div>
    );
}
