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
        <main className="h-screen w-full bg-black text-white overflow-hidden font-sans relative">
            <Sidebar
                interval={interval}
                setInterval={setInterval}
                overlap={overlap}
                setOverlap={setOverlap}
                clusteringMethod={clusteringMethod}
                setClusteringMethod={setClusteringMethod}
                onAboutOpen={() => setIsAboutOpen(true)}
            />
            <div className="absolute inset-0">
                <MapperGraph
                    interval={interval}
                    overlap={overlap}
                    clusteringMethod={clusteringMethod}
                    sourceData={sourceData}
                    onDataUpload={setSourceData}
                    
                />
                <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
            </div>
        </main>
    );
}
