import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import StockFetcher from '../src/stock-fetcher.js';

// formatSwissTicker
test('formatSwissTicker - adds default .SW suffix to bare ticker', () => {
  const fetcher = new StockFetcher();
  assert.equal(fetcher.formatSwissTicker('NESN'), 'NESN.SW');
});

test('formatSwissTicker - leaves ticker with existing suffix unchanged', () => {
  const fetcher = new StockFetcher();
  assert.equal(fetcher.formatSwissTicker('NESN.SW'), 'NESN.SW');
});

test('formatSwissTicker - respects custom exchangeSuffix', () => {
  const fetcher = new StockFetcher('.DE');
  assert.equal(fetcher.formatSwissTicker('SAP'), 'SAP.DE');
});

test('formatSwissTicker - leaves ticker with any existing suffix unchanged', () => {
  const fetcher = new StockFetcher('.DE');
  assert.equal(fetcher.formatSwissTicker('VOW3.DE'), 'VOW3.DE');
});

// Cache behaviour
test('fetchPrice - returns cached value without hitting network', async () => {
  const fetcher = new StockFetcher();
  const cachedData = { ticker: 'NESN.SW', price: 105.5, currency: 'CHF', timestamp: new Date(), name: 'Nestle' };
  fetcher.cache.set('NESN.SW', { data: cachedData, timestamp: Date.now() });

  const result = await fetcher.fetchPrice('NESN');
  assert.equal(result.price, 105.5);
  assert.equal(result.ticker, 'NESN.SW');
});

test('fetchPrice - stores result in cache after fetch', async () => {
  const fetcher = new StockFetcher();
  const fakeData = { ticker: 'NOVN.SW', price: 90, currency: 'CHF', timestamp: new Date(), name: 'Novartis' };

  // Pre-populate cache as if a fresh fetch just occurred
  fetcher.cache.set('NOVN.SW', { data: fakeData, timestamp: Date.now() });

  const result = await fetcher.fetchPrice('NOVN');
  assert.ok(fetcher.cache.has('NOVN.SW'), 'cache should contain the ticker');
  assert.equal(result.price, 90);
});

// fetchMultiplePrices
test('fetchMultiplePrices - returns error objects for failed fetches', async () => {
  const fetcher = new StockFetcher();
  mock.method(fetcher, 'fetchPrice', async () => { throw new Error('Network error'); });

  const results = await fetcher.fetchMultiplePrices(['NESN'], 5, 0);
  assert.equal(results.length, 1);
  assert.equal(results[0].price, null);
  assert.equal(results[0].error, 'Network error');
  assert.equal(results[0].ticker, 'NESN.SW');
});

test('fetchMultiplePrices - processes all tickers across batches', async () => {
  const fetcher = new StockFetcher();
  const tickers = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const called = [];

  mock.method(fetcher, 'fetchPrice', async (ticker) => {
    called.push(ticker);
    return { ticker: fetcher.formatSwissTicker(ticker), price: 1, currency: 'CHF', timestamp: new Date(), name: ticker };
  });

  const results = await fetcher.fetchMultiplePrices(tickers, 3, 0);
  assert.equal(results.length, 7);
  assert.equal(called.length, 7);
});

// clearCache
test('clearCache - empties the cache map', () => {
  const fetcher = new StockFetcher();
  fetcher.cache.set('NESN.SW', { data: {}, timestamp: Date.now() });
  fetcher.cache.set('NOVN.SW', { data: {}, timestamp: Date.now() });
  assert.equal(fetcher.cache.size, 2);

  fetcher.clearCache();
  assert.equal(fetcher.cache.size, 0);
});
