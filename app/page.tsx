'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MapperGraph } from '@/components/MapperGraph';

import { AboutModal } from '@/components/AboutModal';

export default function Home() {
    const [interval, setInterval] = useState(15);
    const [overlap, setOverlap] = useState(30);
    const [clusteringMethod, setClusteringMethod] = useState('dbscan');
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [sourceData, setSourceData] = useState<any[] | null>(null);

    return (
        <main className="flex h-screen w-full bg-black text-white overflow-hidden font-sans">
            <Sidebar
                interval={interval}
                setInterval={setInterval}
                overlap={overlap}
                setOverlap={setOverlap}
                clusteringMethod={clusteringMethod}
                setClusteringMethod={setClusteringMethod}
            />
            <div className="flex-1 h-full relative">
                <MapperGraph
                    interval={interval}
                    overlap={overlap}
                    clusteringMethod={clusteringMethod}
                    sourceData={sourceData}
                    onDataUpload={setSourceData}
                />

                {/* About Button */}
                <button
                    onClick={() => setIsAboutOpen(true)}
                    className="fixed bottom-6 right-6 z-50 p-2.5 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all shadow-lg group"
                    title="About TDA-R Mapper"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 text-xs rounded border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        About
                    </span>
                </button>

                <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
            </div>
        </main>
    );
}
