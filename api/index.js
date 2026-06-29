import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

import { initConfig } from '../src/config-init.js';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const DATA_ROOT = isVercel ? '/tmp/sillytavern-data' : path.resolve('./data');

globalThis.DATA_ROOT = DATA_ROOT;
globalThis.VERCEL = true;

if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
}

const sourceConfig = ['./vercel.config.yaml', './config.yaml'].find(p => fs.existsSync(p));
const configPath = path.join(DATA_ROOT, 'config.yaml');

if (sourceConfig) {
    const content = fs.readFileSync(sourceConfig, 'utf8');
    fs.writeFileSync(configPath, content, 'utf8');
} else {
    fs.writeFileSync(configPath, '{}', 'utf8');
}

initConfig(configPath);

globalThis.COMMAND_LINE_ARGS = {
    configPath: configPath,
    dataRoot: DATA_ROOT,
    port: 8000,
    listen: false,
    listenAddressIPv6: '[::]',
    listenAddressIPv4: '0.0.0.0',
    enableIPv4: true,
    enableIPv6: false,
    dnsPreferIPv6: false,
    heartbeatInterval: 0,
    browserLaunchEnabled: false,
    browserLaunchHostname: 'auto',
    browserLaunchPort: -1,
    browserLaunchAvoidLocalhost: false,
    enableCorsProxy: false,
    disableCsrf: false,
    ssl: false,
    certPath: 'certs/cert.pem',
    keyPath: 'certs/privkey.pem',
    keyPassphrase: '',
    whitelistMode: false,
    basicAuthMode: false,
    enableKeepAlive: false,
    requestProxyEnabled: false,
    requestProxyUrl: '',
    requestProxyBypass: [],
    getIPv4ListenUrl: () => new URL('http://127.0.0.1:8000'),
    getIPv6ListenUrl: () => new URL('http://[::1]:8000'),
    getBrowserLaunchHostname: async () => 'localhost',
    getBrowserLaunchUrl: (hostname) => new URL(`http://${hostname}:8000`),
};

const { initUserStorage, ensurePublicDirectoriesExist } = await import('../src/users.js');
const { createApp } = await import('../src/server-app.js');

await initUserStorage(DATA_ROOT);
try {
    await ensurePublicDirectoriesExist();
} catch (error) {
    console.warn('Some directories could not be created (expected on Vercel read-only fs):', error.message);
}

const distWebpack = path.resolve('dist/_webpack');
if (fs.existsSync(distWebpack)) {
    const target = path.join(DATA_ROOT, '_webpack');
    if (!fs.existsSync(target)) {
        fs.cpSync(distWebpack, target, { recursive: true, force: true });
    }
}

const app = await createApp(globalThis.COMMAND_LINE_ARGS);

export default app;
