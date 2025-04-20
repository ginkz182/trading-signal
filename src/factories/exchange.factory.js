/**
 * ExchangeFactory - Factory pattern for creating exchange service instances
 */
const BinanceService = require("../services/binance.service");
const KuCoinService = require("../services/kucoin.service");
const YahooFinanceService = require("../services/yahoo.service");

class ExchangeFactory {
  /**
   * Create an exchange service instance
   * @param {string} exchangeType - Type of exchange (binance, kucoin, yahoo)
   * @param {string} timeframe - Timeframe for price data
   * @returns {Object} - Exchange service instance
   */
  createExchange(exchangeType, timeframe) {
    switch (exchangeType.toLowerCase()) {
      case "binance":
        return new BinanceService(timeframe);
      case "kucoin":
        return new KuCoinService(timeframe);
      case "yahoo":
        return new YahooFinanceService(timeframe);
      default:
        throw new Error(`Unsupported exchange type: ${exchangeType}`);
    }
  }
}

module.exports = ExchangeFactory;
