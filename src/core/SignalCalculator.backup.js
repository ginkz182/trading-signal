/**
 * Fast SignalCalculator - Uses persistent services but manages memory
 */
const NotificationService = require("../services/notification.service");
const { formatSignals } = require("../utils/formatters");
const ExchangeFactory = require("../services/data/ExchangeFactory");
const IndicatorManager = require("../managers/indicator.manager");

class SignalCalculator {
  constructor(config = {}) {
    // ✅ BACK TO: Persistent services for speed
    this.exchangeServices = this._initializeExchanges(config);

    this.notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      subscriberConfig: {
        databaseUrl: process.env.DATABASE_URL,
      },
    });

    // ✅ KEEP: Single indicator manager
    this.indicatorManager = new IndicatorManager({
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
    });

    this.tradingPairs = {
      crypto: config.symbols || [],
      stocks: config.stockSymbols || [],
    };

    // Memory monitoring
    this.scanCount = 0;
  }

  _initializeExchanges(config) {
    const exchangeFactory = new ExchangeFactory();

    return {
      crypto: exchangeFactory.createExchange("kucoin", config.timeframe),
      stocks: exchangeFactory.createExchange("yahoo", config.timeframe),
    };
  }

  /**
   * Monitor memory usage
   */
  _logMemoryUsage(context = "") {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    console.log(
      `[MEMORY${context ? " " + context : ""}] Heap: ${heapUsedMB}MB`
    );

    // Force GC every 5 scans if available
    if (global.gc && this.scanCount % 5 === 0) {
      global.gc();
      const afterGC = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(`[MEMORY AFTER GC] Heap: ${afterGC}MB`);
    }
  }

  _isInStockTradingHours() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    return utcHour >= 13 && utcHour <= 22;
  }

  /**
   * 🚨 OPTIMIZED: Limit data more aggressively
   */
  _prepareMarketData(marketType, allPrices) {
    // Even more aggressive memory limits
    const MAX_PRICES = 50; // Reduced from 100

    let workingPrices = allPrices;
    if (allPrices.length > MAX_PRICES) {
      workingPrices = allPrices.slice(-MAX_PRICES);
      console.log(
        `[MEMORY] ${marketType}: Trimmed data from ${allPrices.length} to ${MAX_PRICES}`
      );
    }

    if (marketType === "crypto") {
      const prices = workingPrices.slice(0, -1);
      const latestPrice = workingPrices[workingPrices.length - 1];
      return { prices, latestPrice, dataSource: "previous_day_crypto" };
    } else {
      const inTradingHours = this._isInStockTradingHours();
      if (inTradingHours) {
        const prices = workingPrices.slice(0, -1);
        const latestPrice = workingPrices[workingPrices.length - 1];
        return {
          prices,
          latestPrice,
          dataSource: "previous_day_stock_trading_hours",
        };
      } else {
        const prices = workingPrices;
        const latestPrice = workingPrices[workingPrices.length - 1];
        return {
          prices,
          latestPrice,
          dataSource: "complete_stock_data_market_closed",
        };
      }
    }
  }

  /**
   * ✅ FAST: Uses persistent services (no recreation)
   */
  async _processTradingPair(symbol, marketType) {
    try {
      const exchangeService = this.exchangeServices[marketType];
      const allPrices = await exchangeService.getPrices(symbol);

      if (!allPrices || allPrices.length < 28) {
        console.log(
          `Insufficient data for ${symbol}, need at least 28 data points`
        );
        return null;
      }

      const { prices, latestPrice, dataSource } = this._prepareMarketData(
        marketType,
        allPrices
      );

      console.log(
        `Processing ${symbol} (${marketType}) with ${dataSource} (${prices.length} points)`
      );

      const signalData = this.indicatorManager.analyzePrice(prices, symbol);

      if (!signalData || typeof signalData !== "object") {
        console.error(
          `Invalid signal data returned for ${marketType} ${symbol}`
        );
        return null;
      }

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
          dataSource,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error processing ${marketType} ${symbol}:`, error);
      return null;
    }
  }

  async checkSignals() {
    this.scanCount++;
    this._logMemoryUsage("SCAN_START");

    const signals = { crypto: {}, stocks: {} };

    console.log(`Checking signals (scan #${this.scanCount})`);

    // Process crypto pairs
    for (const symbol of this.tradingPairs.crypto) {
      const signalData = await this._processTradingPair(symbol, "crypto");
      if (signalData) {
        signals.crypto[symbol] = signalData;
      }
    }

    // Process stock pairs
    for (const symbol of this.tradingPairs.stocks) {
      const signalData = await this._processTradingPair(symbol, "stocks");
      if (signalData) {
        signals.stocks[symbol] = signalData;
      }
    }

    // 🚨 NEW: Clear service caches after each scan
    this.exchangeServices.crypto.clearCache();
    this.exchangeServices.stocks.clearCache();

    this._logMemoryUsage("SCAN_END");
    return signals;
  }

  async scan(options = {}) {
    const { sendNotification = true } = options;

    console.log("Starting signal scan...");
    this._logMemoryUsage("SCAN_INIT");

    try {
      const signals = await this.checkSignals();
      const hasSignals =
        Object.keys(signals.crypto).length > 0 ||
        Object.keys(signals.stocks).length > 0;

      if (hasSignals) {
        const message = formatSignals(signals, { signalSource: "YESTERDAY" });

        console.log("Formatted message (YESTERDAY):");
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
    } finally {
      // Force cleanup after scan
      if (global.gc && this.scanCount % 3 === 0) {
        global.gc();
        this._logMemoryUsage("AFTER_FORCED_GC");
      }
    }
  }

  /**
   * Cleanup when shutting down
   */
  cleanup() {
    console.log("[MEMORY] SignalCalculator cleanup");
    if (this.exchangeServices.crypto) this.exchangeServices.crypto.cleanup();
    if (this.exchangeServices.stocks) this.exchangeServices.stocks.cleanup();
  }
}

module.exports = SignalCalculator;
