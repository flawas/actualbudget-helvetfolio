import api from '@actual-app/api';
import { debug, debugWarn, debugError } from './logger.js';

/**
 * Client for interacting with Actual Budget
 */
class ActualClient {
    constructor(config) {
        this.config = config;
        this.initialized = false;
        this.budgetLoaded = false;
    }

    /**
     * Initialize connection to Actual Budget
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        debug(`Initializing Actual Budget connection to ${this.config.serverURL}...`);

        try {
            await api.init({
                dataDir: this.config.dataDir,
                serverURL: this.config.serverURL,
                password: this.config.password
            });

            debug('Actual API initialized successfully');
            this.initialized = true;
        } catch (error) {
            debugError('Failed to initialize Actual Budget API:', error.message);
            this.initialized = false;
            throw new Error(`Failed to initialize Actual Budget API: ${error.message}`);
        }
    }

    /**
     * Ensure a budget is loaded/downloaded
     */
    async ensureBudgetLoaded() {
        await this.initialize();

        if (this.budgetLoaded) {
            return;
        }

        if (!this.config.budgetId || this.config.budgetId === 'undefined' || this.config.budgetId === '') {
            throw new Error("No Budget ID configured. Please select a budget in settings.");
        }

        try {
            debug(`Searching for budget with ID: ${this.config.budgetId}`);
            const budgets = await api.getBudgets();
            const budget = budgets.find(b =>
                b.id === this.config.budgetId ||
                b.syncId === this.config.budgetId ||
                b.groupId === this.config.budgetId ||
                b.cloudFileId === this.config.budgetId
            );

            if (budget) {
                debug(`Found budget: ${budget.name} (id: ${budget.id}, cloudFileId: ${budget.cloudFileId})`);
                // downloadBudget matches budgets by groupId (the "Sync ID" shown in
                // Actual Budget's Advanced settings). cloudFileId is NOT accepted.
                const syncId = budget.groupId;
                if (syncId) {
                    debug(`Downloading/syncing budget via groupId ${syncId}...`);
                    await api.downloadBudget(syncId);
                } else if (budget.id) {
                    debug(`No sync ID available, loading local budget ${budget.id}...`);
                    await api.loadBudget(budget.id);
                } else {
                    throw new Error(`Cannot determine how to load budget "${budget.name}"`);
                }
            } else {
                // Not found in list — last resort: try the configured ID as a groupId
                debug(`Budget not found in list, trying direct download with ${this.config.budgetId}...`);
                await api.downloadBudget(this.config.budgetId); // works if budgetId is a groupId UUID
            }

            this.budgetLoaded = true;
            debug('Budget loaded successfully');
        } catch (error) {
            debugError('Failed to load budget:', error.message);
            this.budgetLoaded = false;
            throw new Error(`Failed to load budget: ${error.message}`);
        }
    }

    /**
     * Close connection to Actual Budget
     */
    async shutdown() {
        if (this.initialized) {
            // Always attempt api.shutdown() so the singleton is fully reset for the next
            // request. When no budget was loaded the API may throw "timestamp undefined" —
            // that error is caught and swallowed; it is harmless.
            debug(`Shutting down Actual API session (budgetLoaded=${this.budgetLoaded})...`);
            try {
                await api.shutdown();
            } catch (error) {
                debugWarn('Error during Actual API shutdown (expected if no budget was loaded):', error.message);
            }

            this.initialized = false;
            this.budgetLoaded = false;
        }
    }

    /**
     * Get all accounts
     * @returns {Promise<Array>} - Array of accounts
     */
    async getAccounts() {
        await this.ensureBudgetLoaded();
        return await api.getAccounts();
    }

    /**
     * Find account by name
     * @param {string} name - Account name
     * @returns {Promise<object|null>} - Account object or null
     */
    async findAccountByName(name) {
        const accounts = await this.getAccounts();
        return accounts.find(account => account.name === name) || null;
    }

    /**
     * Get list of available budgets
     * @returns {Promise<Array>} - Array of budget objects
     */
    async getBudgets() {
        await this.initialize();
        debug('Fetching budgets from server...');
        const budgets = await api.getBudgets();
        debug(`Found ${budgets ? budgets.length : 0} budgets`);
        if (budgets && budgets.length > 0) {
            debug('First budget object structure:', JSON.stringify(budgets[0], null, 2));
        }
        return budgets;
    }

    /**
     * Create an investment account for a stock
     * @param {string} ticker - Stock ticker
     * @param {string} name - Stock name
     * @param {number} quantity - Number of shares
     * @param {number} currentPrice - Current price per share
     * @returns {Promise<string>} - Account ID
     */
    async createStockAccount(ticker, name, quantity, currentPrice) {
        await this.ensureBudgetLoaded();

        const accountName = `${ticker} - ${name}`;
        const initialBalance = Math.round(quantity * currentPrice * 100); // Convert to cents

        try {
            // Create account with 0 balance first to avoid "timestamp undefined" error in API
            const accountId = await api.createAccount({
                name: accountName,
                type: 'investment',
                offbudget: true
            }, 0);

            // Store quantity in account notes (if API supports it)
            // For now, we'll track this in our portfolio.json file

            // Update balance if needed
            if (initialBalance !== 0) {
                await this.updateAccountBalance(accountId, initialBalance);
            }

            return accountId;
        } catch (error) {
            throw new Error(`Failed to create account for ${ticker}: ${error.message}`);
        }
    }

    /**
     * Update account balance
     * @param {string} accountId - Account ID
     * @param {number} newBalance - New balance in cents
     * @returns {Promise<void>}
     */
    async updateAccountBalance(accountId, newBalance) {
        await this.ensureBudgetLoaded();

        try {
            // Get current balance
            const transactions = await api.getTransactions(accountId, null, null);
            const currentBalance = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

            const difference = Math.round(newBalance) - currentBalance;

            if (difference !== 0) {
                // Create adjustment transaction
                await api.addTransactions(accountId, [{
                    date: new Date().toISOString().split('T')[0],
                    amount: difference,
                    payee_name: 'Market Value Adjustment',
                    notes: `Automatic portfolio value update`,
                    cleared: true
                }]);
            }
        } catch (error) {
            throw new Error(`Failed to update account balance: ${error.message}`);
        }
    }

    /**
     * Delete an account
     * @param {string} accountId - Account ID
     * @returns {Promise<void>}
     */
    async deleteAccount(accountId) {
        await this.ensureBudgetLoaded();
        await api.deleteAccount(accountId);
    }

    /**
     * Get account balance
     * @param {string} accountId - Account ID
     * @returns {Promise<number>} - Balance in cents
     */
    async getAccountBalance(accountId) {
        await this.ensureBudgetLoaded();

        const transactions = await api.getTransactions(accountId, null, null);
        return transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    }
}

export default ActualClient;
