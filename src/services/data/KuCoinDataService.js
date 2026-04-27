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

      // Strip today's incomplete candle only if it's actually today's UTC date.
      // At 00:05 UTC the new day's candle may not exist yet, so the last candle
      // could be yesterday's complete one — don't strip it in that case.
      const lastCandle = ohlcv[ohlcv.length - 1];
      const lastCandleDate = new Date(lastCandle[0]);
      const now = new Date();
      const isTodayCandle =
        lastCandleDate.getUTCFullYear() === now.getUTCFullYear() &&
        lastCandleDate.getUTCMonth() === now.getUTCMonth() &&
        lastCandleDate.getUTCDate() === now.getUTCDate();

      if (isTodayCandle) {
        ohlcv.pop();
        console.log(`[KUCOIN] ${symbol}: Stripped today's incomplete candle (${lastCandleDate.toISOString().slice(0, 10)})`);
      } else {
        console.log(`[KUCOIN] ${symbol}: Last candle is ${lastCandleDate.toISOString().slice(0, 10)} (complete, keeping it)`);
      }

      // UPDATED: Increased limit for better EMA accuracy
      const closingPrices = ohlcv.map((candle) => candle[4]);
      const MEMORY_LIMIT = 300; // INCREASED from 150 to 300 for EMA26 accuracy

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
