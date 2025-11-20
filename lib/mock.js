// Mock implementation for Node.js modules required by WebR
export function createRequire() {
    return function require(id) {
        return {};
    };
}

export function dirname(path) {
    return '/';
}

export function fileURLToPath(url) {
    return '/';
}

export default {
    createRequire,
    dirname,
    fileURLToPath
};
