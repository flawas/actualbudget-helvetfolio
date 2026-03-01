import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';

import ActualClient from '../src/actual-client.js';

// Module-level mock api object. setupMocks() rebuilds it before each test so
// every test starts with fresh mock.fn instances. makeClient() always passes
// this object to ActualClient, avoiding any need to mutate the real api module
// (whose exports are now non-configurable getters).
let apiMock = {};

function makeClient(overrides = {}) {
    return new ActualClient({
        serverURL: 'http://test:5006',
        password: 'testpass', // NOSONAR
        budgetId: 'budget-group-1',
        dataDir: '/tmp/actual-test',
        exchangeSuffix: '.SW',
        ...overrides
    }, apiMock);
}

/**
 * Replace apiMock with fresh mock.fn() instances so each test starts clean.
 * Returns an object mapping method names → mock.fn instances.
 */
function setupMocks(overrides = {}) {
    const defaults = {
        init: async () => {},
        shutdown: async () => {},
        getBudgets: async () => [],
        downloadBudget: async () => {},
        loadBudget: async () => {},
        getAccounts: async () => [],
        createAccount: async () => 'acc-123',
        getTransactions: async () => [],
        addTransactions: async () => {},
        deleteAccount: async () => {},
    };
    apiMock = {};
    for (const [k, impl] of Object.entries({ ...defaults, ...overrides })) {
        apiMock[k] = mock.fn(impl);
    }
    return apiMock;
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------
describe('initialize', () => {
    test('calls api.init and sets initialized=true on success', async () => {
        const m = setupMocks();
        const client = makeClient();
        await client.initialize();

        assert.ok(client.initialized);
        assert.equal(m.init.mock.calls.length, 1);
        assert.equal(m.init.mock.calls[0].arguments[0].serverURL, 'http://test:5006');
    });

    test('is idempotent — does not call api.init a second time', async () => {
        const m = setupMocks();
        const client = makeClient();
        await client.initialize();
        await client.initialize();

        assert.equal(m.init.mock.calls.length, 1);
    });

    test('throws when serverURL is not configured', async () => {
        setupMocks();
        const client = makeClient({ serverURL: '' });
        await assert.rejects(() => client.initialize(), /not configured/);
    });

    test('throws wrapped error and resets initialized when api.init fails', async () => {
        setupMocks({ init: async () => { throw new Error('Connection refused'); } });
        const client = makeClient();

        await assert.rejects(() => client.initialize(), /Failed to initialize Actual Budget API/);
        assert.equal(client.initialized, false);
    });
});

// ---------------------------------------------------------------------------
// shutdown
// ---------------------------------------------------------------------------
describe('shutdown', () => {
    test('calls api.shutdown and resets flags when initialized', async () => {
        const m = setupMocks();
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await client.shutdown();

        assert.equal(m.shutdown.mock.calls.length, 1);
        assert.equal(client.initialized, false);
        assert.equal(client.budgetLoaded, false);
    });

    test('skips api.shutdown when not yet initialized', async () => {
        const m = setupMocks();
        const client = makeClient();
        await client.shutdown();

        assert.equal(m.shutdown.mock.calls.length, 0);
    });

    test('swallows errors thrown by api.shutdown', async () => {
        setupMocks({ shutdown: async () => { throw new Error('Shutdown error'); } });
        const client = makeClient();
        client.initialized = true;

        await client.shutdown(); // must not throw
        assert.equal(client.initialized, false);
    });
});

// ---------------------------------------------------------------------------
// getBudgets
// ---------------------------------------------------------------------------
describe('getBudgets', () => {
    test('returns budget list from api after initializing', async () => {
        setupMocks({
            getBudgets: async () => [{ id: 'b1', name: 'Budget 1', groupId: 'g1' }]
        });
        const client = makeClient();
        const budgets = await client.getBudgets();

        assert.equal(budgets.length, 1);
        assert.equal(budgets[0].id, 'b1');
    });
});

// ---------------------------------------------------------------------------
// ensureBudgetLoaded
// ---------------------------------------------------------------------------
describe('ensureBudgetLoaded', () => {
    test('returns early when budget is already loaded', async () => {
        const m = setupMocks();
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await client.ensureBudgetLoaded();

        assert.equal(m.downloadBudget.mock.calls.length, 0);
        assert.equal(m.loadBudget.mock.calls.length, 0);
    });

    test('throws when budgetId is empty string', async () => {
        setupMocks();
        const client = makeClient({ budgetId: '' });
        client.initialized = true;

        await assert.rejects(() => client.ensureBudgetLoaded(), /No Budget ID configured/);
    });

    test('uses downloadBudget with groupId when budget is found with groupId', async () => {
        const m = setupMocks({
            getBudgets: async () => [
                { id: 'local-1', name: 'My Budget', groupId: 'group-uuid', cloudFileId: null }
            ]
        });
        const client = makeClient({ budgetId: 'group-uuid' });
        client.initialized = true;

        await client.ensureBudgetLoaded();

        assert.equal(m.downloadBudget.mock.calls.length, 1);
        assert.equal(m.downloadBudget.mock.calls[0].arguments[0], 'group-uuid');
        assert.ok(client.budgetLoaded);
    });

    test('falls back to loadBudget when budget has no groupId', async () => {
        const m = setupMocks({
            getBudgets: async () => [
                { id: 'local-1', name: 'My Budget', groupId: null, cloudFileId: null }
            ]
        });
        const client = makeClient({ budgetId: 'local-1' });
        client.initialized = true;

        await client.ensureBudgetLoaded();

        assert.equal(m.loadBudget.mock.calls.length, 1);
        assert.equal(m.loadBudget.mock.calls[0].arguments[0], 'local-1');
        assert.ok(client.budgetLoaded);
    });

    test('falls back to direct downloadBudget when budget is not in list', async () => {
        const m = setupMocks({ getBudgets: async () => [] });
        const client = makeClient({ budgetId: 'direct-uuid' });
        client.initialized = true;

        await client.ensureBudgetLoaded();

        assert.equal(m.downloadBudget.mock.calls.length, 1);
        assert.equal(m.downloadBudget.mock.calls[0].arguments[0], 'direct-uuid');
    });

    test('throws wrapped error and resets budgetLoaded when download fails', async () => {
        setupMocks({
            getBudgets: async () => [],
            downloadBudget: async () => { throw new Error('Budget not found'); }
        });
        const client = makeClient();
        client.initialized = true;

        await assert.rejects(() => client.ensureBudgetLoaded(), /Failed to load budget/);
        assert.equal(client.budgetLoaded, false);
    });
});

// ---------------------------------------------------------------------------
// getAccounts
// ---------------------------------------------------------------------------
describe('getAccounts', () => {
    test('returns accounts from api after ensuring budget is loaded', async () => {
        setupMocks({ getAccounts: async () => [{ id: 'acc-1', name: 'Test Account' }] });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        const accounts = await client.getAccounts();

        assert.equal(accounts.length, 1);
        assert.equal(accounts[0].id, 'acc-1');
    });
});

// ---------------------------------------------------------------------------
// findAccountByName
// ---------------------------------------------------------------------------
describe('findAccountByName', () => {
    test('returns the matching account', async () => {
        setupMocks({
            getAccounts: async () => [
                { id: 'acc-1', name: 'NESN.SW - Nestle' },
                { id: 'acc-2', name: 'NOVN.SW - Novartis' }
            ]
        });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        const account = await client.findAccountByName('NOVN.SW - Novartis');
        assert.equal(account.id, 'acc-2');
    });

    test('returns null when name is not found', async () => {
        setupMocks({ getAccounts: async () => [{ id: 'acc-1', name: 'Something else' }] });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        const account = await client.findAccountByName('NESN.SW - Nestle');
        assert.equal(account, null);
    });
});

// ---------------------------------------------------------------------------
// createStockAccount
// ---------------------------------------------------------------------------
describe('createStockAccount', () => {
    test('creates account with correct name and returns its ID', async () => {
        const m = setupMocks({ createAccount: async () => 'new-acc-id' });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        const accountId = await client.createStockAccount('NESN.SW', 'Nestle', 10, 100);

        assert.equal(accountId, 'new-acc-id');
        assert.equal(m.createAccount.mock.calls.length, 1);
        assert.equal(m.createAccount.mock.calls[0].arguments[0].name, 'NESN.SW - Nestle');
        assert.equal(m.createAccount.mock.calls[0].arguments[0].type, 'investment');
    });

    test('skips balance update when initial balance is zero', async () => {
        const m = setupMocks({ createAccount: async () => 'acc-zero' });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await client.createStockAccount('NESN.SW', 'Nestle', 0, 0);

        assert.equal(m.addTransactions.mock.calls.length, 0);
    });

    test('throws wrapped error when createAccount fails', async () => {
        setupMocks({ createAccount: async () => { throw new Error('API error'); } });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await assert.rejects(
            () => client.createStockAccount('NESN.SW', 'Nestle', 10, 100),
            /Failed to create account/
        );
    });
});

// ---------------------------------------------------------------------------
// updateAccountBalance
// ---------------------------------------------------------------------------
describe('updateAccountBalance', () => {
    test('creates an adjustment transaction when balance differs', async () => {
        const m = setupMocks({
            getTransactions: async () => [{ amount: 30000 }, { amount: 20000 }]
        });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await client.updateAccountBalance('acc-1', 60000); // current=50000, diff=+10000

        assert.equal(m.addTransactions.mock.calls.length, 1);
        const txn = m.addTransactions.mock.calls[0].arguments[1][0];
        assert.equal(txn.amount, 10000);
        assert.equal(txn.cleared, true);
    });

    test('skips transaction when balance is already correct', async () => {
        const m = setupMocks({ getTransactions: async () => [{ amount: 50000 }] });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await client.updateAccountBalance('acc-1', 50000);

        assert.equal(m.addTransactions.mock.calls.length, 0);
    });

    test('throws wrapped error when api call fails', async () => {
        setupMocks({ getTransactions: async () => { throw new Error('DB error'); } });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await assert.rejects(
            () => client.updateAccountBalance('acc-1', 10000),
            /Failed to update account balance/
        );
    });
});

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------
describe('deleteAccount', () => {
    test('calls api.deleteAccount with the account ID', async () => {
        const m = setupMocks();
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        await client.deleteAccount('acc-1');

        assert.equal(m.deleteAccount.mock.calls.length, 1);
        assert.equal(m.deleteAccount.mock.calls[0].arguments[0], 'acc-1');
    });
});

// ---------------------------------------------------------------------------
// getAccountBalance
// ---------------------------------------------------------------------------
describe('getAccountBalance', () => {
    test('returns the sum of all transaction amounts', async () => {
        setupMocks({
            getTransactions: async () => [{ amount: 10000 }, { amount: 5000 }, { amount: -2000 }]
        });
        const client = makeClient();
        client.initialized = true;
        client.budgetLoaded = true;

        const balance = await client.getAccountBalance('acc-1');

        assert.equal(balance, 13000);
    });
});
