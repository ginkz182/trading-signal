const dayjs = require("dayjs");
const yahooFinance = require("yahoo-finance2").default;

/**
 * Fast YahooFinanceService
 */
class YahooFinanceService {
  constructor(timeframe) {
    this.timeframe = timeframe;
    console.log(`[MEMORY] Created persistent YahooFinanceService instance`);
  }

  async getPrices(symbol) {
    try {
      const endDate = new Date();
      // Increase to get enough data for reliable EMA-26 analysis (need ~80+ trading days)
      const startDate = dayjs().subtract(120, "day").toDate(); // Increased for EMA accuracy

      const result = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: this.timeframe,
      });

      if (!result || !result.length) {
        throw new Error(`No data found for ${symbol}`);
      }

      // 🚨 CRITICAL: Limit data aggressively
      const closingPrices = result.map((quote) => quote.close);
      const MEMORY_LIMIT = 150; // Only keep 150 data points

      if (closingPrices.length > MEMORY_LIMIT) {
        const limitedData = closingPrices.slice(-MEMORY_LIMIT);
        console.log(
          `[MEMORY] ${symbol}: Limited from ${closingPrices.length} to ${MEMORY_LIMIT} points`
        );
        return limitedData;
      }

      return closingPrices;
    } catch (error) {
      console.error(`Failed to fetch Yahoo prices for ${symbol}:`, error);
      return null;
    }
  }

  clearCache() {
    // Yahoo doesn't cache data, so nothing to clear
    console.log(`[MEMORY] Yahoo cache cleared`);
  }

  cleanup() {
    console.log(`[MEMORY] Yahoo cleanup`);
    this.timeframe = null;
  }
}

module.exports = YahooFinanceService;
