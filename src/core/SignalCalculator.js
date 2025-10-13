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
      enablePatterns: this.config.patterns?.enabled !== false,
      patternMinBars: this.config.patterns?.minBars || 20,
      patternMaxBars: this.config.patterns?.maxBars || 100,
      patternTolerance: this.config.patterns?.tolerance || 0.02,
      patternMinTouchPoints: this.config.patterns?.minTouchPoints || 3,
      patternVolumeConfirmation:
        this.config.patterns?.volumeConfirmation !== false,
      patternBreakoutThreshold:
        this.config.patterns?.breakoutThreshold || 0.015,
      patternVolumeBreakoutMultiplier:
        this.config.patterns?.volumeBreakoutMultiplier || 1.5,
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
      // Get service from poolAdd commentMore actions
      const serviceType = marketType === "crypto" ? "kucoin" : "yahoo";
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

      // Analyze with processed data (including OHLCV for pattern detection)
      const signalData = this.indicatorManager.analyzePrice(
        processedData,
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
          pattern: signalData.pattern, // Include pattern information
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

    const allSignals = [];
    console.log(`[CALCULATOR] Starting scan #${this.scanCount}`);

    // Process crypto pairs - detect all signal types
    for (const symbol of this.tradingPairs.crypto) {
      const signals = await this._detectAllSignals(symbol, "crypto");
      allSignals.push(...signals);
    }

    // Process stock pairs - detect all signal types
    for (const symbol of this.tradingPairs.stocks) {
      const signals = await this._detectAllSignals(symbol, "stocks");
      allSignals.push(...signals);
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

    return allSignals;
  }

  /**
   * Detect all signal types for a single trading pair
   * Returns array of detected signals with unified format
   */
  async _detectAllSignals(symbol, marketType) {
    const signals = [];

    try {
      // Get service and fetch data
      const serviceType = marketType === "crypto" ? "kucoin" : "yahoo";
      const exchangeService = await this.servicePool.getService(
        serviceType,
        this.config.timeframe
      );

      const rawPrices = await exchangeService.getPrices(symbol);
      if (!rawPrices) {
        console.log(`[CALCULATOR] No data returned for ${symbol}`);
        return signals;
      }

      // Process data
      const processedData = this.dataProcessor.prepareForAnalysis(
        rawPrices,
        marketType,
        symbol
      );
      if (!processedData) {
        return signals;
      }

      console.log(
        `[CALCULATOR] ${symbol} (${marketType}) - ${processedData.dataSource} (${processedData.processedLength}/${processedData.originalLength} points)`
      );

      // Get analysis from indicator manager
      const analysis = this.indicatorManager.analyzePrice(
        processedData,
        symbol
      );

      // 1. CDC Action Zone Signal (EMA Crossover)
      if (analysis.signal && analysis.signal !== "HOLD") {
        signals.push({
          type: "CDC_ACTION_ZONE",
          signal: analysis.signal,
          symbol,
          marketType,
          price: processedData.latestPrice,
          confidence: 85, // High confidence for confirmed crossovers
          details: {
            fastEMA: analysis.fastEMA,
            slowEMA: analysis.slowEMA,
            isBull: analysis.isBull,
            isBear: analysis.isBear,
            previousDayPrice:
              processedData.prices[processedData.prices.length - 1],
          },
          dataSource: processedData.dataSource,
          dataStats: {
            original: processedData.originalLength,
            processed: processedData.processedLength,
          },
          timestamp: new Date(),
        });
      }

      // 2. Pattern Signal (Triangles, H&S, etc.)
      if (analysis.pattern && analysis.pattern.pattern) {
        const patternSignal = this._determinePatternSignal(analysis.pattern);
        if (patternSignal !== "HOLD") {
          signals.push({
            type: "PATTERN_ALERT",
            signal: patternSignal,
            symbol,
            marketType,
            price: processedData.latestPrice,
            confidence: analysis.pattern.confidence,
            details: {
              patternType: analysis.pattern.pattern,
              direction: analysis.pattern.direction,
              breakoutStatus: analysis.pattern.breakout?.status || "FORMING",
              breakout: analysis.pattern.breakout, // Full breakout data
              tradingPlan: analysis.pattern.tradingPlan,
              reliability: analysis.pattern.reliability,
            },
            dataSource: processedData.dataSource,
            dataStats: {
              original: processedData.originalLength,
              processed: processedData.processedLength,
            },
            timestamp: new Date(),
          });
        }
      }

      // 3. Future signal types can be added here:
      // - EMA50 Trend Signal
      // - RSI Overbought/Oversold
      // - MACD Signal
      // - etc.
    } catch (error) {
      console.error(
        `[CALCULATOR] Error detecting signals for ${marketType} ${symbol}:`,
        error
      );
    }

    return signals;
  }

  /**
   * Determine signal from pattern analysis
   * Takes into account pattern type and expected direction
   */
  _determinePatternSignal(patternAnalysis) {
    const { breakout, direction } = patternAnalysis;

    // Breakout signals - must match pattern's expected direction
    if (breakout?.status === "BREAKOUT_UP") {
      // Ascending Triangle or Symmetrical Triangle breaking up = Valid bullish breakout
      if (direction === "BULLISH" || direction === "NEUTRAL") {
        return "BUY";
      } else {
        // Descending Triangle breaking up = False breakout, still watch
        return "WATCH";
      }
    } else if (breakout?.status === "BREAKOUT_DOWN") {
      // Descending Triangle or Symmetrical Triangle breaking down = Valid bearish breakout
      if (direction === "BEARISH" || direction === "NEUTRAL") {
        return "SELL";
      } else {
        // Ascending Triangle breaking down = False breakout, still watch
        return "WATCH";
      }
    } else if (
      breakout?.status === "APPROACHING_RESISTANCE" ||
      breakout?.status === "APPROACHING_SUPPORT"
    ) {
      return "WATCH"; // Special signal for approaching breakout
    }

    return "HOLD"; // Pattern forming but no actionable signal yet
  }

  /**
   * Format signals by type into appropriate notification messages
   */
  _formatSignalsByType(signalType, signals) {
    const dayjs = require("dayjs");

    if (signalType === "CDC_ACTION_ZONE") {
      return this._formatCDCActionZoneSignals(signals);
    } else if (signalType === "PATTERN_ALERT") {
      return this._formatPatternSignals(signals);
    }

    // Default formatting for future signal types
    return this._formatGenericSignals(signalType, signals);
  }

  /**
   * Format CDC Action Zone (EMA Crossover) signals
   */
  _formatCDCActionZoneSignals(signals) {
    const dayjs = require("dayjs");
    const { formatPrice, formatSignalEmoji } = require("../utils/formatters");

    let message = `🔔<b> CDC ACTION ZONE ALERT</b> 🔔\n🗓️ ${dayjs().format(
      "D MMM"
    )}\n`;
    message += `📊 Confirmed EMA12/26 Crossover Signals\n\n`;

    // Group by market type
    const cryptoSignals = signals.filter((s) => s.marketType === "crypto");
    const stockSignals = signals.filter((s) => s.marketType === "stocks");

    if (cryptoSignals.length > 0) {
      message += "💰<b> CRYPTO</b>\n";
      cryptoSignals.forEach((signal) => {
        const price = formatPrice(signal.price, "crypto");
        message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${
          signal.signal
        } @ ${price}\n`;
      });
      message += "\n";
    }

    if (stockSignals.length > 0) {
      message += "📈<b> STOCKS</b>\n";
      stockSignals.forEach((signal) => {
        const price = formatPrice(signal.price, "stock");
        message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${
          signal.signal
        } @ ${price}\n`;
      });
    }

    return message;
  }

  /**
   * Format Pattern Alert signals with professional trading information
   */
  _formatPatternSignals(signals) {
    const dayjs = require("dayjs");

    let message = `🔺<b> PATTERN ALERT</b> 🔺\n🗓️ ${dayjs().format("D MMM")}\n`;
    message += `📊 Triangle Pattern Breakouts & Formations\n\n`;

    // Group by market type
    const cryptoSignals = signals.filter((s) => s.marketType === "crypto");
    const stockSignals = signals.filter((s) => s.marketType === "stocks");

    if (cryptoSignals.length > 0) {
      message += "💰<b> CRYPTO</b>\n";
      cryptoSignals.forEach((signal) => {
        message += this._formatSinglePatternSignal(signal, "crypto");
      });
    }

    if (stockSignals.length > 0) {
      message += "📈<b> STOCKS</b>\n";
      stockSignals.forEach((signal) => {
        message += this._formatSinglePatternSignal(signal, "stock");
      });
    }

    return message;
  }

  /**
   * Format a single pattern signal with professional trading levels
   */
  _formatSinglePatternSignal(signal, marketType) {
    const {
      formatPrice,
      getPatternEmoji,
      formatSignalEmoji,
      formatPatternName,
      getConfidenceEmoji,
    } = require("../utils/formatters");

    const patternEmoji = getPatternEmoji(signal.details.patternType);
    const confidenceEmoji = getConfidenceEmoji(signal.confidence);
    const patternName = formatPatternName(signal.details.patternType);
    const plan = signal.details.tradingPlan;
    const breakout = signal.details.breakout;

    let msg = "";

    // === BUY/SELL SIGNALS (Confirmed Breakouts) ===
    if (signal.signal === "BUY") {
      const entry = formatPrice(breakout.upperBreakout, marketType);
      const target1 = formatPrice(plan.entry.long.target1, marketType);
      const target2 = formatPrice(plan.entry.long.target2, marketType);
      const stopLoss = formatPrice(plan.entry.long.stopLoss, marketType);
      const rrRatio = plan.entry.long.riskReward.toFixed(1);

      msg += `${formatSignalEmoji(signal.signal)} <b>${signal.symbol}: BUY Signal</b>\n`;
      msg += `  ${patternEmoji} ${patternName} (${signal.confidence}%${confidenceEmoji})\n`;
      msg += `  🚀 Bullish breakout confirmed above ${entry}\n`;
      msg += `  🎯 Target 1: ${target1}\n`;
      msg += `  🎯 Target 2: ${target2}\n`;
      msg += `  🛑 Stop Loss: ${stopLoss}\n`;
      msg += `  📊 Risk/Reward: 1:${rrRatio}\n\n`;

    } else if (signal.signal === "SELL") {
      const entry = formatPrice(breakout.lowerBreakout, marketType);
      const target1 = formatPrice(plan.entry.short.target1, marketType);
      const target2 = formatPrice(plan.entry.short.target2, marketType);
      const stopLoss = formatPrice(plan.entry.short.stopLoss, marketType);
      const rrRatio = plan.entry.short.riskReward.toFixed(1);

      msg += `${formatSignalEmoji(signal.signal)} <b>${signal.symbol}: SELL Signal</b>\n`;
      msg += `  ${patternEmoji} ${patternName} (${signal.confidence}%${confidenceEmoji})\n`;
      msg += `  💥 Bearish breakout confirmed below ${entry}\n`;
      msg += `  🎯 Target 1: ${target1}\n`;
      msg += `  🎯 Target 2: ${target2}\n`;
      msg += `  🛑 Stop Loss: ${stopLoss}\n`;
      msg += `  📊 Risk/Reward: 1:${rrRatio}\n\n`;

    // === WATCH SIGNALS ===
    } else if (signal.signal === "WATCH") {
      const currentPrice = formatPrice(breakout.currentPrice, marketType);
      const resistance = formatPrice(breakout.upperBreakout, marketType);
      const support = formatPrice(breakout.lowerBreakout, marketType);
      const distUp = Math.abs(breakout.distanceToUpper).toFixed(1);
      const distDown = Math.abs(breakout.distanceToLower).toFixed(1);

      msg += `${formatSignalEmoji(signal.signal)} <b>${signal.symbol}: WATCH</b>\n`;
      msg += `  ${patternEmoji} ${patternName} (${signal.confidence}%${confidenceEmoji})\n`;

      // False breakout (pattern broke wrong direction)
      if (signal.details.breakoutStatus === "BREAKOUT_UP" && signal.details.direction === "BEARISH") {
        msg += `  ⚠️ False upward breakout on bearish pattern\n`;
        msg += `  📍 Watch for reversal below ${support}\n`;
        msg += `  🎯 If breaks down: Target ${formatPrice(plan.entry.short.target1, marketType)}\n\n`;

      } else if (signal.details.breakoutStatus === "BREAKOUT_DOWN" && signal.details.direction === "BULLISH") {
        msg += `  ⚠️ False downward breakout on bullish pattern\n`;
        msg += `  📍 Watch for reversal above ${resistance}\n`;
        msg += `  🎯 If breaks up: Target ${formatPrice(plan.entry.long.target1, marketType)}\n\n`;

      // Approaching breakout
      } else if (signal.details.breakoutStatus === "APPROACHING_RESISTANCE") {
        msg += `  👀 Approaching resistance breakout\n`;
        msg += `  📍 Current: ${currentPrice}\n`;
        msg += `  ⬆️ Resistance: ${resistance} (+${distUp}% away)\n`;
        msg += `  🎯 Breakout target: ${formatPrice(plan.entry.long.target1, marketType)}\n\n`;

      } else if (signal.details.breakoutStatus === "APPROACHING_SUPPORT") {
        msg += `  👀 Approaching support breakdown\n`;
        msg += `  📍 Current: ${currentPrice}\n`;
        msg += `  ⬇️ Support: ${support} (-${distDown}% away)\n`;
        msg += `  🎯 Breakdown target: ${formatPrice(plan.entry.short.target1, marketType)}\n\n`;
      }
    }

    return msg;
  }

  /**
   * Generic formatter for future signal types
   */
  _formatGenericSignals(signalType, signals) {
    const dayjs = require("dayjs");
    const { formatPrice, formatSignalEmoji } = require("../utils/formatters");

    let message = `🚨<b> ${signalType.replace(
      /_/g,
      " "
    )} ALERT</b> 🚨\n🗓️ ${dayjs().format("D MMM")}\n\n`;

    signals.forEach((signal) => {
      const price = formatPrice(
        signal.price,
        signal.marketType === "crypto" ? "crypto" : "stock"
      );
      message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${
        signal.signal
      } @ ${price}\n`;
      if (signal.confidence) {
        message += `  📊 Confidence: ${signal.confidence}%\n`;
      }
      message += `\n`;
    });

    return message;
  }

  async scan(options = {}) {
    const { sendNotification = true } = options;

    console.log("[CALCULATOR] Starting optimized signal scan...");
    this.memoryMonitor.takeSnapshot("SCAN_INIT");

    try {
      const allSignals = await this.checkSignals();

      if (allSignals.length > 0) {
        console.log("[CALCULATOR] Signals found:");

        // Group signals by type for logging
        const signalsByType = allSignals.reduce((acc, signal) => {
          acc[signal.type] = acc[signal.type] || [];
          acc[signal.type].push(signal);
          return acc;
        }, {});

        Object.entries(signalsByType).forEach(([type, signals]) => {
          console.log(`- ${type}: ${signals.length} signals`);
        });

        // Send separate notifications for each signal type
        const notifications = [];
        for (const [signalType, signals] of Object.entries(signalsByType)) {
          const message = this._formatSignalsByType(signalType, signals);
          console.log(`\n[${signalType}] Message:`);
          console.log(message);

          if (sendNotification) {
            await this.notificationService.sendToTelegram(message);
            console.log(`[CALCULATOR] ${signalType} notification sent`);
          }

          notifications.push({
            type: signalType,
            message,
            count: signals.length,
          });
        }

        return { signals: allSignals, notifications };
      } else {
        console.log("[CALCULATOR] No signals found");
        return { signals: allSignals, notifications: [] };
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
