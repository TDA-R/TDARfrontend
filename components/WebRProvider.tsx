'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface WebRContextType {
    webR: any; // WebR type is not available at compile time due to dynamic import
    isLoading: boolean;
    error: string | null;
}

const WebRContext = createContext<WebRContextType>({
    webR: null,
    isLoading: true,
    error: null,
});

export function WebRProvider({ children }: { children: React.ReactNode }) {
    const [webR, setWebR] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initWebR = async () => {
            try {
                console.log('Initializing WebR...');
                // Dynamically import WebR to avoid SSR issues
                const { WebR } = await import('webr');
                const webRInstance = new WebR();
                await webRInstance.init();
                console.log('WebR Initialized!');

                // Install dependencies first
                console.log('Installing R packages...');
                await webRInstance.installPackages(['ggplot2', 'igraph', 'jsonlite', 'dbscan', 'cluster', 'foreach']);

                // Load dependencies
                await webRInstance.evalR("library(foreach); library(igraph); library(cluster); library(ggplot2);");

                // Load custom MapperAlgo source code (Simulating package installation)
                console.log('Loading custom MapperAlgo source...');
                const response = await fetch('/MapperAlgo_combined.R');
                if (!response.ok) throw new Error('Failed to fetch MapperAlgo source');
                const scriptText = await response.text();
                await webRInstance.FS.writeFile('/MapperAlgo_combined.R', new TextEncoder().encode(scriptText));
                await webRInstance.evalR("source('/MapperAlgo_combined.R')");

                setWebR(webRInstance);
            } catch (err: any) {
                console.error('Failed to initialize WebR:', err);
                setError(err.message || 'Failed to initialize WebR');
            } finally {
                setIsLoading(false);
            }
        };

        initWebR();
    }, []);

    return (
        <WebRContext.Provider value={{ webR, isLoading, error }}>
            {children}
        </WebRContext.Provider>
    );
}

export const useWebR = () => useContext(WebRContext);
