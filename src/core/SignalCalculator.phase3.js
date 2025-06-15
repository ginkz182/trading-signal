/**
 * SignalCalculator - Updated with Service Pool (Phase 3)
 */
const NotificationService = require("../services/notification.service");
const { formatSignals } = require("../utils/formatters");
const ExchangeServicePool = require("../services/data/ExchangeServicePool"); // NEW: Updated import
const IndicatorManager = require("../managers/indicator.manager");
const MemoryMonitor = require("../utils/memory-monitor");
const config = require("../config");

class SignalCalculator {
  constructor(configOverride = {}) {
    // Merge with centralized config
    this.config = { ...config, ...configOverride };

    // NEW: Initialize service pool instead of individual services
    this.servicePool = new ExchangeServicePool();

    // Your existing notification service
    this.notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      subscriberConfig: {
        databaseUrl: process.env.DATABASE_URL,
      },
    });

    // Your existing indicator manager
    this.indicatorManager = new IndicatorManager({
      fastPeriod: this.config.fastPeriod || 12,
      slowPeriod: this.config.slowPeriod || 26,
    });

    // Your existing trading pairs
    this.tradingPairs = {
      crypto: this.config.symbols || [],
      stocks: this.config.stockSymbols || [],
    };

    // Memory monitoring
    this.memoryMonitor = new MemoryMonitor();
    this.scanCount = 0;

    console.log(
      `[CALCULATOR] Initialized with service pool - ${this.tradingPairs.crypto.length} crypto + ${this.tradingPairs.stocks.length} stock pairs`
    );
  }

  // REMOVE: Delete _initializeExchanges method completely
  // We don't need it anymore since we're using the service pool

  // Keep your existing methods unchanged
  _isInStockTradingHours() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    return utcHour >= 13 && utcHour <= 22;
  }

  _prepareMarketData(marketType, allPrices) {
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

  // UPDATED: Use service pool instead of pre-created services
  async _processTradingPair(symbol, marketType) {
    try {
      // NEW: Get service from pool instead of using this.exchangeServices
      const serviceType = marketType === "crypto" ? "kucoin" : "yahoo";
      const exchangeService = await this.servicePool.getService(
        serviceType,
        this.config.timeframe
      );

      // Rest of your existing code stays the same
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

  // Keep your existing checkSignals method unchanged
  async checkSignals() {
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

    // Trigger GC if memory is high
    if (this.memoryMonitor.shouldTriggerGC(100)) {
      this.memoryMonitor.forceGarbageCollection();
    }

    return signals;
  }

  // Keep your existing scan method unchanged
  async scan(options = {}) {
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

  // UPDATED: Use service pool cleanup
  async cleanup() {
    console.log("[CALCULATOR] Starting cleanup");

    if (this.servicePool) {
      await this.servicePool.cleanup();
    }

    console.log("[CALCULATOR] Cleanup complete");
  }

  // UPDATED: Include service pool stats
  getMemoryAnalysis() {
    return {
      memory: this.memoryMonitor.getAnalysis(),
      servicePool: this.servicePool ? this.servicePool.getStats() : null,
      scanCount: this.scanCount,
      config: {
        cryptoPairs: this.tradingPairs.crypto.length,
        stockPairs: this.tradingPairs.stocks.length,
        timeframe: this.config.timeframe,
      },
    };
  }

  // NEW: Helper method to restart services if needed
  async restartServices() {
    console.log("[CALCULATOR] Restarting all services");
    if (this.servicePool) {
      await this.servicePool.cleanup();
    }
    console.log("[CALCULATOR] Services will be recreated on next scan");
  }
}

module.exports = SignalCalculator;
