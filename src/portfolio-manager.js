import fs from 'fs/promises';
import path from 'path';
import StockFetcher from './stock-fetcher.js';
import ActualClient from './actual-client.js';
import { debug } from './logger.js';

/**
 * Manages the stock portfolio and syncs with Actual Budget
 */
class PortfolioManager {
    constructor(portfolioFile, actualConfig) {
        this.portfolioFile = portfolioFile;
        this.stockFetcher = new StockFetcher(actualConfig.exchangeSuffix);
        this.actualConfig = actualConfig; // Store config for re-initialization
        this.actualClient = new ActualClient(actualConfig);
        this.portfolio = { stocks: [] };
    }

    /**
     * Load portfolio from file
     */
    async loadPortfolio() {
        try {
            const data = await fs.readFile(this.portfolioFile, 'utf-8');
            this.portfolio = JSON.parse(data);

            // Apply persisted settings if they exist
            if (this.portfolio.settings) {
                debug('Found settings in portfolio.json:', this.portfolio.settings);
                const newConfig = {
                    ...this.actualConfig, // Defaults from env
                    ...this.portfolio.settings // Overrides from file
                };

                // Check if config has effectively changed (simple check)
                if (JSON.stringify(newConfig) !== JSON.stringify(this.actualConfig)) {
                    debug('Config changed, re-initializing client with:', { ...newConfig, password: '***' });
                    this.actualConfig = newConfig;
                    this.actualClient = new ActualClient(this.actualConfig);
                } else {
                    debug('Config unchanged');
                }
            } else {
                debug('No settings in portfolio.json');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, start with empty portfolio
                this.portfolio = { stocks: [] };
                await this.savePortfolio();
            } else {
                throw new Error(`Failed to load portfolio: ${error.message}`);
            }
        }
    }

    /**
     * Save portfolio to file
     */
    async savePortfolio() {
        try {
            await fs.writeFile(
                this.portfolioFile,
                JSON.stringify(this.portfolio, null, 2),
                'utf-8'
            );
            // Restrict file permissions so the password stored inside is not world-readable.
            // Silently ignored on platforms that don't support chmod (e.g. Windows).
            await fs.chmod(this.portfolioFile, 0o600).catch(() => {});
        } catch (error) {
            throw new Error(`Failed to save portfolio: ${error.message}`);
        }
    }

    /**
     * Update Actual Budget configuration
     * @param {object} newConfig - New configuration
     */
    async updateConfig(newConfig) {
        // Load latest state first
        await this.loadPortfolio();

        // Update in-memory config
        this.actualConfig = {
            ...this.actualConfig,
            ...newConfig
        };

        // Persist specific settings to portoflio
        if (!this.portfolio.settings) {
            this.portfolio.settings = {};
        }

        // Only save what's relevant/changed. 
        // We save masked config to avoid saving secrets? No, we MUST save secrets (password) to JSON if we want strict persistence across restarts without env.
        // User requested "save all settings ... to a local db".
        if (newConfig.serverURL) this.portfolio.settings.serverURL = newConfig.serverURL;
        if (newConfig.password) this.portfolio.settings.password = newConfig.password;
        if (newConfig.budgetId) this.portfolio.settings.budgetId = newConfig.budgetId;
        // Allow empty string to explicitly clear the web password
        if (newConfig.webPassword !== undefined) this.portfolio.settings.webPassword = newConfig.webPassword;

        // Re-initialize client and stock fetcher with potentially updated config
        this.stockFetcher = new StockFetcher(this.actualConfig.exchangeSuffix);
        this.actualClient = new ActualClient(this.actualConfig);

        await this.savePortfolio();
    }

    /**
     * Reset configuration to defaults
     */
    async resetConfig() {
        await this.loadPortfolio();
        this.portfolio.settings = {};
        await this.savePortfolio();
        // Fallback happens automatically on next loadPortfolio check against actualConfig
    }

    /**
     * Get list of budgets
     * @returns {Promise<Array>} - List of budgets
     */
    async getBudgets() {
        return await this.actualClient.getBudgets();
    }

    /**
     * Get all accounts and their current balances
     * @returns {Promise<Array>} - List of accounts
     */
    async getAccounts() {
        return await this.actualClient.getAccounts();
    }

