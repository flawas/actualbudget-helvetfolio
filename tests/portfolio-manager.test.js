import { describe, test, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import PortfolioManager from '../src/portfolio-manager.js';

function makeStock(overrides = {}) {
  return {
    ticker: 'NESN.SW',
    name: 'Nestle',
    quantity: 10,
    lastPrice: 100,
    purchasePrice: 100,
    costBasis: 1000,
    currency: 'CHF',
    lastUpdated: new Date().toISOString(),
    accountId: 'acc-1',
    ...overrides
  };
}

function createManager(stocks = []) {
  const manager = new PortfolioManager('./portfolio.json', { exchangeSuffix: '.SW' });
  // Bypass file I/O — tests work on in-memory state only
  mock.method(manager, 'loadPortfolio', async () => {});
  mock.method(manager, 'savePortfolio', async () => {});
  // Prevent any Actual Budget API calls
  mock.method(manager.actualClient, 'updateAccountBalance', async () => {});
  mock.method(manager.actualClient, 'deleteAccount', async () => {});
  manager.portfolio = { stocks };
  return manager;
}

// ---------------------------------------------------------------------------
// getPortfolioWithPerformance
// ---------------------------------------------------------------------------
describe('getPortfolioWithPerformance', () => {
  test('calculates gain correctly', async () => {
    const manager = createManager([makeStock({ quantity: 10, lastPrice: 110, purchasePrice: 100, costBasis: 1000 })]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.totalStocks, 1);
    assert.equal(perf.stocks[0].currentValue, 1100);
    assert.equal(perf.stocks[0].gain, 100);
    assert.equal(perf.stocks[0].gainPercent, 10);
  });

  test('calculates loss correctly', async () => {
    const manager = createManager([makeStock({ quantity: 5, lastPrice: 80, purchasePrice: 100, costBasis: 500 })]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.stocks[0].currentValue, 400);
    assert.equal(perf.stocks[0].gain, -100);
    assert.equal(perf.stocks[0].gainPercent, -20); // exact, not just < 0
  });

  test('handles zero cost basis without divide-by-zero', async () => {
    const manager = createManager([makeStock({ quantity: 10, lastPrice: 110, purchasePrice: 0, costBasis: 0 })]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.stocks[0].gainPercent, 0);
  });

  test('falls back to quantity * purchasePrice when costBasis field is absent', async () => {
    // Simulate a stock imported without a costBasis field (e.g. migrated data)
    const stock = makeStock({ quantity: 5, lastPrice: 120, purchasePrice: 80 });
    delete stock.costBasis;
    const manager = createManager([stock]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.stocks[0].costBasis, 400); // 5 * 80
    assert.equal(perf.stocks[0].gain, 200);       // 600 - 400
  });

  test('aggregates totals across multiple stocks', async () => {
    const manager = createManager([
      makeStock({ ticker: 'NESN.SW', quantity: 10, lastPrice: 100, costBasis: 1000 }),
      makeStock({ ticker: 'NOVN.SW', name: 'Novartis', quantity: 5, lastPrice: 80, costBasis: 400, accountId: 'acc-2' })
    ]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.totalStocks, 2);
    assert.equal(perf.totalValue, 1400);     // 10*100 + 5*80
    assert.equal(perf.totalCostBasis, 1400); // 1000 + 400
    assert.equal(perf.totalGain, 0);
  });

  test('reports lastYahooSync from the most recent lastPriceFetch timestamp', async () => {
    const manager = createManager([
      makeStock({ ticker: 'NESN.SW', lastPriceFetch: '2024-01-02T10:00:00Z', accountId: 'acc-1' }),
      makeStock({ ticker: 'NOVN.SW', lastPriceFetch: '2024-01-03T10:00:00Z', accountId: 'acc-2' })
    ]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.lastYahooSync, '2024-01-03T10:00:00Z');
  });

  test('returns null lastYahooSync when no stock has been fetched yet', async () => {
    // makeStock() does not include a lastPriceFetch field
    const manager = createManager([makeStock()]);
    const perf = await manager.getPortfolioWithPerformance();

    assert.equal(perf.lastYahooSync, null);
  });
});

// ---------------------------------------------------------------------------
// getPortfolioSummary
// ---------------------------------------------------------------------------
describe('getPortfolioSummary', () => {
  test('calculates total value correctly', async () => {
    const manager = createManager([
      makeStock({ quantity: 10, lastPrice: 100 }),
      makeStock({ ticker: 'NOVN.SW', quantity: 4, lastPrice: 50, accountId: 'acc-2' })
    ]);
    const summary = await manager.getPortfolioSummary();

    assert.equal(summary.totalStocks, 2);
    assert.equal(summary.totalValue, 1200); // 10*100 + 4*50
  });

  test('maps stock fields correctly', async () => {
    const manager = createManager([makeStock({ quantity: 3, lastPrice: 200 })]);
    const summary = await manager.getPortfolioSummary();

    const s = summary.stocks[0];
    assert.equal(s.ticker, 'NESN.SW');
    assert.equal(s.quantity, 3);
    assert.equal(s.lastPrice, 200);
    assert.equal(s.value, 600);
    assert.equal(s.currency, 'CHF');
  });
});

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------
describe('updateQuantity', () => {
  test('throws when ticker not found', async () => {
    const manager = createManager([makeStock({ ticker: 'NESN.SW' })]);
    await assert.rejects(
      () => manager.updateQuantity('XXXX', 5),
      /not found/
    );
  });

  test('updates quantity and calls Actual Budget with the correct new balance', async () => {
    const manager = createManager([makeStock({ ticker: 'NESN.SW', quantity: 10, lastPrice: 100, accountId: 'acc-1' })]);
    const updated = await manager.updateQuantity('NESN.SW', 20);

    assert.equal(updated.quantity, 20);

    // updateAccountBalance should be called once with (accountId, newBalanceInCents)
    const calls = manager.actualClient.updateAccountBalance.mock.calls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arguments[0], 'acc-1');
    assert.equal(calls[0].arguments[1], 200_000); // 20 shares * $100 * 100 cents
  });
});

