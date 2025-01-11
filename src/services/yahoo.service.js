const yahooFinance = require('yahoo-finance2').default;
const dayjs = require('dayjs');

class YahooFinanceService {
  constructor(timeframe) {
    this.timeframe = timeframe;
  }

  async getPrices(symbol) {
    try {
      const endDate = new Date();
      const startDate = dayjs().subtract(100, 'day').toDate();

      const result = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: this.timeframe
      });

      if (!result || !result.length) {
        throw new Error(`No data found for ${symbol}`);
      }

      return result.map(quote => quote.close);
    } catch (error) {
      console.error(`Failed to fetch Yahoo prices for ${symbol}:`, error);
      return null;
    }
  }
}

module.exports = YahooFinanceService;
