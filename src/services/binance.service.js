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
}

module.exports = BinanceService;