// ---------------------------------------------------------------------------
// updateStockInfo
// ---------------------------------------------------------------------------
describe('updateStockInfo', () => {
  test('updates purchaseDate and purchasePrice, recalculates costBasis', async () => {
    const manager = createManager([makeStock({ quantity: 10, purchasePrice: 100, costBasis: 1000 })]);
    const updated = await manager.updateStockInfo('NESN.SW', { purchaseDate: '2023-01-01', purchasePrice: 90 });

    assert.equal(updated.purchaseDate, '2023-01-01');
    assert.equal(updated.purchasePrice, 90);
    assert.equal(updated.costBasis, 900); // 10 * 90
  });

  test('updates only purchaseDate when purchasePrice is omitted', async () => {
    const manager = createManager([makeStock({ purchasePrice: 100, costBasis: 1000 })]);
    const updated = await manager.updateStockInfo('NESN.SW', { purchaseDate: '2022-06-15' });

    assert.equal(updated.purchaseDate, '2022-06-15');
    assert.equal(updated.costBasis, 1000); // unchanged
  });

  test('throws when ticker not found', async () => {
    const manager = createManager([makeStock({ ticker: 'NESN.SW' })]);
    await assert.rejects(
      () => manager.updateStockInfo('XXXX', { purchaseDate: '2023-01-01' }),
      /not found/
    );
  });
});

// ---------------------------------------------------------------------------
// loadPortfolio (real file I/O)
// ---------------------------------------------------------------------------
describe('loadPortfolio', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-load-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('creates empty portfolio and saves when file does not exist', async () => {
    const portfolioFile = join(tmpDir, 'new.json');
    const manager = new PortfolioManager(portfolioFile, { exchangeSuffix: '.SW' });
    await manager.loadPortfolio();

    assert.deepEqual(manager.portfolio.stocks, []);
    const saved = JSON.parse(await readFile(portfolioFile, 'utf-8'));
    assert.deepEqual(saved, { stocks: [] });
  });

  test('reads existing portfolio from file', async () => {
    const portfolioFile = join(tmpDir, 'existing.json');
    await writeFile(portfolioFile, JSON.stringify({ stocks: [{ ticker: 'NESN.SW', quantity: 5 }] }), 'utf-8');

    const manager = new PortfolioManager(portfolioFile, { exchangeSuffix: '.SW' });
    await manager.loadPortfolio();

    assert.equal(manager.portfolio.stocks.length, 1);
    assert.equal(manager.portfolio.stocks[0].ticker, 'NESN.SW');
  });

  test('applies settings from file and re-initializes client when config changes', async () => {
    const portfolioFile = join(tmpDir, 'with-settings.json');
    const data = { stocks: [], settings: { serverURL: 'http://new-server:5006', password: 'newpass' } }; // NOSONAR
    await writeFile(portfolioFile, JSON.stringify(data), 'utf-8');

    const manager = new PortfolioManager(portfolioFile, { exchangeSuffix: '.SW' });
    const originalClient = manager.actualClient;
    await manager.loadPortfolio();

    assert.notEqual(manager.actualClient, originalClient);
    assert.equal(manager.actualConfig.serverURL, 'http://new-server:5006');
  });

  test('does not re-initialize client when config is unchanged', async () => {
    const portfolioFile = join(tmpDir, 'same-settings.json');
    const config = { serverURL: 'http://same:5006', password: 'samepass', exchangeSuffix: '.SW' }; // NOSONAR
    const data = { stocks: [], settings: { serverURL: config.serverURL, password: config.password } }; // NOSONAR
    await writeFile(portfolioFile, JSON.stringify(data), 'utf-8');

    const manager = new PortfolioManager(portfolioFile, config);
    const originalClient = manager.actualClient;
    await manager.loadPortfolio();

    assert.equal(manager.actualClient, originalClient);
  });

  test('throws wrapped error for invalid JSON content', async () => {
    const portfolioFile = join(tmpDir, 'invalid.json');
    await writeFile(portfolioFile, 'not valid json', 'utf-8');

    const manager = new PortfolioManager(portfolioFile, { exchangeSuffix: '.SW' });
    await assert.rejects(() => manager.loadPortfolio(), /Failed to load portfolio/);
  });
});