    /**
   * Add a stock to the portfolio
   * @param {string} ticker - Stock ticker
   * @param {number} quantity - Number of shares
   * @param {object} options - Optional purchase details
   * @param {string} options.purchaseDate - Purchase date (YYYY-MM-DD)
   * @param {number} options.purchasePrice - Purchase price per share
   * @returns {Promise<object>} - Stock entry
   */
    async addStock(ticker, quantity, options = {}) {
        await this.loadPortfolio();

        // Check if stock already exists
        const existingIndex = this.portfolio.stocks.findIndex(
            s => s.ticker.toUpperCase() === ticker.toUpperCase()
        );

        if (existingIndex >= 0) {
            throw new Error(`Stock ${ticker} already exists in portfolio. Use update to change quantity.`);
        }

        // Fetch current price
        const priceData = await this.stockFetcher.fetchPrice(ticker);

        // Use purchase price if provided, otherwise use current price
        const initialPrice = options.purchasePrice || priceData.price;
        const purchaseDate = options.purchaseDate || new Date().toISOString().split('T')[0];

        // Create account in Actual Budget
        const accountId = await this.actualClient.createStockAccount(
            priceData.ticker,
            priceData.name,
            quantity,
            priceData.price  // Use current price for initial balance
        );

        // Add to portfolio
        const stockEntry = {
            ticker: priceData.ticker,
            name: priceData.name,
            quantity: quantity,
            accountId: accountId,
            currency: priceData.currency,
            lastUpdated: new Date().toISOString(),
            lastPrice: priceData.price,
            // Purchase tracking
            purchaseDate: purchaseDate,
            purchasePrice: initialPrice,
            costBasis: quantity * initialPrice
        };

        this.portfolio.stocks.push(stockEntry);
        await this.savePortfolio();

        return stockEntry;
    }

    /**
     * Remove a stock from the portfolio
     * @param {string} ticker - Stock ticker
     * @returns {Promise<void>}
     */
    async removeStock(ticker) {
        await this.loadPortfolio();

        const formattedTicker = this.stockFetcher.formatSwissTicker(ticker);
        const stockIndex = this.portfolio.stocks.findIndex(
            s => s.ticker === formattedTicker
        );

        if (stockIndex === -1) {
            throw new Error(`Stock ${ticker} not found in portfolio`);
        }

        const stock = this.portfolio.stocks[stockIndex];

        // Delete account from Actual Budget
        await this.actualClient.deleteAccount(stock.accountId);

        // Remove from portfolio
        this.portfolio.stocks.splice(stockIndex, 1);
        await this.savePortfolio();
    }

    /**
     * Update all stock prices and account balances
     * @returns {Promise<Array>} - Array of updated stocks
     */
    async updateAllPrices() {
        await this.loadPortfolio();

        if (this.portfolio.stocks.length === 0) {
            return [];
        }

        const tickers = this.portfolio.stocks.map(s => s.ticker);
        const prices = await this.stockFetcher.fetchMultiplePrices(tickers);

        const updates = [];

        for (let i = 0; i < this.portfolio.stocks.length; i++) {
            const stock = this.portfolio.stocks[i];
            const priceData = prices.find(p => p.ticker === stock.ticker);

            if (priceData && priceData.price) {
                const newBalance = Math.round(stock.quantity * priceData.price * 100);
                // Mark the Yahoo Finance fetch time regardless of whether Actual succeeds
                stock.lastPriceFetch = new Date().toISOString();

                try {
                    await this.actualClient.updateAccountBalance(stock.accountId, newBalance);

                    stock.lastPrice = priceData.price;
                    stock.lastUpdated = new Date().toISOString(); // Actual Budget sync time

                    updates.push({
                        ticker: stock.ticker,
                        name: stock.name,
                        quantity: stock.quantity,
                        price: priceData.price,
                        value: stock.quantity * priceData.price,
                        currency: stock.currency,
                        success: true
                    });
                } catch (error) {
                    updates.push({
                        ticker: stock.ticker,
                        error: error.message,
                        success: false
                    });
                }
            } else {
                updates.push({
                    ticker: stock.ticker,
                    error: priceData?.error || 'Unknown error',
                    success: false
                });
            }
        }

        await this.savePortfolio();
        return updates;
    }

