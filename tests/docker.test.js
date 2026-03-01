/**
 * Docker integration tests
 *
 * Tests the built image end-to-end: CLI commands and web server API.
 * No Actual Budget or Yahoo Finance connection is required.
 *
 * Environment variables:
 *   TEST_IMAGE  – image to test (default: builds 'helvetfolio-test' locally)
 *   TEST_PORT   – host port for the web container (default: 13001)
 *
 * Run:
 *   npm run test:docker
 *   TEST_IMAGE=flawas/helvetfolio:latest npm run test:docker
 */

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execAsync = promisify(exec);

const IMAGE = process.env.TEST_IMAGE ?? 'helvetfolio-test';
const WEB_PORT = process.env.TEST_PORT ?? '13001';
const BASE_URL = `http://localhost:${WEB_PORT}`;

// Build the image locally unless TEST_IMAGE is provided.
async function ensureImage() {
    if (process.env.TEST_IMAGE) return;
    await execAsync(`docker build -t ${IMAGE} .`, { timeout: 180_000 });
}

// Run a one-shot CLI command inside a fresh container.
function cliRun(dataDir, ...args) {
    return execAsync(
        `docker run --rm \
            -v "${dataDir}:/app/data" \
            -e PORTFOLIO_FILE=/app/data/portfolio.json \
            -e ACTUAL_DATA_DIR=/app/data \
            ${IMAGE} ${args.join(' ')}`,
        { timeout: 30_000 }
    );
}

// Poll until the web server is accepting requests.
async function waitForReady(maxMs = 30_000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${BASE_URL}/api/portfolio`);
            if (res.ok) return;
        } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error(`Web server not ready after ${maxMs}ms`);
}

// Build image once before all suites.
before(ensureImage, { timeout: 180_000 });

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

describe('CLI', async () => {
    let dataDir;

    before(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'helvetfolio-cli-'));
    });

    after(async () => {
        await rm(dataDir, { recursive: true, force: true });
    });

    test('list exits 0 with empty portfolio', async () => {
        const { stdout } = await cliRun(dataDir, 'list');
        assert.match(stdout, /Portfolio is empty/i);
    });

    test('performance exits 0 with empty portfolio', async () => {
        const { stdout } = await cliRun(dataDir, 'performance');
        assert.match(stdout, /Portfolio is empty/i);
    });

    test('--help prints usage', async () => {
        const { stdout } = await cliRun(dataDir, '--help');
        assert.match(stdout, /helvetfolio/i);
    });

    test('portfolio.json is created inside the data directory', async () => {
        const portfolioPath = join(dataDir, 'portfolio.json');
        const info = await stat(portfolioPath);
        assert.ok(info.isFile());
    });

    test('unknown command exits with non-zero code', async () => {
        await assert.rejects(cliRun(dataDir, 'not-a-command'));
    });
});

// ---------------------------------------------------------------------------
// Web server
// ---------------------------------------------------------------------------

describe('Web server', async () => {
    let dataDir;
    let containerId;

    before(async () => {
        dataDir = await mkdtemp(join(tmpdir(), 'helvetfolio-web-'));

        const { stdout } = await execAsync(
            `docker run -d \
                -p "${WEB_PORT}:3000" \
                -v "${dataDir}:/app/data" \
                -e PORTFOLIO_FILE=/app/data/portfolio.json \
                -e ACTUAL_DATA_DIR=/app/data \
                --entrypoint node \
                ${IMAGE} /app/src/web-server.js`,
            { timeout: 15_000 }
        );
        containerId = stdout.trim();
        await waitForReady();
    }, { timeout: 60_000 });

    after(async () => {
        if (containerId) {
            await execAsync(`docker stop ${containerId} && docker rm ${containerId}`).catch(() => {});
        }
        await rm(dataDir, { recursive: true, force: true });
    });

    async function api(method, path, body) {
        const opts = {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        };
        if (body) opts.body = JSON.stringify(body);
        return fetch(`${BASE_URL}${path}`, opts);
    }

    // Portfolio

    test('GET /api/portfolio returns empty portfolio', async () => {
        const res = await api('GET', '/api/portfolio');
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.totalStocks, 0);
        assert.deepEqual(body.stocks, []);
    });

    test('GET /api/performance returns zeroed totals', async () => {
        const res = await api('GET', '/api/performance');
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.totalStocks, 0);
        assert.equal(body.totalValue, 0);
        assert.equal(body.totalGain, 0);
    });

    // Connection settings

    test('GET /api/connection returns an object', async () => {
        const res = await api('GET', '/api/connection');
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(typeof body, 'object');
    });

    test('POST /api/connection persists settings', async () => {
        const res = await api('POST', '/api/connection', {
            serverURL: 'http://test-actual:5006',
            password: 'testpass',
            budgetId: 'test-budget-id'
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
    });

    test('GET /api/connection reflects persisted serverURL', async () => {
        const res = await api('GET', '/api/connection');
        const body = await res.json();
        assert.equal(body.serverURL, 'http://test-actual:5006');
    });

    test('DELETE /api/connection resets settings', async () => {
        const res = await api('DELETE', '/api/connection');
        assert.equal(res.status, 200);
    });

    // Stock mutations without external services

    test('POST /api/stocks returns error without Actual Budget', async () => {
        const res = await api('POST', '/api/stocks', { ticker: 'NESN', quantity: 10 });
        // Expects a 4xx/5xx — not a crash
        assert.ok(res.status >= 400);
    });

    test('DELETE /api/stocks/:ticker returns 400 for unknown ticker', async () => {
        const res = await api('DELETE', '/api/stocks/UNKNOWN');
        assert.equal(res.status, 400);
    });

    test('PUT /api/stocks/:ticker/quantity returns 400 for unknown ticker', async () => {
        const res = await api('PUT', '/api/stocks/UNKNOWN/quantity', { quantity: 5 });
        assert.equal(res.status, 400);
    });

    test('PATCH /api/stocks/:ticker returns 400 for unknown ticker', async () => {
        const res = await api('PATCH', '/api/stocks/UNKNOWN', { purchasePrice: 99.99 });
        assert.equal(res.status, 400);
    });

    // Static assets

    test('GET / serves index.html', async () => {
        const res = await fetch(`${BASE_URL}/`);
        assert.equal(res.status, 200);
        const text = await res.text();
        assert.match(text, /<html/i);
    });

    // Data persistence

    test('portfolio.json is created inside the data volume', async () => {
        const info = await stat(join(dataDir, 'portfolio.json'));
        assert.ok(info.isFile());
    });
});