// ---------------------------------------------------------------------------
// savePortfolio (real file I/O)
// ---------------------------------------------------------------------------
describe('savePortfolio', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pm-save-'));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('writes portfolio as formatted JSON', async () => {
    const portfolioFile = join(tmpDir, 'portfolio.json');
    const manager = new PortfolioManager(portfolioFile, { exchangeSuffix: '.SW' });
    manager.portfolio = { stocks: [{ ticker: 'NESN.SW', quantity: 3 }] };

    await manager.savePortfolio();

    const saved = JSON.parse(await readFile(portfolioFile, 'utf-8'));
    assert.equal(saved.stocks[0].ticker, 'NESN.SW');
    assert.equal(saved.stocks[0].quantity, 3);
  });

  test('throws wrapped error when write destination is invalid', async () => {
    const manager = new PortfolioManager(join(tmpDir, 'nonexistent-subdir', 'portfolio.json'), { exchangeSuffix: '.SW' });
    await assert.rejects(() => manager.savePortfolio(), /Failed to save portfolio/);
  });
});

// ---------------------------------------------------------------------------
// addStock
// ---------------------------------------------------------------------------
describe('addStock', () => {
  function createManagerWithStockFetch(stocks = []) {
    const manager = createManager(stocks);
    mock.method(manager.stockFetcher, 'fetchPrice', async () => ({
      ticker: 'NESN.SW', name: 'Nestle', price: 105, currency: 'CHF', timestamp: new Date()
    }));
    mock.method(manager.actualClient, 'createStockAccount', async () => 'new-acc-id');
    return manager;
  }

  test('adds stock using current price as purchase price when none provided', async () => {
    const manager = createManagerWithStockFetch();
    const stock = await manager.addStock('NESN', 10);

    assert.equal(stock.ticker, 'NESN.SW');
    assert.equal(stock.quantity, 10);
    assert.equal(stock.purchasePrice, 105);
    assert.equal(stock.costBasis, 1050);
    assert.equal(stock.accountId, 'new-acc-id');
    assert.equal(manager.portfolio.stocks.length, 1);
  });

  test('uses provided purchasePrice instead of current price', async () => {
    const manager = createManagerWithStockFetch();
    const stock = await manager.addStock('NESN', 10, { purchasePrice: 90 });

    assert.equal(stock.purchasePrice, 90);
    assert.equal(stock.costBasis, 900);
  });

  test('throws when ticker already exists in portfolio', async () => {
    const manager = createManagerWithStockFetch([makeStock({ ticker: 'NESN.SW' })]);
    await assert.rejects(
      () => manager.addStock('NESN.SW', 5),
      /already exists/
    );
  });
});

// ---------------------------------------------------------------------------
// removeStock
// ---------------------------------------------------------------------------
describe('removeStock', () => {
  test('removes stock and calls deleteAccount', async () => {
    const manager = createManager([makeStock({ ticker: 'NESN.SW', accountId: 'acc-1' })]);
    await manager.removeStock('NESN');

    const calls = manager.actualClient.deleteAccount.mock.calls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arguments[0], 'acc-1');
    assert.equal(manager.portfolio.stocks.length, 0);
  });

  test('throws when ticker not found', async () => {
    const manager = createManager([]);
    await assert.rejects(() => manager.removeStock('XXXX'), /not found/);
  });
});

