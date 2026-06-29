import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

import { createApp } from '../src/server-app.js';
import { initConfig } from '../src/config-init.js';
import { initUserStorage, ensurePublicDirectoriesExist } from '../src/users.js';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const DATA_ROOT = isVercel ? '/tmp/sillytavern-data' : path.resolve('./data');

globalThis.DATA_ROOT = DATA_ROOT;
globalThis.VERCEL = true;

if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
}

const configPaths = ['./config.yaml', './vercel.config.yaml'];
const configPath = configPaths.find(p => fs.existsSync(p)) || configPaths[0];
initConfig(configPath);

process.chdir(path.resolve('.'));

const DATA_ROOT_PATH = DATA_ROOT;

globalThis.COMMAND_LINE_ARGS = {
    configPath: configPath,
    dataRoot: DATA_ROOT_PATH,
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

await initUserStorage(DATA_ROOT_PATH);
await ensurePublicDirectoriesExist();
const app = await createApp(globalThis.COMMAND_LINE_ARGS);

export default app;
