const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('combined'));

// Configuration
const COUPANG_API_BASE = 'https://api-gateway.coupang.com';
const PROXY_SECRET = process.env.PROXY_SECRET; // Secret to secure this proxy

// Credentials from .env (The VM acts as the vault)
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;

// Validation
if (!ACCESS_KEY || !SECRET_KEY) {
    console.error('❌ Missing Coupang Credentials! Please set COUPANG_ACCESS_KEY and COUPANG_SECRET_KEY in .env');
    process.exit(1);
}

if (!PROXY_SECRET) {
    console.warn('⚠️  WARNING: PROXY_SECRET is not set. Your proxy is open to the public!');
}

// HMAC Signature Generator
function generateHmacSignature(method, path, query, secretKey, accessKey) {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const datetime = `${now.getUTCFullYear().toString().slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

    const message = datetime + method + path + query;

    const signature = crypto
        .createHmac('sha256', secretKey)
        .update(message)
        .digest('hex');

    const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

    return { authorization, datetime };
}

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => {
    res.send({ status: 'running', service: 'Coupang Proxy' });
});

// Proxy Endpoint
app.post('/proxy', async (req, res) => {
    // 1. Security Check
    const clientSecret = req.headers['x-proxy-secret'];
    if (PROXY_SECRET && clientSecret !== PROXY_SECRET) {
        console.log('⛔ Unauthorized access attempt');
        return res.status(401).json({ error: 'Unauthorized: Invalid Proxy Secret' });
    }

    try {
        const { method, path, query, body } = req.body;

        if (!method || !path) {
            return res.status(400).json({ error: 'Missing method or path' });
        }

        // Security: Validate path structure to prevent SSRF/manipulation
        // Coupang API paths always start with /v2/
        if (typeof path !== 'string' || !path.startsWith('/v2/')) {
            return res.status(400).json({ error: 'Invalid path: Must start with /v2/' });
        }

        const start = Date.now();
        console.log(`[Proxy] ${method} ${path}${query ? '?' + query : ''}`);

        // 2. Generate Signature
        const { authorization } = generateHmacSignature(
            method,
            path,
            query || '',
            SECRET_KEY,
            ACCESS_KEY
        );

        // 3. Forward Request to Coupang
        const url = `${COUPANG_API_BASE}${path}${query ? '?' + query : ''}`;

        const fetchOptions = {
            method: method,
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        const responseText = await response.text();

        // 4. Return Response
        // Try to parse JSON if possible
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = responseText;
        }

        console.log(`[Proxy] Response: ${response.status} (${Date.now() - start}ms)`);

        res.status(response.status).json(responseData);

    } catch (error) {
        console.error('[Proxy] Error:', error);
        res.status(500).json({
            error: 'Proxy Error',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Coupang Proxy running on port ${PORT}`);
    console.log(`🔒 Secure Mode: ${PROXY_SECRET ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔑 Access Key: ${ACCESS_KEY ? 'LOADED' : 'MISSING'}`);
});
