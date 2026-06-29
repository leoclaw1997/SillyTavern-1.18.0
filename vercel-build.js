import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

console.log('[vercel-build] Starting build script...');

const publicBgDir = path.resolve('public/backgrounds');
if (!fs.existsSync(publicBgDir)) {
    console.log('[vercel-build] Creating public/backgrounds/');
    fs.mkdirSync(publicBgDir, { recursive: true });
    const defaultBg = path.resolve('default/content/backgrounds');
    if (fs.existsSync(defaultBg)) {
        console.log('[vercel-build] Copying default backgrounds');
        fs.cpSync(defaultBg, publicBgDir, { recursive: true, force: true });
    }
} else {
    console.log('[vercel-build] public/backgrounds/ already exists');
}

const thirdPartyDir = path.resolve('public/scripts/extensions/third-party');
if (!fs.existsSync(thirdPartyDir)) {
    console.log('[vercel-build] Creating public/scripts/extensions/third-party/');
    fs.mkdirSync(thirdPartyDir, { recursive: true });
} else {
    console.log('[vercel-build] public/scripts/extensions/third-party/ already exists');
}

import getWebpackServeMiddleware from './src/middleware/webpack-serve.js';
globalThis.DATA_ROOT = './data';
const middleware = getWebpackServeMiddleware();
console.log('[vercel-build] Running webpack compiler...');
await middleware.runWebpackCompiler({ forceDist: true, pruneCache: true });
console.log('[vercel-build] Build complete.');
