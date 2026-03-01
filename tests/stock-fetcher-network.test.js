import { describe, test, mock } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock yahoo-finance2 BEFORE importing stock-fetcher.js.
// StockFetcher does `const yf = new yahooFinance()` at module-load time, so
// mock.module must intercept the class before the module is evaluated.
// ---------------------------------------------------------------------------
const quoteSummaryFn = mock.fn(async () => ({
    price: {
        regularMarketPrice: 105,
        currency: 'CHF',
        longName: 'Nestle SA',
        shortName: 'NESN',
    }
}));

class MockYahooFinance {
    quoteSummary(...args) {
        return quoteSummaryFn(...args);
    }
}

mock.module('yahoo-finance2', { defaultExport: MockYahooFinance });

const { default: StockFetcher } = await import('../src/stock-fetcher.js');

// ---------------------------------------------------------------------------
// fetchPrice — network path (bypasses cache by using a fresh fetcher per test)
// ---------------------------------------------------------------------------
describe('fetchPrice network', () => {
    test('fetches and returns structured price data', async () => {
        quoteSummaryFn.mock.resetCalls();
        const fetcher = new StockFetcher();
        const data = await fetcher.fetchPrice('NESN');

        assert.equal(data.ticker, 'NESN.SW');
        assert.equal(data.price, 105);
        assert.equal(data.currency, 'CHF');
        assert.equal(data.name, 'Nestle SA');
        assert.ok(data.timestamp instanceof Date);
        assert.equal(quoteSummaryFn.mock.calls.length, 1);
    });

    test('caches the result — second call does not hit the network', async () => {
        quoteSummaryFn.mock.resetCalls();
        const fetcher = new StockFetcher();
        await fetcher.fetchPrice('NESN');
        await fetcher.fetchPrice('NESN'); // should be served from cache

        assert.equal(quoteSummaryFn.mock.calls.length, 1);
    });

    test('throws when regularMarketPrice is absent in response', async () => {
        quoteSummaryFn.mock.mockImplementationOnce(async () => ({ price: { currency: 'CHF' } }));
        const fetcher = new StockFetcher();

        await assert.rejects(() => fetcher.fetchPrice('NESN'), /Failed to fetch price/);
    });

    test('uses shortName when longName is missing', async () => {
        quoteSummaryFn.mock.mockImplementationOnce(async () => ({
            price: { regularMarketPrice: 50, currency: 'CHF', longName: null, shortName: 'NESN Short' }
        }));
        const fetcher = new StockFetcher();
        const data = await fetcher.fetchPrice('NESN');

        assert.equal(data.name, 'NESN Short');
    });

    test('uses formatted ticker as name when both longName and shortName are absent', async () => {
        quoteSummaryFn.mock.mockImplementationOnce(async () => ({
            price: { regularMarketPrice: 50, currency: 'CHF', longName: null, shortName: null }
        }));
        const fetcher = new StockFetcher();
        const data = await fetcher.fetchPrice('NESN');

        assert.equal(data.name, 'NESN.SW');
    });

    test('defaults currency to CHF when missing from response', async () => {
        quoteSummaryFn.mock.mockImplementationOnce(async () => ({
            price: { regularMarketPrice: 50, currency: undefined, longName: 'Test Corp' }
        }));
        const fetcher = new StockFetcher();
        const data = await fetcher.fetchPrice('NESN');

        assert.equal(data.currency, 'CHF');
    });

    test('throws wrapped error when quoteSummary throws', async () => {
        quoteSummaryFn.mock.mockImplementationOnce(async () => { throw new Error('Yahoo API down'); });
        const fetcher = new StockFetcher();

        await assert.rejects(
            () => fetcher.fetchPrice('NESN'),
            /Failed to fetch price.*Yahoo API down/
        );
    });
});
