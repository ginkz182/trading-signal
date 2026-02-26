const ccxt = require('ccxt');

class BinanceService {
  constructor(timeframe) {
    this.client = new ccxt.binance();
    this.timeframe = timeframe;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getPrices(symbol) {
    try {
      const ohlcv = await this.client.fetchOHLCV(symbol, this.timeframe);
      await this.sleep(100);
      return ohlcv.map(candle => candle[4]);
    } catch (error) {
      console.error(`Failed to fetch Binance prices for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch historical daily OHLCV data for backtesting.
   * @param {string} symbol - e.g. "BTC/USDT"
   * @param {number} limit - Number of daily candles to fetch
   * @returns {Array|null} Array of {time, open, high, low, close, volume} or null on error
   */
  async getHistoricalPrices(symbol, limit = 500) {
    try {
      const ohlcv = await this.client.fetchOHLCV(symbol, '1d', undefined, limit);
      await this.sleep(100);
      return ohlcv.map(candle => ({
        time: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      console.error(`Failed to fetch historical prices for ${symbol}:`, error);
      return null;
    }
  }
}

module.exports = BinanceService;
