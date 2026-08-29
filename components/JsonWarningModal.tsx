import React, { useState } from 'react';
import { AlertTriangle, FileText, Copy, Check, X, Code2, ArrowRight } from 'lucide-react';
import { MapperWarning } from '@/lib/r-script';

export interface JsonWarningInfo {
    fileName?: string;
    warnings: MapperWarning[];
}

interface JsonWarningModalProps {
    warningInfo: JsonWarningInfo | null;
    onClose: () => void;
}

const R_EXPORT_FULL_SNIPPET = `# Export Mapper object with complete metadata in R
library(jsonlite)

export_data <- list(
  adjacency = Mapper$adjacency,
  num_vertices = Mapper$num_vertices,
  level_of_vertex = Mapper$level_of_vertex,
  points_in_vertex = Mapper$points_in_vertex,
  input_params = Mapper$input_params,
  original_data = as.data.frame(mnist_all)
)
write(toJSON(export_data, auto_unbox = TRUE), "mapper_data.json")`;

export function JsonWarningModal({ warningInfo, onClose }: JsonWarningModalProps) {
    const [copied, setCopied] = useState(false);

    if (!warningInfo || warningInfo.warnings.length === 0) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(R_EXPORT_FULL_SNIPPET);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300">
            <div
                className="relative w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-amber-500/40 bg-[#3d2c22]/95 shadow-2xl backdrop-blur-xl transform transition-all scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Ambient amber & coffee glowing blobs */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#d49b6a]/15 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 border-b border-[#614738] bg-[#34241c]/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/30 border border-amber-500/50 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/30">
                            <AlertTriangle className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-[#fdf8f4] tracking-tight">Missing Optional Data Fields</h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Warning
                                </span>
                            </div>
                            {warningInfo.fileName && (
                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#af9684]">
                                    <FileText className="w-3 h-3 text-[#d49b6a]" />
                                    <span className="font-mono text-[#e5cfbc]">{warningInfo.fileName}</span>
                                </div>
                            )}
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

                {/* Body (Scrollable) */}
                <div className="relative p-6 space-y-4 overflow-y-auto text-sm">
                    <p className="text-xs text-[#d6c3b4] leading-relaxed">
                        The topological graph structure was parsed and loaded successfully. However, the following optional fields are missing from your JSON, which will disable certain analytical features:
                    </p>

                    {/* Warning Cards */}
                    <div className="space-y-3">
                        {warningInfo.warnings.map((warn) => (
                            <div
                                key={warn.field}
                                className="p-4 rounded-xl bg-[#4a3528]/70 border border-amber-600/35 space-y-2.5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                        <span className="font-mono text-xs font-bold text-amber-200 bg-[#34241c] px-2 py-0.5 rounded border border-amber-600/40">
                                            {warn.field}
                                        </span>
                                        <span className="text-xs font-semibold text-[#fdf8f4]">{warn.title}</span>
                                    </div>
                                    <span className="text-[11px] text-amber-300/80 font-medium">Feature impact</span>
                                </div>

                                <div className="space-y-1.5 pl-4 border-l-2 border-amber-600/40 text-xs text-[#e8dbcf] leading-relaxed">
                                    {warn.impacts.map((impact, i) => (
                                        <div key={i} className="flex items-start gap-1.5">
                                            <span className="text-amber-400 font-bold shrink-0">•</span>
                                            <span>{impact}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Format Guide & R Snippet */}
                    <div className="rounded-xl border border-[#614738] bg-[#4f3a2e]/50 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#e5cfbc]">
                                <Code2 className="w-4 h-4 text-[#d49b6a]" />
                                <span>Complete R Export Format (Recommended)</span>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-[#523d30] hover:bg-[#634b3c] border border-[#755745] text-[#fdf8f4] transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-300">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3 text-[#d49b6a]" />
                                        <span>Copy Code</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-[#241711] border border-[#4d372b] text-[#f1e6de] font-mono text-[11px] leading-relaxed overflow-x-auto">
                            <code>{R_EXPORT_FULL_SNIPPET}</code>
                        </pre>
                        <p className="text-[11px] text-[#af9684] leading-relaxed">
                            Include both <code className="text-amber-300 bg-[#34241c] px-1 rounded">input_params</code> and <code className="text-amber-300 bg-[#34241c] px-1 rounded">original_data</code> when exporting in R to unlock full node inspection, dynamic coloring, parameter display, and raw data export.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative px-6 py-3.5 border-t border-[#614738] bg-[#34241c]/60 flex items-center justify-between">
                    <span className="text-[11px] text-[#af9684]">
                        You can continue using the graph with basic topological features.
                    </span>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#d49b6a] hover:bg-[#e2aa7a] active:scale-95 text-[#2c1e17] font-semibold text-xs transition-all shadow-md"
                    >
                        <span>Got it, Proceed to Graph</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
