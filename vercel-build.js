import fs from 'node:fs';
import path from 'node:path';
import getWebpackServeMiddleware from './src/middleware/webpack-serve.js';

globalThis.DATA_ROOT = './data';
process.chdir('.');

const middleware = getWebpackServeMiddleware();
await middleware.runWebpackCompiler({ forceDist: true, pruneCache: true });

const publicBgDir = path.resolve('public/backgrounds');
if (!fs.existsSync(publicBgDir)) {
    fs.mkdirSync(publicBgDir, { recursive: true });
    const defaultBg = path.resolve('default/content/backgrounds');
    if (fs.existsSync(defaultBg)) {
        fs.cpSync(defaultBg, publicBgDir, { recursive: true, force: true });
    }
}

const thirdPartyDir = path.resolve('public/scripts/extensions/third-party');
if (!fs.existsSync(thirdPartyDir)) {
    fs.mkdirSync(thirdPartyDir, { recursive: true });
}
