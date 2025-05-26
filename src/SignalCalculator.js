/**
 * SimplifiedSignalCalculator - Main class for calculating trading signals
 * Fixed to handle different market timing for crypto vs stocks
 */
const NotificationService = require("./services/notification.service");
const { formatSignals } = require("./utils/formatters");
const ExchangeFactory = require("./factories/exchange.factory");
const IndicatorManager = require("./managers/indicator.manager");

class SignalCalculator {
  constructor(config = {}) {
    // Initialize exchange services through factory
    this.exchangeServices = this._initializeExchanges(config);

    // Initialize notification service
    this.notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
    });

    // Initialize indicator manager with EMA configuration
    this.indicatorManager = new IndicatorManager({
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
    });

    // Store trading pairs by market type
    this.tradingPairs = {
      crypto: config.symbols || [],
      stocks: config.stockSymbols || [],
    };
  }

  /**
   * Initialize exchange services based on configuration
   * @param {Object} config - Configuration object
   * @returns {Object} - Map of exchange services
   */
  _initializeExchanges(config) {
    const exchangeFactory = new ExchangeFactory();

    return {
      crypto: exchangeFactory.createExchange("kucoin", config.timeframe),
      stocks: exchangeFactory.createExchange("yahoo", config.timeframe),
    };
  }

  /**
   * Check if stock markets are currently in trading hours
   * @returns {boolean} - True if in trading hours
   */
  _isInStockTradingHours() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // US market hours: roughly 14:30-21:00 UTC (9:30-16:00 EST)
    // Add some buffer for after-hours activity
    return utcHour >= 13 && utcHour <= 22;
  }

  /**
   * Check if stock markets are currently in trading hours
   * @returns {boolean} - True if in trading hours
   */
  _isInStockTradingHours() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // US market hours: roughly 14:30-21:00 UTC (9:30-16:00 EST)
    // Add some buffer for after-hours activity
    return utcHour >= 13 && utcHour <= 22;
  }

  /**
   * Determine how many data points to skip based on market type and timing
   * @param {string} marketType - Market type (crypto/stocks)
   * @param {Array} allPrices - All price data
   * @returns {Object} - Object with prices array and latest price
   */
  _prepareMarketData(marketType, allPrices) {
    if (marketType === "crypto") {
      // Crypto: Always use previous day data (remove latest)
      const prices = allPrices.slice(0, -1);
      const latestPrice = allPrices[allPrices.length - 1];

      return {
        prices,
        latestPrice,
        dataSource: "previous_day_crypto",
      };
    } else {
      // Stocks: Handle market timing
      const inTradingHours = this._isInStockTradingHours();

      if (inTradingHours) {
        // During trading hours: latest price is incomplete "today" data, remove it
        console.log(
          "Stock markets in trading hours: removing latest incomplete data"
        );
        const prices = allPrices.slice(0, -1);
        const latestPrice = allPrices[allPrices.length - 1];

        return {
          prices,
          latestPrice,
          dataSource: "previous_day_stock_trading_hours",
        };
      } else {
        // Outside trading hours/weekends: latest price is complete previous trading day data
        console.log("Stock markets closed: using latest complete data");
        const prices = allPrices;
        const latestPrice = allPrices[allPrices.length - 1];

        return {
          prices,
          latestPrice,
          dataSource: "complete_stock_data_market_closed",
        };
      }
    }
  }

  /**
   * Process a single trading pair and check for signals
   * @param {string} symbol - Trading pair symbol
   * @param {string} marketType - Market type (crypto/stocks)
   * @returns {Object|null} - Signal data or null if no signal
   */
  async _processTradingPair(symbol, marketType) {
    try {
      const exchangeService = this.exchangeServices[marketType];
      const allPrices = await exchangeService.getPrices(symbol);

      if (!allPrices || allPrices.length < 28) {
        // Need at least 28 data points
        console.log(
          `Insufficient data for ${symbol}, need at least 28 data points`
        );
        return null;
      }

      // Prepare market data based on market type and timing
      const { prices, latestPrice, dataSource } = this._prepareMarketData(
        marketType,
        allPrices
      );

      console.log(
        `Processing ${symbol} (${marketType}) with ${dataSource} (${prices.length} points)`
      );

      // Run EMA crossover analysis
      const signalData = this.indicatorManager.analyzePrice(prices, symbol);

      // Guard against undefined/null signalData
      if (!signalData || typeof signalData !== "object") {
        console.error(
          `Invalid signal data returned for ${marketType} ${symbol}`
        );
        return null;
      }

      // Only return data for BUY or SELL signals
      if (signalData.signal && signalData.signal !== "HOLD") {
        return {
          signal: signalData.signal,
          price: latestPrice,
          previousDayPrice: prices[prices.length - 1],
          fastEMA: signalData.fastEMA,
          slowEMA: signalData.slowEMA,
          isBull: signalData.isBull,
          isBear: signalData.isBear,
          details: signalData.details,
          dataSource, // Include data source for debugging
        };
      }

      return null;
    } catch (error) {
      console.error(`Error processing ${marketType} ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Check signals for all configured trading pairs
   * @returns {Object} - Object containing all signals
   */
  async checkSignals() {
    const signals = {
      crypto: {},
      stocks: {},
    };

    console.log("Checking signals with market-aware timing");

    // Process all crypto trading pairs
    for (const symbol of this.tradingPairs.crypto) {
      const signalData = await this._processTradingPair(symbol, "crypto");
      if (signalData) {
        signals.crypto[symbol] = signalData;
      }
    }

    // Process all stock trading pairs
    for (const symbol of this.tradingPairs.stocks) {
      const signalData = await this._processTradingPair(symbol, "stocks");
      if (signalData) {
        signals.stocks[symbol] = signalData;
      }
    }

    return signals;
  }

  /**
   * Scan for signals and send notifications if found
   * @param {Object} options - Scan options
   * @param {boolean} options.sendNotification - Whether to send notification (default: true)
   */
  async scan(options = {}) {
    const { sendNotification = true } = options;

    console.log("Starting market-aware signal scan...");

    const signals = await this.checkSignals();
    const hasSignals =
      Object.keys(signals.crypto).length > 0 ||
      Object.keys(signals.stocks).length > 0;

    if (hasSignals) {
      const message = formatSignals(signals, { signalSource: "MARKET_AWARE" });

      console.log("Formatted message (MARKET_AWARE):");
      console.log(message);

      if (sendNotification) {
        await this.notificationService.sendToTelegram(message);
        console.log("Notification sent");
      } else {
        console.log("Notification sending skipped as per options");
      }

      return { signals, message };
    } else {
      console.log("No signals found");
      return { signals, message: null };
    }
  }
}

module.exports = SignalCalculator;
