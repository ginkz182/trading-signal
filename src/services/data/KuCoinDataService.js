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

      const formattedSymbol = this.formatSymbol(symbol);
      const ohlcv = await this.client.fetchOHLCV(
        formattedSymbol,
        this.timeframe
      );
      await this.sleep(100);

      if (!ohlcv || ohlcv.length === 0) {
        throw new Error("No data returned");
      }

      // UPDATED: Increased limit for better EMA accuracy
      const closingPrices = ohlcv.map((candle) => candle[4]);
      const MEMORY_LIMIT = 150; // INCREASED from 60 to 150 for EMA accuracy

      if (closingPrices.length > MEMORY_LIMIT) {
        const limitedData = closingPrices.slice(-MEMORY_LIMIT);
        console.log(
          `[MEMORY] ${symbol}: Limited from ${closingPrices.length} to ${MEMORY_LIMIT} points`
        );
        return limitedData;
      }

      console.log(
        `[MEMORY] ${symbol}: Using all ${closingPrices.length} points (within ${MEMORY_LIMIT} limit)`
      );
      return closingPrices;
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
    // Don't destroy the service, just clear any internal caches
    // Markets stay loaded for speed
    console.log(`[MEMORY] KuCoin cache cleared (markets kept for speed)`);
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