// ---------------------------------------------------------------------------
// updateAllPrices
// ---------------------------------------------------------------------------
describe('updateAllPrices', () => {
  test('returns empty array for empty portfolio', async () => {
    const manager = createManager([]);
    const results = await manager.updateAllPrices();
    assert.deepEqual(results, []);
  });

  test('updates prices and Actual Budget balances on success', async () => {
    const manager = createManager([makeStock({ ticker: 'NESN.SW', quantity: 10, accountId: 'acc-1' })]);
    mock.method(manager.stockFetcher, 'fetchMultiplePrices', async () => [
      { ticker: 'NESN.SW', price: 110, currency: 'CHF', name: 'Nestle' }
    ]);

    const results = await manager.updateAllPrices();

    assert.equal(results.length, 1);
    assert.equal(results[0].success, true);
    assert.equal(results[0].price, 110);

    const calls = manager.actualClient.updateAccountBalance.mock.calls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arguments[0], 'acc-1');
    assert.equal(calls[0].arguments[1], 110_000); // 10 * 110 * 100
  });

  test('reports error when price fetch returns null', async () => {
    const manager = createManager([makeStock({ ticker: 'NESN.SW' })]);
    mock.method(manager.stockFetcher, 'fetchMultiplePrices', async () => [
      { ticker: 'NESN.SW', price: null, error: 'Yahoo timeout' }
    ]);

    const results = await manager.updateAllPrices();

    assert.equal(results[0].success, false);
    assert.equal(results[0].error, 'Yahoo timeout');
  });

  test('reports error when Actual Budget update throws', async () => {
    const manager = new PortfolioManager('./portfolio.json', { exchangeSuffix: '.SW' });
    mock.method(manager, 'loadPortfolio', async () => {});
    mock.method(manager, 'savePortfolio', async () => {});
    mock.method(manager.stockFetcher, 'fetchMultiplePrices', async () => [
      { ticker: 'NESN.SW', price: 110 }
    ]);
    mock.method(manager.actualClient, 'updateAccountBalance', async () => {
      throw new Error('Actual Budget connection lost');
    });
    manager.portfolio = { stocks: [makeStock({ ticker: 'NESN.SW', quantity: 10, accountId: 'acc-1' })] };

    const results = await manager.updateAllPrices();

    assert.equal(results[0].success, false);
    assert.equal(results[0].error, 'Actual Budget connection lost');
  });
});

// ---------------------------------------------------------------------------
// updateConfig
// ---------------------------------------------------------------------------
describe('updateConfig', () => {
  test('persists serverURL to portfolio settings', async () => {
    const manager = createManager([]);
    await manager.updateConfig({ serverURL: 'http://new:5006' });

    assert.equal(manager.portfolio.settings.serverURL, 'http://new:5006');
  });

  test('persists password to portfolio settings', async () => {
    const manager = createManager([]);
    await manager.updateConfig({ password: 'mypassword' }); // NOSONAR

    assert.equal(manager.portfolio.settings.password, 'mypassword'); // NOSONAR
  });

  test('persists empty string webPassword (explicit clear)', async () => {
    const manager = createManager([]);
    await manager.updateConfig({ webPassword: '' });

    assert.equal(manager.portfolio.settings.webPassword, '');
  });

  test('reinitializes actualClient and stockFetcher', async () => {
    const manager = createManager([]);
    const originalClient = manager.actualClient;
    const originalFetcher = manager.stockFetcher;

    await manager.updateConfig({ serverURL: 'http://changed:5006' });

    assert.notEqual(manager.actualClient, originalClient);
    assert.notEqual(manager.stockFetcher, originalFetcher);
  });
});

// ---------------------------------------------------------------------------
// resetConfig
// ---------------------------------------------------------------------------
describe('resetConfig', () => {
  test('clears portfolio settings object', async () => {
    const manager = createManager([]);
    manager.portfolio.settings = { serverURL: 'http://old:5006', password: 'old' }; // NOSONAR

    await manager.resetConfig();

    assert.deepEqual(manager.portfolio.settings, {});
  });
});

// ---------------------------------------------------------------------------
// getBudgets
// ---------------------------------------------------------------------------
describe('getBudgets', () => {
  test('delegates to actualClient.getBudgets', async () => {
    const manager = createManager([]);
    mock.method(manager.actualClient, 'getBudgets', async () => [{ id: 'b1', name: 'My Budget' }]);

    const budgets = await manager.getBudgets();

    assert.equal(budgets.length, 1);
    assert.equal(budgets[0].id, 'b1');
  });
});

// ---------------------------------------------------------------------------
// getAccounts
// ---------------------------------------------------------------------------
describe('getAccounts', () => {
  test('delegates to actualClient.getAccounts', async () => {
    const manager = createManager([]);
    mock.method(manager.actualClient, 'getAccounts', async () => [{ id: 'acc-1', name: 'Test' }]);

    const accounts = await manager.getAccounts();

    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].id, 'acc-1');
  });
});

// ---------------------------------------------------------------------------
// shutdown
// ---------------------------------------------------------------------------
describe('shutdown', () => {
  test('delegates to actualClient.shutdown', async () => {
    const manager = createManager([]);
    let called = false;
    mock.method(manager.actualClient, 'shutdown', async () => { called = true; });

    await manager.shutdown();

    assert.equal(called, true);
  });
});
