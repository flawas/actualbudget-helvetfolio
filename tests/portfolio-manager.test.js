import { test, mock } from 'node:test';
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
  manager.portfolio = { stocks };
  return manager;
}

// getPortfolioWithPerformance
test('getPortfolioWithPerformance - calculates gain correctly', async () => {
  const manager = createManager([makeStock({ quantity: 10, lastPrice: 110, purchasePrice: 100, costBasis: 1000 })]);
  const perf = await manager.getPortfolioWithPerformance();

  assert.equal(perf.totalStocks, 1);
  assert.equal(perf.stocks[0].currentValue, 1100);
  assert.equal(perf.stocks[0].gain, 100);
  assert.equal(perf.stocks[0].gainPercent, 10);
});

test('getPortfolioWithPerformance - calculates loss correctly', async () => {
  const manager = createManager([makeStock({ quantity: 5, lastPrice: 80, purchasePrice: 100, costBasis: 500 })]);
  const perf = await manager.getPortfolioWithPerformance();

  assert.equal(perf.stocks[0].currentValue, 400);
  assert.equal(perf.stocks[0].gain, -100);
  assert.ok(perf.stocks[0].gainPercent < 0);
});

test('getPortfolioWithPerformance - handles zero cost basis without divide-by-zero', async () => {
  const manager = createManager([makeStock({ quantity: 10, lastPrice: 110, purchasePrice: 0, costBasis: 0 })]);
  const perf = await manager.getPortfolioWithPerformance();

  assert.equal(perf.stocks[0].gainPercent, 0);
});

test('getPortfolioWithPerformance - aggregates totals across multiple stocks', async () => {
  const manager = createManager([
    makeStock({ ticker: 'NESN.SW', quantity: 10, lastPrice: 100, costBasis: 1000 }),
    makeStock({ ticker: 'NOVN.SW', name: 'Novartis', quantity: 5, lastPrice: 80, costBasis: 400, accountId: 'acc-2' })
  ]);
  const perf = await manager.getPortfolioWithPerformance();

  assert.equal(perf.totalStocks, 2);
  assert.equal(perf.totalValue, 1400);   // 10*100 + 5*80
  assert.equal(perf.totalCostBasis, 1400); // 1000 + 400
  assert.equal(perf.totalGain, 0);
});

// getPortfolioSummary
test('getPortfolioSummary - calculates total value correctly', async () => {
  const manager = createManager([
    makeStock({ quantity: 10, lastPrice: 100 }),
    makeStock({ ticker: 'NOVN.SW', quantity: 4, lastPrice: 50, accountId: 'acc-2' })
  ]);
  const summary = await manager.getPortfolioSummary();

  assert.equal(summary.totalStocks, 2);
  assert.equal(summary.totalValue, 1200); // 10*100 + 4*50
});

test('getPortfolioSummary - maps stock fields correctly', async () => {
  const manager = createManager([makeStock({ quantity: 3, lastPrice: 200 })]);
  const summary = await manager.getPortfolioSummary();

  const s = summary.stocks[0];
  assert.equal(s.ticker, 'NESN.SW');
  assert.equal(s.quantity, 3);
  assert.equal(s.lastPrice, 200);
  assert.equal(s.value, 600);
  assert.equal(s.currency, 'CHF');
});

// updateQuantity error path
test('updateQuantity - throws when ticker not found', async () => {
  const manager = createManager([makeStock({ ticker: 'NESN.SW' })]);
  await assert.rejects(
    () => manager.updateQuantity('XXXX', 5),
    /not found/
  );
});
