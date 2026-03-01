import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import PortfolioManager from './portfolio-manager.js';
import { debug } from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// WEB_PASSWORD env var is a hard override. When not set, the password stored
// in portfolio.json (set via the Settings UI) is used instead.
const ENV_PASSWORD = process.env.WEB_PASSWORD;

// Base configuration from environment (portfolio.json settings overlay at runtime)
const config = {
    dataDir: process.env.ACTUAL_DATA_DIR || './data',
    exchangeSuffix: process.env.STOCK_EXCHANGE_SUFFIX || '.SW'
};

const portfolioFile = process.env.PORTFOLIO_FILE || './portfolio.json';

// Singleton PortfolioManager — shared across all requests so that the
// StockFetcher price cache survives between calls and the Actual Budget
// API client is only initialised once rather than once per request.
const manager = new PortfolioManager(portfolioFile, config);

// Async mutex — serialises all operations that touch the Actual Budget API,
// preventing concurrent downloads/syncs on the module-level singleton client.
let _lock = Promise.resolve();
function withLock(fn) {
    const result = _lock.then(fn);
    _lock = result.catch(() => {}); // Advance the chain even when fn throws
    return result;
}

// Returns the currently active web password:
//   ENV_PASSWORD (env var) takes hard precedence over the portfolio.json value.
function currentWebPassword() {
    return ENV_PASSWORD || manager.actualConfig?.webPassword || '';
}

