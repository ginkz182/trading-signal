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
      // Increase to get enough data for reliable EMA-26 analysis (need 260+ trading days)
      const startDate = dayjs().subtract(400, "day").toDate(); // ~400 calendar days = ~280 trading days

      const result = await yahooFinance.chart(symbol, {
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
      console.error(`Failed to fetch Yahoo prices for ${symbol}:`, error);
      
      // Enhanced debug: Show exactly what Yahoo returned when it fails
      if (error.message && error.message.includes('Unexpected token')) {
        console.log(`[YAHOO ERROR] ${symbol}: Parsing error - Yahoo returned non-JSON response`);
        console.log(`[YAHOO ERROR] Full error message:`, error.message);
        console.log(`[YAHOO ERROR] Error stack:`, error.stack);
        
        // Try to extract the actual response content from the error
        if (error.message.includes('"Edge: Too')) {
          console.log(`[YAHOO ERROR] ${symbol}: Detected "Edge: Too" error - likely rate limiting or blocking`);
          
          // Extract the partial response from error message
          const match = error.message.match(/"(Edge: Too[^"]*)/);
          if (match) {
            console.log(`[YAHOO ERROR] ${symbol}: Partial response content: "${match[1]}"`);
          }
        }
        
        // Show the error type and properties
        console.log(`[YAHOO ERROR] ${symbol}: Error type:`, error.constructor.name);
        console.log(`[YAHOO ERROR] ${symbol}: Error keys:`, Object.keys(error));
      }
      
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
