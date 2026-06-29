import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import cors from 'cors';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import compression from 'compression';
import cookieSession from 'cookie-session';
import multer from 'multer';
import responseTime from 'response-time';
import helmet from 'helmet';
import bodyParser from 'body-parser';

import './fetch-patch.js';
import { serverDirectory } from './server-directory.js';

import {
    getCookieSecret,
    getCookieSessionName,
    requireLoginMiddleware,
    setUserDataMiddleware,
    shouldRedirectToLogin,
    getSessionCookieAge,
    loginPageMiddleware,
} from './users.js';

import getWebpackServeMiddleware from './middleware/webpack-serve.js';
import basicAuthMiddleware from './middleware/basicAuth.js';
import getWhitelistMiddleware from './middleware/whitelist.js';
import accessLoggerMiddleware from './middleware/accessLogWriter.js';
import multerMonkeyPatch from './middleware/multerMonkeyPatch.js';
import cacheBuster from './middleware/cacheBuster.js';
import corsProxyMiddleware from './middleware/corsProxy.js';
import hostWhitelistMiddleware from './middleware/hostWhitelist.js';
import userCssMiddleware from './middleware/userCss.js';
import { getConfigValue, color, getVersion } from './util.js';
import { UPLOADS_DIRECTORY } from './constants.js';

import { router as usersPublicRouter } from './endpoints/users-public.js';
import { redirectDeprecatedEndpoints, setupPrivateEndpoints } from './server-startup.js';

export async function createApp(cliArgs) {
    const app = express();
    app.use(helmet({
        contentSecurityPolicy: false,
    }));
    app.use(compression());
    app.use(responseTime());

    app.use(bodyParser.json({ limit: '500mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));

    const corsEnabled = getConfigValue('cors.enabled', true, 'boolean');
    if (corsEnabled) {
        const corsOrigin = getConfigValue('cors.origin', 'null');
        const corsMethods = getConfigValue('cors.methods', ['OPTIONS']);
        const corsAllowedHeaders = getConfigValue('cors.allowedHeaders', []);
        const corsExposedHeaders = getConfigValue('cors.exposedHeaders', []);
        const corsCredentials = getConfigValue('cors.credentials', false, 'boolean');
        const corsMaxAge = getConfigValue('cors.maxAge', null, 'number');

        const corsOptions = {
            origin: corsOrigin,
            methods: corsMethods,
            credentials: corsCredentials,
        };
        if (Array.isArray(corsAllowedHeaders) && corsAllowedHeaders.length > 0) {
            corsOptions.allowedHeaders = corsAllowedHeaders;
        }
        if (Array.isArray(corsExposedHeaders) && corsExposedHeaders.length > 0) {
            corsOptions.exposedHeaders = corsExposedHeaders;
        }
        if (corsMaxAge !== null && Number.isInteger(corsMaxAge)) {
            corsOptions.maxAge = corsMaxAge;
        }
        app.use(cors(corsOptions));
    }

    if (cliArgs.listen && cliArgs.basicAuthMode) {
        app.use(basicAuthMiddleware);
    }

    if (cliArgs.whitelistMode) {
        const whitelistMiddleware = await getWhitelistMiddleware();
        app.use(whitelistMiddleware);
    }

    app.use(hostWhitelistMiddleware);

    if (cliArgs.listen) {
        app.use(accessLoggerMiddleware());
    }

    app.use(cookieSession({
        name: getCookieSessionName(),
        sameSite: 'lax',
        httpOnly: true,
        maxAge: getSessionCookieAge(),
        secret: getCookieSecret(globalThis.DATA_ROOT),
    }));

    app.use(setUserDataMiddleware);

    if (!cliArgs.disableCsrf) {
        const csrfSyncProtection = csrfSync({
            getTokenFromState: (req) => {
                if (!req.session) {
                    console.error('(CSRF error) getTokenFromState: Session object not initialized');
                    return;
                }
                return req.session.csrfToken;
            },
            getTokenFromRequest: (req) => {
                return req.headers['x-csrf-token']?.toString();
            },
            storeTokenInState: (req, token) => {
                if (!req.session) {
                    console.error('(CSRF error) storeTokenInState: Session object not initialized');
                    return;
                }
                req.session.csrfToken = token;
            },
            skipCsrfProtection: (req) => {
                return cliArgs.enableCorsProxy ? /^\/proxy\//.test(req.path) : false;
            },
            size: 32,
        });

        app.get('/csrf-token', (req, res) => {
            res.json({
                'token': csrfSyncProtection.generateToken(req),
            });
        });

        csrfSyncProtection.invalidCsrfTokenError.message = color.red('Invalid CSRF token. Please refresh the page and try again.');
        csrfSyncProtection.invalidCsrfTokenError.stack = undefined;

        app.use(csrfSyncProtection.csrfSynchronisedProtection);
    } else {
        console.warn('\nCSRF protection is disabled. This will make your server vulnerable to CSRF attacks.\n');
        app.get('/csrf-token', (req, res) => {
            res.json({
                'token': 'disabled',
            });
        });
    }

    app.get('/', cacheBuster.middleware, (request, response) => {
        if (shouldRedirectToLogin(request)) {
            const query = request.url.split('?')[1];
            const redirectUrl = query ? `/login?${query}` : '/login';
            return response.redirect(redirectUrl);
        }
        return response.sendFile('index.html', { root: path.join(serverDirectory, 'public') });
    });

    app.get('/callback/:source?', (request, response) => {
        const source = request.params.source;
        const query = request.url.split('?')[1];
        const searchParams = new URLSearchParams();
        source && searchParams.set('source', source);
        query && searchParams.set('query', query);
        const redirectPath = `/?${searchParams.toString()}`;
        return response.redirect(307, redirectPath);
    });

    app.get('/login', loginPageMiddleware);

    const webpackMiddleware = getWebpackServeMiddleware();
    app.use(webpackMiddleware);
    app.use(userCssMiddleware);
    app.use(express.static(path.join(serverDirectory, 'public'), {}));

    app.use('/api/users', usersPublicRouter);

    app.use(requireLoginMiddleware);
    app.post('/api/ping', (request, response) => {
        if (request.query.extend && request.session) {
            request.session.touch = Date.now();
        }
        response.sendStatus(204);
    });

    if (cliArgs.enableCorsProxy) {
        app.use('/proxy/:url(*)', corsProxyMiddleware);
    } else {
        app.use('/proxy/:url(*)', async (_, res) => {
            const message = 'CORS proxy is disabled. Enable it in config.yaml or use the --corsProxy flag.';
            console.log(message);
            res.status(404).send(message);
        });
    }

    const uploadsPath = path.join(cliArgs.dataRoot, UPLOADS_DIRECTORY);
    app.use(multer({ dest: uploadsPath, limits: { fieldSize: 500 * 1024 * 1024 } }).single('avatar'));
    app.use(multerMonkeyPatch);

    app.get('/version', async function (_, response) {
        const data = await getVersion();
        response.send(data);
    });

    redirectDeprecatedEndpoints(app);
    setupPrivateEndpoints(app);

    return app;
}
