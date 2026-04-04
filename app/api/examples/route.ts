import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const exampleDir = path.join(process.cwd(), 'public', 'example');
    try {
        if (!fs.existsSync(exampleDir)) {
            return NextResponse.json({ examples: [] });
        }
        const files = fs.readdirSync(exampleDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        return NextResponse.json({ examples: jsonFiles });
    } catch (e) {
        return NextResponse.json({ examples: [] });
    }
}
