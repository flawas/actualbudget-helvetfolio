import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import StockFetcher from '../src/stock-fetcher.js';

// ---------------------------------------------------------------------------
// formatSwissTicker
// ---------------------------------------------------------------------------
describe('formatSwissTicker', () => {
  test('adds default .SW suffix to bare ticker', () => {
    const fetcher = new StockFetcher();
    assert.equal(fetcher.formatSwissTicker('NESN'), 'NESN.SW');
  });

  test('leaves ticker with existing suffix unchanged', () => {
    const fetcher = new StockFetcher();
    assert.equal(fetcher.formatSwissTicker('NESN.SW'), 'NESN.SW');
  });

  test('respects custom exchangeSuffix', () => {
    const fetcher = new StockFetcher('.DE');
    assert.equal(fetcher.formatSwissTicker('SAP'), 'SAP.DE');
  });

  test('leaves ticker with any existing suffix unchanged (custom exchange)', () => {
    const fetcher = new StockFetcher('.DE');
    assert.equal(fetcher.formatSwissTicker('VOW3.DE'), 'VOW3.DE');
  });
});

// ---------------------------------------------------------------------------
// fetchPrice cache behaviour
// ---------------------------------------------------------------------------
describe('fetchPrice cache', () => {
  test('returns cached value without hitting network', async () => {
    const fetcher = new StockFetcher();
    const cachedData = { ticker: 'NESN.SW', price: 105.5, currency: 'CHF', timestamp: new Date(), name: 'Nestle' };
    fetcher.cache.set('NESN.SW', { data: cachedData, timestamp: Date.now() });

    const result = await fetcher.fetchPrice('NESN');
    assert.equal(result.price, 105.5);
    assert.equal(result.ticker, 'NESN.SW');
  });

  test('a fresh cache entry passes the freshness check', () => {
    const fetcher = new StockFetcher();
    fetcher.cache.set('NESN.SW', { data: {}, timestamp: Date.now() });
    const cached = fetcher.cache.get('NESN.SW');
    assert.ok(Date.now() - cached.timestamp < fetcher.cacheExpiry);
  });

  test('an expired cache entry fails the freshness check (triggers re-fetch)', () => {
    const fetcher = new StockFetcher();
    // timestamp: 0 is epoch — guaranteed to be older than cacheExpiry (5 min)
    fetcher.cache.set('NESN.SW', { data: {}, timestamp: 0 });
    const cached = fetcher.cache.get('NESN.SW');
    assert.ok(!(Date.now() - cached.timestamp < fetcher.cacheExpiry));
  });
});

// ---------------------------------------------------------------------------
// fetchMultiplePrices
// ---------------------------------------------------------------------------
describe('fetchMultiplePrices', () => {
  test('returns error objects for failed fetches', async () => {
    const fetcher = new StockFetcher();
    mock.method(fetcher, 'fetchPrice', async () => { throw new Error('Network error'); });

    const results = await fetcher.fetchMultiplePrices(['NESN'], 5, 0);
    assert.equal(results.length, 1);
    assert.equal(results[0].price, null);
    assert.equal(results[0].error, 'Network error');
    assert.equal(results[0].ticker, 'NESN.SW');
  });

  test('processes all tickers across multiple batches', async () => {
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

  test('preserves result order matching input order', async () => {
    const fetcher = new StockFetcher();
    const prices = { 'A.SW': 10, 'B.SW': 20, 'C.SW': 30 };

    mock.method(fetcher, 'fetchPrice', async (ticker) => {
      const formatted = fetcher.formatSwissTicker(ticker);
      return { ticker: formatted, price: prices[formatted], currency: 'CHF', timestamp: new Date(), name: ticker };
    });

    const results = await fetcher.fetchMultiplePrices(['A', 'B', 'C'], 5, 0);
    assert.equal(results[0].ticker, 'A.SW');
    assert.equal(results[0].price, 10);
    assert.equal(results[1].ticker, 'B.SW');
    assert.equal(results[1].price, 20);
    assert.equal(results[2].ticker, 'C.SW');
    assert.equal(results[2].price, 30);
  });

  test('handles mixed success and failure within the same batch', async () => {
    const fetcher = new StockFetcher();

    mock.method(fetcher, 'fetchPrice', async (ticker) => {
      if (ticker === 'FAIL') throw new Error('bad ticker');
      return { ticker: fetcher.formatSwissTicker(ticker), price: 99, currency: 'CHF', timestamp: new Date(), name: ticker };
    });

    const results = await fetcher.fetchMultiplePrices(['NESN', 'FAIL', 'NOVN'], 5, 0);
    assert.equal(results.length, 3);
    assert.equal(results[0].price, 99);    // success
    assert.equal(results[1].price, null);  // failure
    assert.equal(results[1].error, 'bad ticker');
    assert.equal(results[2].price, 99);   // success after failure
  });
});

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------
describe('clearCache', () => {
  test('empties the cache map', () => {
    const fetcher = new StockFetcher();
    fetcher.cache.set('NESN.SW', { data: {}, timestamp: Date.now() });
    fetcher.cache.set('NOVN.SW', { data: {}, timestamp: Date.now() });
    assert.equal(fetcher.cache.size, 2);

    fetcher.clearCache();
    assert.equal(fetcher.cache.size, 0);
  });
});
