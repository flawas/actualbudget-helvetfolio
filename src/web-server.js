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

// Configuration
let config = {
    dataDir: process.env.ACTUAL_DATA_DIR || './data',
    exchangeSuffix: process.env.STOCK_EXCHANGE_SUFFIX || '.SW'
};

const portfolioFile = process.env.PORTFOLIO_FILE || './portfolio.json';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

// Get portfolio summary
app.get('/api/portfolio', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        const summary = await manager.getPortfolioSummary();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Get portfolio performance
app.get('/api/performance', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        const performance = await manager.getPortfolioWithPerformance();
        res.json(performance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Add stock
app.post('/api/stocks', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
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
    } finally {
        await manager.shutdown();
    }
});

// Remove stock
app.delete('/api/stocks/:ticker', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        const { ticker } = req.params;
        await manager.removeStock(ticker);
        res.json({ success: true, message: `Stock ${ticker} removed` });
    } catch (error) {
        res.status(400).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Update stock quantity
app.put('/api/stocks/:ticker/quantity', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
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
    } finally {
        await manager.shutdown();
    }
});

// Connection Routes

// Get current connection settings (masked)
app.get('/api/connection', (req, res) => {
    res.json({
        serverURL: config.serverURL,
        hasPassword: !!config.password,
        budgetId: config.budgetId
    });
});

// Update connection settings
app.post('/api/connection', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        const { serverURL, password, budgetId } = req.body;

        if (serverURL) config.serverURL = serverURL;
        if (password) config.password = password;
        if (budgetId) config.budgetId = budgetId;

        await manager.updateConfig(config);

        // Return 200 with new config state
        res.json({ success: true, serverURL: config.serverURL, budgetId: config.budgetId });
    } catch (error) {
        res.status(400).json({ error: error.message });
    } finally {
        // Shutdown not needed here as manager is transient for this request? 
        // Actually updateConfig re-initializes client. We should keep it clean.
        // But wait, manager.updateConfig() calls shutdown().
        // We don't need to explicitly shutdown here unless updateConfig failed.
        // Let's ensure proper cleanup.
        await manager.shutdown();
    }
});

// Get available budgets
app.get('/api/budgets', async (req, res) => {
    // Need a manager with current config to fetch budgets
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        debug('GET /api/budgets requested');
        // Ensure settings are loaded first
        await manager.loadPortfolio();

        debug('Fetching budgets using config:', { ...manager.actualConfig, password: '***' });
        const budgets = await manager.getBudgets();

        debug(`Returning ${budgets ? budgets.length : 0} budgets`);
        res.json({ success: true, budgets: budgets || [] });
    } catch (error) {
        console.error('Error fetching budgets:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Get all accounts
app.get('/api/accounts', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        await manager.loadPortfolio();
        const accounts = await manager.getAccounts();
        res.json({ success: true, accounts: accounts || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Update all prices
app.post('/api/update-prices', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        const updates = await manager.updateAllPrices();
        res.json({ success: true, updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Reset connection settings
app.delete('/api/connection', async (req, res) => {
    const manager = new PortfolioManager(portfolioFile, config);
    try {
        await manager.resetConfig();
        res.json({ success: true, message: 'Connection settings reset' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await manager.shutdown();
    }
});

// Prevent crashes from unhandled promise rejections thrown by the @actual-app/api
// background sync worker (e.g. when a previously cached budget can no longer be
// downloaded from the server). Individual request handlers still return 500 errors.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection (suppressed to keep server alive):', reason?.message || reason);
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Helvetfolio`);
    console.log(`📊 Server running at: http://localhost:${PORT}`);
    console.log(`\n💡 Open your browser and navigate to the URL above\n`);
});