// HTTP Basic Auth middleware.
// No-op when no password is configured.
// The browser caches credentials for the session, so all subsequent
// fetch() calls from the SPA automatically include the Authorization header.
function requireAuth(req, res, next) {
    const pwd = currentWebPassword();
    if (!pwd) return next();

    const header = req.headers.authorization || '';
    if (!header.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Helvetfolio"');
        return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const password = decoded.slice(decoded.indexOf(':') + 1);
    if (password !== pwd) {
        res.set('WWW-Authenticate', 'Basic realm="Helvetfolio"');
        return res.status(401).json({ error: 'Incorrect password' });
    }

    next();
}

// Middleware
app.use(requireAuth);           // Auth gate (no-op when no password configured)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Portfolio Routes ────────────────────────────────────────────────────────

// Get portfolio summary (file read only — no Actual Budget needed)
app.get('/api/portfolio', async (req, res) => {
    try {
        const summary = await manager.getPortfolioSummary();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get portfolio performance with gain/loss (file read only)
app.get('/api/performance', async (req, res) => {
    try {
        const performance = await manager.getPortfolioWithPerformance();
        res.json(performance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add stock
app.post('/api/stocks', async (req, res) => {
    try {
        const { ticker, quantity, purchaseDate, purchasePrice } = req.body;

        if (!ticker || !quantity) {
            return res.status(400).json({ error: 'Ticker and quantity are required' });
        }

        const options = {};
        if (purchaseDate) options.purchaseDate = purchaseDate;
        if (purchasePrice) options.purchasePrice = parseFloat(purchasePrice);

        const stock = await manager.addStock(ticker, parseFloat(quantity), options);
        res.json({ success: true, stock });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Remove stock
app.delete('/api/stocks/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        await manager.removeStock(ticker);
        res.json({ success: true, message: `Stock ${ticker} removed` });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update stock quantity
app.put('/api/stocks/:ticker/quantity', async (req, res) => {
    try {
        const { ticker } = req.params;
        const { quantity } = req.body;

        if (!quantity) {
            return res.status(400).json({ error: 'Quantity is required' });
        }

        const stock = await manager.updateQuantity(ticker, parseFloat(quantity));
        res.json({ success: true, stock });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update stock purchase info (date, price)
app.patch('/api/stocks/:ticker', async (req, res) => {
    try {
        const { ticker } = req.params;
        const { purchaseDate, purchasePrice } = req.body;
        const updates = {};
        if (purchaseDate !== undefined) updates.purchaseDate = purchaseDate;
        if (purchasePrice !== undefined) updates.purchasePrice = parseFloat(purchasePrice);
        const stock = await manager.updateStockInfo(ticker, updates);
        res.json({ success: true, stock });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ─── Connection Routes ───────────────────────────────────────────────────────

// Get current connection settings — always reads from portfolio.json so the
// settings modal shows correct values even after a server restart.
app.get('/api/connection', async (req, res) => {
    try {
        await manager.loadPortfolio();
        res.json({
            serverURL: manager.actualConfig?.serverURL,
            hasPassword: !!manager.actualConfig?.password,
            budgetId: manager.actualConfig?.budgetId,
            hasWebPassword: !!currentWebPassword(),
            webPasswordFromEnv: !!ENV_PASSWORD  // If true, the UI setting is overridden
        });
    } catch (error) {
        res.json({ serverURL: '', hasPassword: false, budgetId: '', hasWebPassword: false, webPasswordFromEnv: false });
    }
});

// Update connection settings
app.post('/api/connection', async (req, res) => {
    try {
        const { serverURL, password, budgetId, webPassword } = req.body;

        if (serverURL) config.serverURL = serverURL;
        if (password) config.password = password;
        if (budgetId) config.budgetId = budgetId;
        // Allow explicit empty string to clear the web password
        if (webPassword !== undefined) config.webPassword = webPassword;

        await withLock(() => manager.updateConfig(config));
        res.json({ success: true, serverURL: config.serverURL, budgetId: config.budgetId });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get available budgets from the Actual Budget server
app.get('/api/budgets', async (req, res) => {
    try {
        debug('GET /api/budgets requested');
        const budgets = await withLock(async () => {
            await manager.loadPortfolio();
            debug('Fetching budgets using config:', { ...manager.actualConfig, password: '***' });
            return manager.getBudgets();
        });
        debug(`Returning ${budgets ? budgets.length : 0} budgets`);
        res.json({ success: true, budgets: budgets || [] });
    } catch (error) {
        console.error('Error fetching budgets:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get all Actual Budget accounts
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await withLock(async () => {
            await manager.loadPortfolio();
            return manager.getAccounts();
        });
        res.json({ success: true, accounts: accounts || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch fresh prices from Yahoo Finance and sync to Actual Budget
app.post('/api/update-prices', async (req, res) => {
    try {
        const updates = await withLock(() => manager.updateAllPrices());
        res.json({ success: true, updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset connection settings to env-var defaults
app.delete('/api/connection', async (req, res) => {
    try {
        await manager.resetConfig();
        // Clear the in-memory overlay so GET /api/connection reflects the reset
        delete config.serverURL;
        delete config.password;
        delete config.budgetId;
        delete config.webPassword;
        res.json({ success: true, message: 'Connection settings reset' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Process Resilience ──────────────────────────────────────────────────────

// Prevent crashes from unhandled promise rejections thrown by the @actual-app/api
// background sync worker. Individual request handlers still surface 500 errors.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection (suppressed to keep server alive):', reason?.message || reason);
});

// ─── Start ───────────────────────────────────────────────────────────────────

// Pre-load portfolio so webPassword is available for requireAuth before the
// first request arrives (avoids a small window where auth would not be enforced).
// A missing file is expected on first run — it is created automatically.
try {
    const existed = await import('node:fs/promises')
        .then(fs => fs.access(portfolioFile).then(() => true).catch(() => false));
    await manager.loadPortfolio();
    if (!existed) {
        console.log(`📁 Created new portfolio at ${portfolioFile}`);
    } else {
        console.log(`📁 Loaded portfolio (${manager.portfolio.stocks.length} stock(s))`);
    }
} catch (err) {
    console.warn(`⚠️  Could not load portfolio: ${err.message} — starting with empty portfolio`);
}

app.listen(PORT, () => {
    console.log(`\n🚀 Helvetfolio`);
    console.log(`📊 Server running at: http://localhost:${PORT}`);
    if (currentWebPassword()) {
        console.log(`🔒 Password authentication enabled${ENV_PASSWORD ? ' (env var)' : ' (portfolio settings)'}`);
    }
    console.log(`\n💡 Open your browser and navigate to the URL above\n`);
});
