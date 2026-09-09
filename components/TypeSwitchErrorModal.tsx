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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-all duration-300">
            <div
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#d8d1c3] bg-[#fffdf8]/98 shadow-2xl backdrop-blur-xl transform transition-all scale-100 text-[#15211d]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Ambient glow blobs */}
                <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[#1d5c45]/10 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 border-b border-[#d8d1c3] bg-[#f5f1e8]/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 shadow-sm">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#15211d] tracking-tight">Type Conversion Disallowed</h2>
                            <p className="text-xs text-[#52605a]">Variable type toggle restriction</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[#65706a] hover:text-[#15211d] hover:bg-black/5 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="relative p-6 space-y-4 text-xs">
                    {/* Target Variable Details */}
                    <div className="p-3 rounded-xl bg-[#f5f1e8]/90 border border-[#d8d1c3] flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#52605a]">Target Variable</span>
                            <p className="font-mono text-sm font-bold text-[#15211d]">{error.columnName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold">
                            <span className="px-2 py-0.5 rounded bg-[#fffdf8] text-[#52605a] border border-[#d8d1c3]">
                                {error.currentType}
                            </span>
                            <ArrowRightLeft className="w-3 h-3 text-[#1d5c45]" />
                            <span className="px-2 py-0.5 rounded bg-[#dcebe1] text-[#1d5c45] border border-[#bce6cb]">
                                {error.targetType}
                            </span>
                        </div>
                    </div>

                    {/* Reason Box */}
                    <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 space-y-1.5 text-rose-900 leading-relaxed">
                        <p className="font-bold text-rose-700 flex items-center gap-1.5">
                            <span>❌ Conversion Rejected:</span>
                        </p>
                        <p className="text-[11px]">{error.reason}</p>
                    </div>

                    {/* Rule Summary Box */}
                    <div className="p-3 rounded-xl bg-[#f5f1e8]/60 border border-[#d8d1c3] space-y-1.5 text-[11px] text-[#52605a] leading-relaxed">
                        <p className="font-semibold text-[#15211d]">Conversion Rules:</p>
                        <ul className="space-y-1 list-disc list-inside">
                            <li>
                                <span className="text-[#15211d] font-medium">Max 30 Categories:</span> Numerical variables with &gt;30 unique values cannot be converted to categorical to prevent palette clutter.
                            </li>
                            <li>
                                <span className="text-[#15211d] font-medium">Numeric Only:</span> Natively non-numeric text columns cannot be converted to numerical.
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative px-6 py-3.5 border-t border-[#d8d1c3] bg-[#f5f1e8]/60 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-[#1d5c45] hover:bg-[#183f35] active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
}
