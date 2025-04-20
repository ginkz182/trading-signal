/**
 * SignalCalculator - Main class for calculating trading signals
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

    // Initialize indicator manager
    this.indicatorManager = new IndicatorManager();

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
   * @param {boolean} usePreviousDay - Whether to use previous day's data for signal
   * @returns {Object|null} - Signal data or null if no signal
   */
  async _processTradingPair(symbol, marketType, usePreviousDay = false) {
    try {
      const exchangeService = this.exchangeServices[marketType];
      const prices = await exchangeService.getPrices(symbol);

      if (!prices || prices.length < 28) {
        // Need at least 28 data points to allow for previous day
        console.log(
          `Insufficient data for ${symbol}, need at least 28 data points`
        );
        return null;
      }

      // Create a copy of prices to avoid modifying the original
      let pricesForAnalysis = [...prices];

      // If using previous day's data, exclude the latest price
      if (usePreviousDay) {
        // Use all data until yesterday (remove the latest price)
        pricesForAnalysis = prices.slice(0, -1);
        console.log(
          `Using previous day's data for ${symbol} (${pricesForAnalysis.length} data points)`
        );
      }

      // Run technical indicators
      const signalData = this.indicatorManager.analyzePrice(pricesForAnalysis);

      // Guard against undefined/null signalData
      if (!signalData || typeof signalData !== "object") {
        console.error(
          `Invalid signal data returned for ${marketType} ${symbol}`
        );
        return null;
      }

      if (signalData.signal && signalData.signal !== "HOLD") {
        return {
          signal: signalData.signal,
          price: prices[prices.length - 1], // Always return latest price
          previousDayPrice: usePreviousDay ? prices[prices.length - 2] : null, // Include previous day's price if requested
          macd: signalData.macd || 0, // Provide default if macd is undefined
          zone: signalData.zone || "UNKNOWN", // CDC Action Zone color
          fastEMA: signalData.fastEMA,
          slowEMA: signalData.slowEMA,
          isBull: signalData.isBull,
          isBear: signalData.isBear,
          details: signalData.details,
          usingPreviousDayData: usePreviousDay, // Indicate if using previous day's data
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
   * @param {Object} options - Signal checking options
   * @param {boolean} options.usePreviousDay - Whether to use previous day's data for signal
   * @returns {Object} - Object containing all signals
   */
  async checkSignals(options = {}) {
    const { usePreviousDay = false } = options;

    const signals = {
      crypto: {},
      stocks: {},
    };

    console.log(`Checking signals with usePreviousDay=${usePreviousDay}`);

    // Process all crypto trading pairs
    for (const symbol of this.tradingPairs.crypto) {
      const signalData = await this._processTradingPair(
        symbol,
        "crypto",
        usePreviousDay
      );
      if (signalData) {
        signals.crypto[symbol] = signalData;
      }
    }

    // Process all stock trading pairs
    for (const symbol of this.tradingPairs.stocks) {
      const signalData = await this._processTradingPair(
        symbol,
        "stocks",
        usePreviousDay
      );
      if (signalData) {
        signals.stocks[symbol] = signalData;
      }
    }

    return signals;
  }

  /**
   * Scan for signals and send notifications if found
   * @param {Object} options - Scan options
   * @param {boolean} options.usePreviousDay - Whether to use previous day's data for signal
   * @param {boolean} options.sendNotification - Whether to send notification (default: true)
   */
  async scan(options = {}) {
    const { usePreviousDay = false, sendNotification = true } = options;

    console.log(`Starting scan... (usePreviousDay=${usePreviousDay})`);

    const signals = await this.checkSignals({ usePreviousDay });
    const hasSignals =
      Object.keys(signals.crypto).length > 0 ||
      Object.keys(signals.stocks).length > 0;

    if (hasSignals) {
      // Add tag in message if using previous day's data
      const signalSource = usePreviousDay ? "PREVIOUS DAY" : "CURRENT";
      const message = formatSignals(signals, { signalSource });

      console.log(`Formatted message (${signalSource}):`);
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
