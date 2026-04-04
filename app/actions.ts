'use server';

import fs from 'fs';

export async function getExamples() {
    const exampleDir = process.cwd() + '/public/example';
    try {
        if (!fs.existsSync(exampleDir)) {
            return [];
        }
        const files = fs.readdirSync(exampleDir);
        return files.filter(f => f.endsWith('.json'));
    } catch (e) {
        console.error(e);
        return [];
    }
}
