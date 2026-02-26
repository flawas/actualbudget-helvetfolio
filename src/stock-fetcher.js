import yahooFinance from 'yahoo-finance2';

const yf = new yahooFinance();

/**
 * Fetches stock price data from Yahoo Finance
 */
class StockFetcher {
  /**
   * @param {string} exchangeSuffix - Exchange suffix to append to bare tickers (e.g. '.SW', '.DE', '.L')
   */
  constructor(exchangeSuffix = '.SW') {
    this.exchangeSuffix = exchangeSuffix;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get the Yahoo Finance ticker for a stock, appending the exchange suffix when absent.
   * @param {string} ticker - Stock ticker (e.g., 'NESN' or 'NESN.SW')
   * @returns {string} - Formatted ticker with exchange suffix
   */
  formatSwissTicker(ticker) {
    if (ticker.includes('.')) {
      return ticker; // Already has an exchange suffix
    }
    return `${ticker}${this.exchangeSuffix}`;
  }

  /**
   * Fetch current price for a single stock
   * @param {string} ticker - Stock ticker (e.g., 'NESN' or 'NESN.SW')
   * @returns {Promise<{ticker: string, price: number, currency: string, timestamp: Date}>}
   */
  async fetchPrice(ticker) {
    const formattedTicker = this.formatSwissTicker(ticker);

    // Check cache
    const cached = this.cache.get(formattedTicker);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      // Use quoteSummary as it often bypasses the strict crumb/429 checks effective on quote()
      const result = await yf.quoteSummary(formattedTicker, { modules: ['price'] });
      const quote = result.price;

      if (!quote || !quote.regularMarketPrice) {
        throw new Error(`No price data available for ${formattedTicker}`);
      }

      const marketPrice = quote.regularMarketPrice;
      const currency = quote.currency || 'CHF';
      const name = quote.longName || quote.shortName || formattedTicker;

      const data = {
        ticker: formattedTicker,
        price: marketPrice,
        currency: currency,
        timestamp: new Date(),
        name: name
      };

      // Cache the result
      this.cache.set(formattedTicker, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      throw new Error(`Failed to fetch price for ${formattedTicker}: ${error.message}`);
    }
  }

  /**
   * Fetch prices for multiple stocks, processing in batches to avoid rate limiting.
   * @param {string[]} tickers - Array of stock tickers
   * @param {number} batchSize - Max concurrent requests per batch (default 5)
   * @param {number} delayMs - Delay between batches in milliseconds (default 500)
   * @returns {Promise<Array>} - Array of price data
   */
  async fetchMultiplePrices(tickers, batchSize = 5, delayMs = 500) {
    const results = [];

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ticker =>
          this.fetchPrice(ticker).catch(error => ({
            ticker: this.formatSwissTicker(ticker),
            error: error.message,
            price: null
          }))
        )
      );
      results.push(...batchResults);

      if (i + batchSize < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Clear the price cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default StockFetcher;
