const dayjs = require("dayjs");
const YahooFinance = require("yahoo-finance2").default;

/**
 * Fast YahooFinanceService
 */
class YahooFinanceService {
  constructor(timeframe) {
    this.timeframe = timeframe;
    this.yahooFinance = new YahooFinance();
    console.log(`[MEMORY] Created persistent YahooFinanceService instance`);
  }

  async getPrices(symbol) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000; // 2 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const endDate = new Date();
        // Increase to get enough data for reliable EMA-26 analysis (need 260+ trading days)
        const startDate = dayjs().subtract(400, "day").toDate(); // ~400 calendar days = ~280 trading days

        const result = await this.yahooFinance.chart(symbol, {
          period1: startDate,
          period2: endDate,
          interval: this.timeframe,
          includePrePost: false,
        });

        if (!result || !result.quotes || !result.quotes.length) {
          throw new Error(`No data found for ${symbol}`);
        }

        // 🚨 CRITICAL: Limit data aggressively
        const closingPrices = result.quotes.map((quote) => quote.close);
        const MEMORY_LIMIT = 300; // Only keep 300 data points

        if (closingPrices.length > MEMORY_LIMIT) {
          const limitedData = closingPrices.slice(-MEMORY_LIMIT);
          console.log(
            `[MEMORY] ${symbol}: Limited from ${closingPrices.length} to ${MEMORY_LIMIT} points`
          );
          return limitedData;
        }

        return closingPrices;
      } catch (error) {
        // Check for rate-limit like errors
        const isRateLimitError =
          error.message &&
          (error.message.includes("Unexpected token") ||
            error.message.includes("Too Many Requests") ||
            error.message.includes("429"));

        if (isRateLimitError && attempt < MAX_RETRIES) {
          console.warn(
            `[YAHOO WARN] Rate limit error for ${symbol} on attempt ${attempt}. Retrying in ${
              RETRY_DELAY_MS / 1000
            }s...`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          continue; // Move to the next attempt
        }

        // If it's the last attempt or not a rate-limit error, log details
        console.error(
          `Failed to fetch Yahoo prices for ${symbol} after ${attempt} attempt(s):`,
          error
        );

        // Enhanced debug: Show exactly what Yahoo returned when it fails
        if (error.message && error.message.includes("Unexpected token")) {
          console.log(
            `[YAHOO ERROR] ${symbol}: Parsing error - Yahoo returned non-JSON response`
          );
          console.log(`[YAHOO ERROR] Full error message:`, error.message);
          
          // Try to extract the actual response content from the error
          if (error.message.includes('"Edge: Too')) {
            console.log(
              `[YAHOO ERROR] ${symbol}: Detected "Edge: Too" error - likely rate limiting or blocking`
            );
          }
        }

        return null; // Return null after the final failed attempt or for non-retryable errors
      }
    }
    return null; // Should not be reached if loop is correct
  }

  /**
   * Fetch historical daily OHLCV data for backtesting.
   * Matches the output format of BinanceService.getHistoricalPrices
   * @param {string} symbol - e.g. "AAPL"
   * @param {number} limit - Number of daily candles to fetch
   * @returns {Array|null} Array of {time, open, high, low, close, volume} or null on error
   */
  async getHistoricalPrices(symbol, limit = 500) {
    try {
      const endDate = new Date();
      // Calculate start date based on requested limit (+ buffer for weekends/holidays)
      const bufferDays = Math.ceil(limit * 1.5);
      const startDate = dayjs().subtract(bufferDays, "day").toDate();

      const result = await this.yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: this.timeframe || '1d',
        includePrePost: false,
      });

      if (!result || !result.quotes || !result.quotes.length) {
        throw new Error(`No data found for ${symbol}`);
      }

      // Format to match Binance OHLCV
      const ohlcv = result.quotes.map(quote => ({
        time: quote.date ? new Date(quote.date).getTime() : Date.now(),
        open: quote.open,
        high: quote.high,
        low: quote.low,
        close: quote.close,
        volume: quote.volume,
      }));

      // Return exactly the requested number of candles (slice from the end)
      return ohlcv.slice(-limit);
    } catch (error) {
      console.error(`Failed to fetch Yahoo historical prices for ${symbol}:`, error);
      return null;
    }
  }

  clearCache() {
    // Yahoo doesn't cache data, so nothing to clear
    console.log(`[MEMORY] Yahoo cache cleared`);
  }

  async validateSymbol(symbol) {
    try {
      // Use quoteSummary for a lightweight check
      const result = await this.yahooFinance.quoteSummary(symbol, { modules: ["price"] });
      
      if (!result || !result.price) return false;

      const allowedTypes = ['EQUITY', 'ETF', 'FUTURE', 'INDEX', 'CURRENCY'];
      const quoteType = result.price.quoteType;

      // Filter out Mutual Funds and other noise
      if (!allowedTypes.includes(quoteType)) {
          console.log(`[YAHOO] Rejected ${symbol} (Type: ${quoteType})`);
          return false;
      }

      return true;
    } catch (error) {
      // Yahoo finance throws if not found
      return false;
    }
  }

  cleanup() {
    console.log(`[MEMORY] Yahoo cleanup`);
    this.timeframe = null;
  }
}

module.exports = YahooFinanceService;
