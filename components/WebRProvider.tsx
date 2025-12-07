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

                // Install necessary packages
                console.log('Installing R packages...');
                await webRInstance.installPackages(['ggplot2', 'igraph', 'jsonlite']);

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
