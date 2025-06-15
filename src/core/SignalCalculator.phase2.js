/**
 * SignalCalculator - Updated with memory monitoring
 * This is your existing code with minimal changes for Phase 2
 */
const NotificationService = require("../services/notification.service");
const { formatSignals } = require("../utils/formatters");
const ExchangeFactory = require("../services/data/ExchangeFactory"); // Updated path
const IndicatorManager = require("../managers/indicator.manager");
const MemoryMonitor = require("../utils/memory-monitor"); // NEW
const config = require("../config"); // NEW

class SignalCalculator {
  constructor(configOverride = {}) {
    // Merge with centralized config
    const finalConfig = { ...config, ...configOverride };

    // Initialize exchange services (keeping your existing pattern for now)
    this.exchangeServices = this._initializeExchanges(finalConfig);

    // Your existing notification service
    this.notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      subscriberConfig: {
        databaseUrl: process.env.DATABASE_URL,
      },
    });

    // Your existing indicator manager
    this.indicatorManager = new IndicatorManager({
      fastPeriod: finalConfig.fastPeriod || 12,
      slowPeriod: finalConfig.slowPeriod || 26,
    });

    // Your existing trading pairs
    this.tradingPairs = {
      crypto: finalConfig.symbols || [],
      stocks: finalConfig.stockSymbols || [],
    };

    // NEW: Add memory monitoring
    this.memoryMonitor = new MemoryMonitor();
    this.scanCount = 0;

    console.log(
      `[CALCULATOR] Initialized with ${this.tradingPairs.crypto.length} crypto + ${this.tradingPairs.stocks.length} stock pairs`
    );
  }

  // Keep ALL your existing methods exactly the same, just add memory monitoring
  _initializeExchanges(config) {
    // Your existing code
    const exchangeFactory = new ExchangeFactory();
    return {
      crypto: exchangeFactory.createExchange("kucoin", config.timeframe),
      stocks: exchangeFactory.createExchange("yahoo", config.timeframe),
    };
  }

  _isInStockTradingHours() {
    // Your existing code - no changes
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    return utcHour >= 13 && utcHour <= 22;
  }

  _prepareMarketData(marketType, allPrices) {
    // Your existing code - no changes for Phase 2
    if (marketType === "crypto") {
      const prices = allPrices.slice(0, -1);
      const latestPrice = allPrices[allPrices.length - 1];
      return { prices, latestPrice, dataSource: "previous_day_crypto" };
    } else {
      const inTradingHours = this._isInStockTradingHours();
      if (inTradingHours) {
        const prices = allPrices.slice(0, -1);
        const latestPrice = allPrices[allPrices.length - 1];
        return {
          prices,
          latestPrice,
          dataSource: "previous_day_stock_trading_hours",
        };
      } else {
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

  async _processTradingPair(symbol, marketType) {
    // Your existing code - no changes for Phase 2
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
    // Add memory monitoring to your existing method
    this.scanCount++;
    this.memoryMonitor.takeSnapshot(`SCAN_${this.scanCount}_START`);

    const signals = { crypto: {}, stocks: {} };
    console.log(`Checking signals (scan #${this.scanCount})`);

    // Your existing crypto processing
    for (const symbol of this.tradingPairs.crypto) {
      const signalData = await this._processTradingPair(symbol, "crypto");
      if (signalData) {
        signals.crypto[symbol] = signalData;
      }
    }

    // Your existing stock processing
    for (const symbol of this.tradingPairs.stocks) {
      const signalData = await this._processTradingPair(symbol, "stocks");
      if (signalData) {
        signals.stocks[symbol] = signalData;
      }
    }

    this.memoryMonitor.takeSnapshot(`SCAN_${this.scanCount}_END`);

    // NEW: Trigger GC if memory is high
    if (this.memoryMonitor.shouldTriggerGC(100)) {
      this.memoryMonitor.forceGarbageCollection();
    }

    return signals;
  }

  async scan(options = {}) {
    // Your existing scan method with memory monitoring
    const { sendNotification = true } = options;

    console.log("Starting signal scan...");
    this.memoryMonitor.takeSnapshot("SCAN_INIT");

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
      this.memoryMonitor.takeSnapshot("SCAN_COMPLETE");
    }
  }

  // NEW: Add cleanup method
  async cleanup() {
    console.log("[CALCULATOR] Starting cleanup");

    if (this.exchangeServices.crypto && this.exchangeServices.crypto.destroy) {
      await this.exchangeServices.crypto.destroy();
    }
    if (this.exchangeServices.stocks && this.exchangeServices.stocks.destroy) {
      await this.exchangeServices.stocks.destroy();
    }

    console.log("[CALCULATOR] Cleanup complete");
  }

  // NEW: Get memory analysis
  getMemoryAnalysis() {
    return this.memoryMonitor.getAnalysis();
  }
}

module.exports = SignalCalculator;
