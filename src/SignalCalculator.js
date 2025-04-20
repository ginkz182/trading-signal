/**
 * SimplifiedSignalCalculator - Main class for calculating trading signals
 * Focused on EMA crossovers using previous day data for signal generation
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
      lineToken: process.env.lineToken,
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

      // Always use previous day's data by removing the latest price
      const prices = allPrices.slice(0, -1);
      const latestPrice = allPrices[allPrices.length - 1]; // Store latest price for reference

      console.log(
        `Processing ${symbol} with previous day data (${prices.length} points, excluding latest)`
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
          price: latestPrice, // Return latest price for reference
          previousDayPrice: prices[prices.length - 1], // Previous day's close price
          fastEMA: signalData.fastEMA,
          slowEMA: signalData.slowEMA,
          isBull: signalData.isBull,
          isBear: signalData.isBear,
          details: signalData.details,
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

    console.log("Checking signals using previous day data for EMA crossovers");

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

    console.log("Starting scan using previous day data for EMA crossovers...");

    const signals = await this.checkSignals();
    const hasSignals =
      Object.keys(signals.crypto).length > 0 ||
      Object.keys(signals.stocks).length > 0;

    if (hasSignals) {
      const message = formatSignals(signals, { signalSource: "PREVIOUS DAY" });

      console.log("Formatted message (PREVIOUS DAY):");
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
