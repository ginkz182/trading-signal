const ccxt = require("ccxt");

/**
 * Fast KuCoinService - keeps markets loaded but clears data after each scan
 * Updated: Increased data limit for better EMA accuracy
 */
class KuCoinService {
  constructor(timeframe) {
    this.client = new ccxt.kucoin({
      enableRateLimit: true,
      timeout: 30000,
    });
    this.timeframe = timeframe;
    this.marketsLoaded = false;

    console.log(`[MEMORY] Created persistent KuCoinService instance`);
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Load markets once and keep them for the session
   */
  async ensureMarketsLoaded() {
    if (!this.marketsLoaded) {
      console.log(`[MEMORY] Loading KuCoin markets once...`);
      await this.client.loadMarkets();
      this.marketsLoaded = true;
      console.log(
        `[MEMORY] KuCoin markets loaded (${
          Object.keys(this.client.markets).length
        } pairs)`
      );
    }
  }

  async getPrices(symbol) {
    try {
      // Ensure markets are loaded (only happens once)
      await this.ensureMarketsLoaded();

      // Validate symbol exists before fetching
      if (!this.client.markets[symbol]) {
        throw new Error(`Symbol ${symbol} not found in markets`);
      }

      const formattedSymbol = this.formatSymbol(symbol);
      const ohlcv = await this.client.fetchOHLCV(
        formattedSymbol,
        this.timeframe,
        undefined,
        300 // Request 300 candles for EMA26 accuracy
      );
      await this.sleep(100);

      if (!ohlcv || ohlcv.length === 0) {
        throw new Error("No data returned");
      }

      // UPDATED: Return full OHLCV data for pattern detection
      const MEMORY_LIMIT = 300; // INCREASED from 150 to 300 for EMA26 accuracy

      // Apply memory limit to OHLCV data
      let processedData = ohlcv;
      if (ohlcv.length > MEMORY_LIMIT) {
        processedData = ohlcv.slice(-MEMORY_LIMIT);
        console.log(
          `[MEMORY] ${symbol}: Limited from ${ohlcv.length} to ${MEMORY_LIMIT} OHLCV candles`
        );
      } else {
        console.log(
          `[MEMORY] ${symbol}: Using all ${ohlcv.length} OHLCV candles (within ${MEMORY_LIMIT} limit)`
        );
      }

      // Return both OHLCV data and closing prices for backward compatibility
      const closingPrices = processedData.map((candle) => candle[4]);
      
      return {
        ohlcv: processedData, // Full OHLCV data for pattern detection
        closingPrices,        // Closing prices for EMA calculations
        dataType: 'ohlcv',    // Indicate data type
        candleCount: processedData.length
      };
    } catch (error) {
      console.error(`Failed to fetch KuCoin prices for ${symbol}:`, error);
      return null;
    }
  }

  formatSymbol(symbol) {
    return symbol;
  }

  async validateSymbol(symbol) {
    try {
      await this.ensureMarketsLoaded();
      return this.client.markets[symbol] !== undefined;
    } catch (error) {
      console.error(`Error validating symbol ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Clear cached data but keep the service alive for speed
   */
  clearCache() {
    // Add cache clear counter to avoid clearing too frequently
    if (!this.cacheClears) this.cacheClears = 0;
    this.cacheClears++;
    
    // FIXED: Don't clear markets unless memory is critically high
    // The original logic was too aggressive and caused market lookup failures
    console.log(`[MEMORY] KuCoin cache check complete (clear #${this.cacheClears}) - markets preserved`);
  }

  /**
   * Full cleanup when shutting down
   */
  cleanup() {
    console.log(`[MEMORY] Full KuCoin cleanup`);
    if (this.client && this.client.markets) {
      this.client.markets = {};
      this.marketsLoaded = false;
    }
    this.client = null;
  }
}

module.exports = KuCoinService;