    /**
   * Get portfolio summary
   * @returns {Promise<object>} - Portfolio summary
   */
    async getPortfolioSummary() {
        await this.loadPortfolio();

        const summary = {
            totalStocks: this.portfolio.stocks.length,
            stocks: this.portfolio.stocks.map(stock => ({
                ticker: stock.ticker,
                name: stock.name,
                quantity: stock.quantity,
                lastPrice: stock.lastPrice,
                value: stock.quantity * stock.lastPrice,
                currency: stock.currency,
                lastUpdated: stock.lastUpdated,
                purchaseDate: stock.purchaseDate,
                purchasePrice: stock.purchasePrice,
                costBasis: stock.costBasis
            })),
            totalValue: this.portfolio.stocks.reduce(
                (sum, stock) => sum + (stock.quantity * stock.lastPrice),
                0
            )
        };

        return summary;
    }

    /**
     * Get portfolio with performance metrics (gains/losses)
     * @returns {Promise<object>} - Portfolio with performance data
     */
    async getPortfolioWithPerformance() {
        await this.loadPortfolio();

        const stocks = this.portfolio.stocks.map(stock => {
            const currentValue = stock.quantity * stock.lastPrice;
            const costBasis = stock.costBasis || (stock.quantity * (stock.purchasePrice || stock.lastPrice));
            const gain = currentValue - costBasis;
            const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

            return {
                ticker: stock.ticker,
                name: stock.name,
                quantity: stock.quantity,
                purchaseDate: stock.purchaseDate,
                purchasePrice: stock.purchasePrice || stock.lastPrice,
                costBasis: costBasis,
                currentPrice: stock.lastPrice,
                currentValue: currentValue,
                gain: gain,
                gainPercent: gainPercent,
                currency: stock.currency,
                lastUpdated: stock.lastUpdated
            };
        });

        const totalCostBasis = stocks.reduce((sum, s) => sum + s.costBasis, 0);
        const totalValue = stocks.reduce((sum, s) => sum + s.currentValue, 0);
        const totalGain = totalValue - totalCostBasis;
        const totalGainPercent = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;

        // Helper: find the most recent timestamp across all raw stocks for a given field
        const latestTimestamp = (field) => this.portfolio.stocks.reduce((latest, s) => {
            if (!s[field]) return latest;
            return !latest || new Date(s[field]) > new Date(latest) ? s[field] : latest;
        }, null);

        return {
            totalStocks: stocks.length,
            stocks: stocks,
            totalCostBasis: totalCostBasis,
            totalValue: totalValue,
            totalGain: totalGain,
            totalGainPercent: totalGainPercent,
            lastYahooSync:  latestTimestamp('lastPriceFetch'), // Last successful Yahoo Finance fetch
            lastActualSync: latestTimestamp('lastUpdated')     // Last successful Actual Budget write
        };
    }
    /**
     * Update quantity for an existing stock
     * @param {string} ticker - Stock ticker
     * @param {number} newQuantity - New quantity
     * @returns {Promise<object>} - Updated stock entry
     */
    async updateQuantity(ticker, newQuantity) {
        await this.loadPortfolio();

        const formattedTicker = this.stockFetcher.formatSwissTicker(ticker);
        const stock = this.portfolio.stocks.find(s => s.ticker === formattedTicker);

        if (!stock) {
            throw new Error(`Stock ${ticker} not found in portfolio`);
        }

        stock.quantity = newQuantity;

        // Update balance in Actual Budget
        const newBalance = Math.round(stock.quantity * stock.lastPrice * 100);
        await this.actualClient.updateAccountBalance(stock.accountId, newBalance);

        stock.lastUpdated = new Date().toISOString();
        await this.savePortfolio();

        return stock;
    }

    /**
     * Update purchase info for an existing stock
     * @param {string} ticker - Stock ticker
     * @param {object} updates - Fields to update (purchaseDate, purchasePrice)
     * @returns {Promise<object>} - Updated stock entry
     */
    async updateStockInfo(ticker, updates) {
        await this.loadPortfolio();

        const formattedTicker = this.stockFetcher.formatSwissTicker(ticker);
        const stock = this.portfolio.stocks.find(s => s.ticker === formattedTicker);

        if (!stock) {
            throw new Error(`Stock ${ticker} not found in portfolio`);
        }

        if (updates.purchaseDate !== undefined) stock.purchaseDate = updates.purchaseDate;
        if (updates.purchasePrice !== undefined) {
            stock.purchasePrice = updates.purchasePrice;
            stock.costBasis = stock.quantity * updates.purchasePrice;
        }

        await this.savePortfolio();
        return stock;
    }

    /**
     * Close connections
     */
    async shutdown() {
        await this.actualClient.shutdown();
    }
}

export default PortfolioManager;
