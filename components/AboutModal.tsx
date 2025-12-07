import React from 'react';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
            <div
                className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 shadow-2xl backdrop-blur-xl transform transition-all scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Decorative gradient blob */}
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none"></div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Content */}
                <div className="relative p-8 text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">TDA-R Mapper</h2>
                    <p className="text-zinc-400 text-sm mb-8">Advanced Topological Data Analysis Visualization</p>

                    <div className="space-y-6 text-left">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Created By</h3>
                            <a
                                href="https://kennywang112.github.io/Profile/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-lg font-medium text-white hover:text-blue-300 transition-colors flex items-center gap-2 group"
                            >
                                Kenny Wang
                                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </a>
                        </div>

                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1">Powered By</h3>
                            <div className="flex flex-col gap-2">
                                <a
                                    href="https://github.com/TDA-R"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white hover:text-purple-300 transition-colors flex items-center gap-2"
                                >
                                    <span className="font-mono">TDA-R Organization</span>
                                </a>
                                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                    <span>•</span>
                                    <span>R Backend Integration</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5 text-xs text-zinc-500">
                        © {new Date().getFullYear()} TDA-R Mapper. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    );
}
