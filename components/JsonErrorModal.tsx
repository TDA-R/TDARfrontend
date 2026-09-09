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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-all duration-300">
            <div
                className="relative w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-rose-200 bg-[#fffdf8]/98 shadow-2xl backdrop-blur-xl transform transition-all scale-100 text-[#15211d]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Ambient glowing blobs */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#1d5c45]/10 blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-6 py-4 border-b border-[#d8d1c3] bg-[#f5f1e8]/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0 shadow-sm">
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#15211d] tracking-tight">{error.title}</h2>
                            {error.fileName && (
                                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[#52605a]">
                                    <FileText className="w-3 h-3 text-[#1d5c45]" />
                                    <span className="font-mono font-medium text-[#15211d]">{error.fileName}</span>
                                </div>
                            )}
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

                {/* Body (Scrollable) */}
                <div className="relative p-6 space-y-4 overflow-y-auto text-sm">
                    {/* Error Reasons Box */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 mb-2 flex items-center gap-1.5">
                            <span>Detected Issues:</span>
                        </p>
                        <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 space-y-2 text-xs text-rose-900 leading-relaxed font-sans">
                            {error.errors.map((err, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="text-rose-600 shrink-0 font-bold">•</span>
                                    <span>{err}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Missing Fields Tags */}
                    {error.missingFields && error.missingFields.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-[#1d5c45] mb-1.5">
                                Missing Required Fields:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {error.missingFields.map((field) => (
                                    <span
                                        key={field}
                                        className="px-2.5 py-1 rounded-md bg-rose-100/70 text-rose-800 border border-rose-200 font-mono text-xs font-semibold"
                                    >
                                        {field}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Format Guide & R Snippet */}
                    <div className="rounded-xl border border-[#d8d1c3] bg-[#f5f1e8]/60 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#15211d]">
                                <Code2 className="w-4 h-4 text-[#1d5c45]" />
                                <span>Standard R Export Example</span>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-[#fffdf8] hover:bg-[#ebe5d9] border border-[#d8d1c3] text-[#15211d] transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span className="text-emerald-700 font-medium">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3 text-[#1d5c45]" />
                                        <span>Copy Code</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="p-3 rounded-lg bg-[#fffdf8] border border-[#d8d1c3] text-[#15211d] font-mono text-[11px] leading-relaxed overflow-x-auto">
                            <code>{R_EXPORT_SNIPPET}</code>
                        </pre>
                        <p className="text-[11px] text-[#52605a] leading-relaxed">
                            In R or RStudio, export your Mapper object using <code className="text-[#1d5c45] bg-[#ebe5d9] px-1 rounded">jsonlite::toJSON</code> with the 4 required fields (<code className="text-[#15211d] font-semibold">adjacency</code>, <code className="text-[#15211d] font-semibold">num_vertices</code>, <code className="text-[#15211d] font-semibold">level_of_vertex</code>, and <code className="text-[#15211d] font-semibold">points_in_vertex</code>) before uploading.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="relative px-6 py-3.5 border-t border-[#d8d1c3] bg-[#f5f1e8]/60 flex items-center justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-[#1d5c45] hover:bg-[#183f35] active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                        Close and Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
