/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {
        resolveAlias: {
            'module': './lib/mock.js',
            'fs': './lib/mock.js',
            'path': './lib/mock.js',
            'crypto': './lib/mock.js',
            'url': './lib/mock.js',
        },
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
                module: false,
            };
        }
        return config;
    },
};

module.exports = nextConfig;
