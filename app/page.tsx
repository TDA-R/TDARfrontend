'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MapperGraph } from '@/components/MapperGraph';
import { AboutModal } from '@/components/AboutModal';
import { getExamples } from './actions';

export default function Home() {
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [examples, setExamples] = useState<string[]>([]);
    const [selectedExample, setSelectedExample] = useState<string>('');

    useEffect(() => {
        getExamples()
            .then(files => {
                const validFiles = files && Array.isArray(files) && files.length > 0 ? files : ['iris_mapper.json'];
                setExamples(validFiles);
                setSelectedExample(validFiles[0]);
            })
            .catch(err => {
                console.error("Failed to load examples via Server Action:", err);
                setExamples(['iris_mapper.json']);
                setSelectedExample('iris_mapper.json');
            });
    }, []);

    return (
        <main className="h-screen w-full bg-[#2c1e17] text-[#fbf5f0] overflow-hidden font-sans relative">
            <Sidebar
                examples={examples}
                selectedExample={selectedExample}
                onSelectExample={setSelectedExample}
                onAboutOpen={() => setIsAboutOpen(true)}
            />
            <div className="absolute inset-0">
                {selectedExample && (
                    <MapperGraph
                        selectedExample={selectedExample}
                        onCustomUpload={() => setSelectedExample('custom')}
                    />
                )}
                <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
            </div>
        </main>
    );
}
