/**
 * Dynamic Proxy configuration for Angular dev server
 * Supports runtime target switching for stage-switcher functionality
 *
 * Key Implementation Details:
 * - The bypass function gets called 100+ times per single HTTP request by http-proxy-middleware
 * - We use client-provided requestId (timestamp) to deduplicate these calls
 * - Only the first invocation with a new requestId processes the switch
 * - Subsequent invocations are silently rejected with no performance impact
 */

const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, 'src/assets/config');
const environmentFile = path.join(configDir, 'environment.json');

let currentTarget = null;
let availableStages = null;

// Track the last accepted request ID to prevent duplicate processing
// (bypass function gets called 100+ times per HTTP request by http-proxy-middleware)
let lastAcceptedRequestId = 0;

function log(message) {
    const timestamp = new Date().toISOString();
    process.stderr.write(`[${timestamp}] [PROXY] ${message}\n`);
}

function getAvailableStages() {
    if (availableStages) {
        return availableStages;
    }

    try {
        const files = fs.readdirSync(configDir);
        const envFiles = files.filter((f) => f.startsWith('environment.') && f.endsWith('.json') && f !== 'environment.json');

        availableStages = envFiles.map((file) => {
            const stage = file.replace('environment.', '').replace('.json', '');
            return stage.toLowerCase();
        });

        return availableStages;
    } catch (err) {
        log(`❌ Error discovering stages: ${err.message}`);
        throw err;
    }
}

function loadStageConfig(stage) {
    const stageFile = path.join(configDir, `environment.${stage}.json`);
    try {
        if (fs.existsSync(stageFile)) {
            const data = fs.readFileSync(stageFile, 'utf8');
            const config = JSON.parse(data);
            return config.apiUrl;
        }
    } catch (err) {
        log(`⚠️  Error reading ${stage} config: ${err.message}`);
    }
    return null;
}

function loadTargetFromEnvironment() {
    try {
        if (fs.existsSync(environmentFile)) {
            const data = fs.readFileSync(environmentFile, 'utf8');
            const config = JSON.parse(data);
            const stage = config.stage?.toLowerCase() || 'syst';
            const url = loadStageConfig(stage);

            if (!url) {
                throw new Error(`Could not load apiUrl for stage: ${stage}`);
            }

            return { stage, url };
        }
    } catch (err) {
        log(`⚠️  Error reading environment file: ${err.message}`);
    }

    // Fallback to syst
    const fallbackUrl = loadStageConfig('syst');
    return { stage: 'syst', url: fallbackUrl };
}

function getCurrentTarget() {
    if (!currentTarget) {
        currentTarget = loadTargetFromEnvironment();
        log(`[INFO] Initial proxy target loaded: ${currentTarget.stage} -> ${currentTarget.url}`);
    }
    return currentTarget;
}

function setCurrentTarget(stage) {
    const stages = getAvailableStages();
    if (!stages.includes(stage)) {
        throw new Error(`Unknown stage: ${stage}. Valid stages: ${stages.join(', ')}`);
    }

    const previousStage = currentTarget?.stage;

    // Early return if stage hasn't changed
    if (previousStage === stage) {
        return currentTarget.url;
    }

    const targetUrl = loadStageConfig(stage);
    if (!targetUrl) {
        throw new Error(`Could not load apiUrl for stage: ${stage}`);
    }

    // Update in-memory cache
    currentTarget = { stage, url: targetUrl };

    // Log the switch
    log(`[SWITCH]   🔄 ${previousStage.toUpperCase() || 'NONE'} → ${stage.toUpperCase()} (${targetUrl})`);

    return targetUrl;
}

const PROXY_CONFIG = {
    '/__proxy-switch': {
        target: 'http://localhost:4200',
        bypass: (req, res) => {
            // Only handle if response not already sent
            if (res.headersSent || res.finished) {
                return true;
            }

            const url = new URL(req.url, 'http://localhost');
            const targetStage = url.searchParams.get('target');
            const requestIdParam = url.searchParams.get('requestId');

            // Parse the request ID from the client
            const requestId = requestIdParam ? parseInt(requestIdParam, 10) : 0;

            // Check if this request is older than or equal to the last one we processed
            // NOTE: The bypass function gets called 100+ times per HTTP request by http-proxy-middleware
            // This deduplication prevents multiple invocations of setCurrentTarget() for the same request
            if (requestId <= lastAcceptedRequestId) {
                // Silently reject duplicate invocations
                if (!res.headersSent && !res.finished) {
                    res.writeHead(409, {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                        Pragma: 'no-cache',
                        Expires: '0'
                    });
                    res.end(JSON.stringify({ success: false, error: 'Duplicate request' }));
                }
                return true;
            }

            // This is a new request - accept it
            lastAcceptedRequestId = requestId;

            if (targetStage) {
                try {
                    const newTarget = setCurrentTarget(targetStage);

                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                        Pragma: 'no-cache',
                        Expires: '0'
                    });
                    res.end(
                        JSON.stringify({
                            success: true,
                            stage: targetStage,
                            target: newTarget,
                            requestId: requestId,
                            availableStages: getAvailableStages()
                        })
                    );
                } catch (err) {
                    res.writeHead(400, {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                        Pragma: 'no-cache',
                        Expires: '0'
                    });
                    res.end(
                        JSON.stringify({
                            success: false,
                            error: err.message,
                            requestId: requestId,
                            availableStages: getAvailableStages()
                        })
                    );
                }
            } else {
                const current = getCurrentTarget();
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
                    Pragma: 'no-cache',
                    Expires: '0'
                });
                res.end(
                    JSON.stringify({
                        current: current.stage,
                        target: current.url,
                        requestId: requestId,
                        availableStages: getAvailableStages()
                    })
                );
            }

            return true;
        }
    },

    '/api/**': {
        target: loadStageConfig('syst'), // Default fallback (will be overridden by router)
        changeOrigin: true,
        secure: false,
        pathRewrite: {
            '^/api': ''
        },

        router: (req) => {
            const currentTarget = getCurrentTarget();
            return currentTarget.url;
        },

        configure: (proxy, options) => {
            const initialTarget = getCurrentTarget();
            const stages = getAvailableStages();
            log(`[INFO] Dynamic proxy config loaded...`);
            log(`[INFO] Initial target: ${initialTarget.stage} (${initialTarget.url})`);
            log(`[INFO] Available targets: ${stages.join(', ')}`);

            proxy.on('proxyReq', (proxyReq, req, res) => {
                const target = getCurrentTarget();
                const proxiedPath = proxyReq.path;
                log(`[REQUEST]  [${req.method}] ${target.url}${proxiedPath}`);
            });

            proxy.on('proxyRes', (proxyRes, req, res) => {
                const target = getCurrentTarget();
                log(`[RESPONSE] [${proxyRes.statusCode}] ${target.url}${req.url}`);
            });

            proxy.on('error', (err, req, res) => {
                log(`[ERROR]    ${req.url} - Error: ${err.message}`);
            });
        }
    },

    '/opus-soap': {
        target: 'https://swwwsos1.suvanet.ch/esb/services/ch_suva_wsx_crm_opus_kpm_online_v1',
        secure: false,
        changeOrigin: true,
        logLevel: 'debug',
        bypass: (req) => {
            req.headers['x-consumer-authorization'] = '811e6de51a9687054ef26cc7a9cdf553';
            req.headers['SOAPaction'] = 'urn:sap-com:document:sap:rfc:functions:ZS_CA_OPUS_KPM_ONLINE_WS:ZS_CA_OPUS_KPM_ONLINE_WSRequest';
        }
    }
};

module.exports = PROXY_CONFIG;
