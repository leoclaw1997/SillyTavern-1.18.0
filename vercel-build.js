import getWebpackServeMiddleware from './src/middleware/webpack-serve.js';

globalThis.DATA_ROOT = './data';
process.chdir('.');

const middleware = getWebpackServeMiddleware();
await middleware.runWebpackCompiler({ forceDist: true, pruneCache: true });
