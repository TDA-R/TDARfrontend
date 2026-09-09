'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MapperGraph } from '@/components/MapperGraph';
import { AboutModal } from '@/components/AboutModal';
import { getExamples } from '../actions';

export default function MapperPlayground() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);
  const [selectedExample, setSelectedExample] = useState<string>('');

  useEffect(() => {
    getExamples()
      .then((files) => {
        const validFiles = files && Array.isArray(files) && files.length > 0 ? files : ['iris_mapper.json'];
        setExamples(validFiles);
        setSelectedExample(validFiles[0]);
      })
      .catch((error) => {
        console.error('Failed to load examples via Server Action:', error);
        setExamples(['iris_mapper.json']);
        setSelectedExample('iris_mapper.json');
      });
  }, []);

  return (
    <main className="h-screen w-full bg-[#f5f1e8] text-[#15211d] overflow-hidden font-sans flex flex-col">
      <header className="site-header shrink-0 z-50">
        <Link className="brand" href="/mapper" aria-label="MapperAlgo">
          <span>MapperAlgo</span>
        </Link>
        <div />
        <Link className="edition" href="/">← ALL PLAYGROUNDS</Link>
      </header>

      <div className="relative flex-1 w-full overflow-hidden">
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
      </div>
    </main>
  );
}
