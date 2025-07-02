/**
 * SignalCalculator - Final optimized version (Phase 4)
 */
const NotificationService = require("../services/notification.service");
const { formatSignals } = require("../utils/formatters");
const ExchangeServicePool = require("../services/data/ExchangeServicePool");
const IndicatorManager = require("../managers/indicator.manager");
const MemoryMonitor = require("../utils/memory-monitor");
const MarketDataProcessor = require("./MarketDataProcessor"); // NEW
const config = require("../config");

class SignalCalculator {
  constructor(configOverride = {}) {
    this.config = { ...config, ...configOverride };

    // Initialize core components
    this.servicePool = new ExchangeServicePool();
    this.dataProcessor = new MarketDataProcessor(this.config); // NEW
    this.memoryMonitor = new MemoryMonitor();

    // Initialize business logic components
    this.notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      subscriberConfig: {
        databaseUrl: process.env.DATABASE_URL,
      },
    });

    this.indicatorManager = new IndicatorManager({
      fastPeriod: this.config.fastPeriod || 12,
      slowPeriod: this.config.slowPeriod || 26,
    });

    this.tradingPairs = {
      crypto: this.config.symbols || [],
      stocks: this.config.stockSymbols || [],
    };

    this.scanCount = 0;

    console.log(
      `[CALCULATOR] Fully optimized - ${this.tradingPairs.crypto.length} crypto + ${this.tradingPairs.stocks.length} stock pairs`
    );
  }

  // REMOVE: Delete _isInStockTradingHours and _prepareMarketData methods
  // These are now handled by MarketDataProcessor

  // UPDATED: Simplified _processTradingPair using data processor
  async _processTradingPair(symbol, marketType) {
    try {
      // Get service from pool - use Polygon for both crypto and stocks
      const serviceType = "polygon";
      const exchangeService = await this.servicePool.getService(
        serviceType,
        this.config.timeframe
      );

      // Fetch raw data
      const rawPrices = await exchangeService.getPrices(symbol);
      if (!rawPrices) {
        console.log(`[CALCULATOR] No data returned for ${symbol}`);
        return null;
      }

      // NEW: Use data processor instead of manual data preparation
      const processedData = this.dataProcessor.prepareForAnalysis(
        rawPrices,
        marketType,
        symbol
      );
      if (!processedData) {
        return null;
      }

      console.log(
        `[CALCULATOR] ${symbol} (${marketType}) - ${processedData.dataSource} (${processedData.processedLength}/${processedData.originalLength} points)`
      );

      // Analyze with processed data
      const signalData = this.indicatorManager.analyzePrice(
        processedData.prices,
        symbol
      );

      if (!signalData || typeof signalData !== "object") {
        console.error(
          `[CALCULATOR] Invalid signal data returned for ${marketType} ${symbol}`
        );
        return null;
      }

      if (signalData.signal && signalData.signal !== "HOLD") {
        return {
          signal: signalData.signal,
          price: processedData.latestPrice,
          previousDayPrice:
            processedData.prices[processedData.prices.length - 1],
          fastEMA: signalData.fastEMA,
          slowEMA: signalData.slowEMA,
          isBull: signalData.isBull,
          isBear: signalData.isBear,
          details: signalData.details,
          dataSource: processedData.dataSource,
          dataStats: {
            original: processedData.originalLength,
            processed: processedData.processedLength,
          },
        };
      }

      return null;
    } catch (error) {
      console.error(
        `[CALCULATOR] Error processing ${marketType} ${symbol}:`,
        error
      );
      return null;
    }
  }

  async checkSignals() {
    this.scanCount++;
    this.memoryMonitor.takeSnapshot(`SCAN_${this.scanCount}_START`);

    const signals = { crypto: {}, stocks: {} };
    console.log(`[CALCULATOR] Starting scan #${this.scanCount}`);

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

    this.memoryMonitor.takeSnapshot(`SCAN_${this.scanCount}_END`);

    // Clear service caches after each scan to prevent memory buildup
    await this.servicePool.clearAllCaches();

    // Trigger GC if memory is high
    if (this.memoryMonitor.shouldTriggerGC(80)) {
      // Lowered threshold
      this.memoryMonitor.forceGarbageCollection();
    }

    // Log processing statistics
    const processingStats = this.dataProcessor.getStats();
    console.log(
      `[CALCULATOR] Scan #${this.scanCount} complete - Processing stats:`,
      processingStats
    );

    return signals;
  }

  async scan(options = {}) {
    const { sendNotification = true } = options;

    console.log("[CALCULATOR] Starting optimized signal scan...");
    this.memoryMonitor.takeSnapshot("SCAN_INIT");

    try {
      const signals = await this.checkSignals();
      const hasSignals =
        Object.keys(signals.crypto).length > 0 ||
        Object.keys(signals.stocks).length > 0;

      if (hasSignals) {
        const message = formatSignals(signals, {
          signalSource: "YESTERDAY",
        });

        console.log("[CALCULATOR] Signals found:");
        console.log(`- Crypto signals: ${Object.keys(signals.crypto).length}`);
        console.log(`- Stock signals: ${Object.keys(signals.stocks).length}`);

        console.log(message);

        if (sendNotification) {
          await this.notificationService.sendToTelegram(message);
          console.log("[CALCULATOR] Notification sent");
        } else {
          console.log("[CALCULATOR] Notification sending skipped");
        }

        return { signals, message };
      } else {
        console.log("[CALCULATOR] No signals found");
        return { signals, message: null };
      }
    } finally {
      this.memoryMonitor.takeSnapshot("SCAN_COMPLETE");
    }
  }

  async cleanup() {
    console.log("[CALCULATOR] Starting comprehensive cleanup");

    if (this.servicePool) {
      await this.servicePool.cleanup();
    }

    if (this.dataProcessor) {
      this.dataProcessor.resetStats();
    }

    console.log("[CALCULATOR] Cleanup complete");
  }

  // ENHANCED: More comprehensive analysis
  getMemoryAnalysis() {
    return {
      memory: this.memoryMonitor.getAnalysis(),
      servicePool: this.servicePool ? this.servicePool.getStats() : null,
      dataProcessing: this.dataProcessor ? this.dataProcessor.getStats() : null,
      scanCount: this.scanCount,
      config: {
        cryptoPairs: this.tradingPairs.crypto.length,
        stockPairs: this.tradingPairs.stocks.length,
        timeframe: this.config.timeframe,
        dataLimits: this.dataProcessor ? this.dataProcessor.limits : null,
      },
    };
  }

  async restartServices() {
    console.log("[CALCULATOR] Restarting all services and resetting stats");

    if (this.servicePool) {
      await this.servicePool.cleanup();
    }

    if (this.dataProcessor) {
      this.dataProcessor.resetStats();
    }

    console.log("[CALCULATOR] Services and stats reset - ready for next scan");
  }
}

module.exports = SignalCalculator;
