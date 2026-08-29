import React from 'react';
import { AlertCircle, X, ArrowRightLeft } from 'lucide-react';

export interface TypeSwitchErrorInfo {
    columnName: string;
    currentType: string;
    targetType: string;
    reason: string;
}

interface TypeSwitchErrorModalProps {
    error: TypeSwitchErrorInfo | null;
    onClose: () => void;
}

export function TypeSwitchErrorModal({ error, onClose }: TypeSwitchErrorModalProps) {
    if (!error) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300">
            <div
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-600/40 bg-[#3d2c22]/95 shadow-2xl backdrop-blur-xl transform transition-all scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Ambient glow blobs */}
                <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 border-b border-[#614738] bg-[#34241c]/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600/30 to-rose-600/30 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/30">
                            <AlertCircle className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#fdf8f4] tracking-tight">Type Conversion Disallowed</h2>
                            <p className="text-xs text-[#af9684]">Variable type toggle restriction</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[#af9684] hover:text-[#fdf8f4] hover:bg-white/10 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="relative p-6 space-y-4 text-xs">
                    {/* Target Variable Details */}
                    <div className="p-3 rounded-xl bg-[#4a3528]/80 border border-[#614738] flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#af9684]">Target Variable</span>
                            <p className="font-mono text-sm font-bold text-[#fdf8f4]">{error.columnName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                            <span className="px-2 py-0.5 rounded bg-[#34241c] text-[#af9684] border border-[#5a3f31]">
                                {error.currentType}
                            </span>
                            <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {error.targetType}
                            </span>
                        </div>
                    </div>

                    {/* Reason Box */}
                    <div className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-800/40 space-y-1.5 text-rose-100 leading-relaxed">
                        <p className="font-bold text-rose-300 flex items-center gap-1.5">
                            <span>❌ Conversion Rejected:</span>
                        </p>
                        <p className="text-[11px]">{error.reason}</p>
                    </div>

                    {/* Rule Summary Box */}
                    <div className="p-3 rounded-xl bg-[#4f3a2e]/50 border border-[#614738] space-y-1.5 text-[11px] text-[#af9684] leading-relaxed">
                        <p className="font-semibold text-[#e5cfbc]">Conversion Rules:</p>
                        <ul className="space-y-1 list-disc list-inside">
                            <li>
                                <span className="text-[#fdf8f4]">Max 30 Categories:</span> Numerical variables with &gt;30 unique values cannot be converted to categorical to prevent palette clutter.
                            </li>
                            <li>
                                <span className="text-[#fdf8f4]">Numeric Only:</span> Natively non-numeric text columns cannot be converted to numerical.
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative px-6 py-3.5 border-t border-[#614738] bg-[#34241c]/60 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-[#523d30] hover:bg-[#634b3c] active:scale-95 border border-[#755745] text-[#fdf8f4] text-xs font-medium transition-all shadow-md"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
}
