'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MapperGraph } from '@/components/MapperGraph';

export default function Home() {
    const [interval, setInterval] = useState(15);
    const [overlap, setOverlap] = useState(30);
    const [clusteringMethod, setClusteringMethod] = useState('dbscan');

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
                />
            </div>
        </main>
    );
}
