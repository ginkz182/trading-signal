const ccxt = require('ccxt');

class KuCoinService {
  constructor(timeframe) {
    this.client = new ccxt.kucoin({
      // Optional: Add these for better rate limit handling
      enableRateLimit: true,
      timeout: 30000, // 30 seconds
    });
    this.timeframe = timeframe;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getPrices(symbol) {
    try {
      // Convert symbol if needed (usually not necessary as KuCoin uses same format)
      const formattedSymbol = this.formatSymbol(symbol);

      const ohlcv = await this.client.fetchOHLCV(formattedSymbol, this.timeframe);
      await this.sleep(100); // Keeping your original rate limit delay

      if (!ohlcv || ohlcv.length === 0) {
        throw new Error('No data returned');
      }

      return ohlcv.map(candle => candle[4]); // Return closing prices
    } catch (error) {
      console.error(`Failed to fetch KuCoin prices for ${symbol}:`, error);
      return null;
    }
  }

  formatSymbol(symbol) {
    // KuCoin typically uses USDT pairs, but some might need USD
    // You can add more symbol mappings if needed
    return symbol;
  }

  // Helper method to check if market exists
  async validateSymbol(symbol) {
    try {
      await this.client.loadMarkets();
      return this.client.markets[symbol] !== undefined;
    } catch (error) {
      console.error(`Error validating symbol ${symbol}:`, error);
      return false;
    }
  }
}

module.exports = KuCoinService;
