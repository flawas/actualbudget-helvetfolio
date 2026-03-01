import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
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
