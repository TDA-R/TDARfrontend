import React, { useState } from 'react';
import { AlertCircle, FileText, Copy, Check, X, Code2 } from 'lucide-react';

export interface JsonErrorInfo {
    title: string;
    fileName?: string;
    errors: string[];
    missingFields?: string[];
    hint?: string;
}

interface JsonErrorModalProps {
    error: JsonErrorInfo | null;
    onClose: () => void;
}

const R_EXPORT_SNIPPET = `# Export Mapper object to standard JSON in R
library(jsonlite)

export_data <- list(
  adjacency = Mapper$adjacency,
  num_vertices = Mapper$num_vertices,
  level_of_vertex = Mapper$level_of_vertex,
  points_in_vertex = Mapper$points_in_vertex,
  input_params = Mapper$input_params,
  original_data = as.data.frame(all_features)
)
write(toJSON(export_data, auto_unbox = TRUE), "mapper_data.json")`;

export function JsonErrorModal({ error, onClose }: JsonErrorModalProps) {
    const [copied, setCopied] = useState(false);

    if (!error) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(R_EXPORT_SNIPPET);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md transition-all duration-300">
            <div
                className="relative w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-rose-900/40 bg-[#3d2c22]/95 shadow-2xl backdrop-blur-xl transform transition-all scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Ambient glowing blobs */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-rose-600/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#d49b6a]/15 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 border-b border-[#614738] bg-[#34241c]/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600/30 to-amber-700/30 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-rose-950/30">
                            <AlertCircle className="w-5 h-5 text-rose-300" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#fdf8f4] tracking-tight">{error.title}</h2>
                            {error.fileName && (
                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#af9684]">
                                    <FileText className="w-3 h-3 text-[#d49b6a]" />
                                    <span className="font-mono text-[#e5cfbc]">{error.fileName}</span>
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
                    {/* Error Reasons Box */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-rose-300/90 mb-2 flex items-center gap-1.5">
                            <span>Detected Issues:</span>
                        </p>
                        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-2 text-xs text-rose-100/90 leading-relaxed font-sans">
                            {error.errors.map((err, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="text-rose-400 shrink-0 font-bold">•</span>
                                    <span>{err}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Missing Fields Tags */}
                    {error.missingFields && error.missingFields.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#d49b6a] mb-1.5">
                                Missing Required Fields:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {error.missingFields.map((field) => (
                                    <span
                                        key={field}
                                        className="px-2.5 py-1 rounded-md bg-[#4f3a2e] text-rose-300 border border-rose-700/50 font-mono text-xs font-semibold"
                                    >
                                        {field}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Format Guide & R Snippet */}
                    <div className="rounded-xl border border-[#614738] bg-[#4f3a2e]/50 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#e5cfbc]">
                                <Code2 className="w-4 h-4 text-[#d49b6a]" />
                                <span>Standard R Export Example</span>
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
                            <code>{R_EXPORT_SNIPPET}</code>
                        </pre>
                        <p className="text-[11px] text-[#af9684] leading-relaxed">
                            In R or RStudio, export your Mapper object using <code className="text-[#d49b6a] bg-[#34241c] px-1 rounded">jsonlite::toJSON</code> with the 4 required fields (<code className="text-[#e5cfbc]">adjacency</code>, <code className="text-[#e5cfbc]">num_vertices</code>, <code className="text-[#e5cfbc]">level_of_vertex</code>, and <code className="text-[#e5cfbc]">points_in_vertex</code>) before uploading.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative px-6 py-3.5 border-t border-[#614738] bg-[#34241c]/60 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-[#523d30] hover:bg-[#634b3c] active:scale-95 border border-[#755745] text-[#fdf8f4] text-xs font-medium transition-all shadow-md"
                    >
                        Close and Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
