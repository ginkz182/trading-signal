/**
 * IndicatorManager - Manages technical indicators and signal analysis
 * Updated with CDC Action Zone implementation
 */
const TechnicalService = require("../services/technical.service");

class IndicatorManager {
  constructor(config = {}) {
    this.technicalService = new TechnicalService();

    // Default CDC Action Zone settings
    this.cdcConfig = {
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
      smooth: config.smooth || 1,
    };

    // Define available indicators - can be expanded later
    this.indicators = {
      macd: {
        calculate: this._calculateMACDSignal.bind(this),
        enabled: true,
      },
      cdcActionZone: {
        calculate: this._calculateCDCActionZone.bind(this),
        enabled: true,
      },
      // Additional indicators can be added here
    };
  }

  /**
   * Calculate MACD signal based on price data
   * @param {Array} prices - Price data array
   * @returns {Object} - Signal information
   */
  _calculateMACDSignal(prices) {
    const macdValues = this.technicalService.calculateMACD(prices);
    const signal = this.technicalService.checkZeroCross(macdValues);

    return {
      signal,
      macd: macdValues[macdValues.length - 1].MACD,
    };
  }

  /**
   * Calculate CDC Action Zone signals based on the Trading View indicator
   * @param {Array} prices - Price data array
   * @returns {Object} - Signal information with CDC zones
   */
  _calculateCDCActionZone(prices) {
    if (prices.length < Math.max(this.cdcConfig.slowPeriod + 2, 30)) {
      console.log(
        `Insufficient data for CDC Action Zone. Need at least ${Math.max(
          this.cdcConfig.slowPeriod + 2,
          30
        )} data points.`
      );
      return { signal: "HOLD", zone: "UNKNOWN" };
    }

    // Calculate EMAs
    const fastEMA = this._calculateEMA(prices, this.cdcConfig.fastPeriod);
    const slowEMA = this._calculateEMA(prices, this.cdcConfig.slowPeriod);

    // Need at least 2 points to check for crossovers
    if (fastEMA.length < 2 || slowEMA.length < 2) {
      return { signal: "HOLD", zone: "UNKNOWN" };
    }

    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2];

    const currentFastEMA = fastEMA[fastEMA.length - 1];
    const previousFastEMA = fastEMA[fastEMA.length - 2];

    const currentSlowEMA = slowEMA[slowEMA.length - 1];
    const previousSlowEMA = slowEMA[slowEMA.length - 2];

    // Determine bull/bear state
    const isBull = currentFastEMA > currentSlowEMA;
    const isBear = currentFastEMA < currentSlowEMA;

    const wasBull = previousFastEMA > previousSlowEMA;
    const wasBear = previousFastEMA < previousSlowEMA;

    // Determine CDC Action Zone color
    let zone = "UNKNOWN";
    if (isBull && currentPrice > currentFastEMA) {
      zone = "GREEN"; // Buy
    } else if (
      isBear &&
      currentPrice > currentFastEMA &&
      currentPrice > currentSlowEMA
    ) {
      zone = "BLUE"; // Pre Buy 2
    } else if (
      isBear &&
      currentPrice > currentFastEMA &&
      currentPrice < currentSlowEMA
    ) {
      zone = "LIGHT_BLUE"; // Pre Buy 1
    } else if (isBear && currentPrice < currentFastEMA) {
      zone = "RED"; // Sell
    } else if (
      isBull &&
      currentPrice < currentFastEMA &&
      currentPrice < currentSlowEMA
    ) {
      zone = "ORANGE"; // Pre Sell 2
    } else if (
      isBull &&
      currentPrice < currentFastEMA &&
      currentPrice > currentSlowEMA
    ) {
      zone = "YELLOW"; // Pre Sell 1
    }

    // Determine buy/sell signals exactly like the Pine Script
    // buycond = Green and Green[1] == 0
    // sellcond = Red and Red[1] == 0
    const isGreen = isBull && currentPrice > currentFastEMA;
    const wasGreen = wasBull && previousPrice > previousFastEMA;
    const isRed = isBear && currentPrice < currentFastEMA;
    const wasRed = wasBear && previousPrice < previousFastEMA;

    const buyCond = isGreen && !wasGreen;
    const sellCond = isRed && !wasRed;

    let signal = "HOLD";

    // Check for crossover signals
    if (buyCond) {
      signal = "BUY";
    } else if (sellCond) {
      signal = "SELL";
    }

    return {
      signal,
      zone,
      fastEMA: currentFastEMA,
      slowEMA: currentSlowEMA,
      isBull,
      isBear,
      technicalData: {
        buyCond,
        sellCond,
        isGreen,
        wasGreen,
        isRed,
        wasRed,
      },
    };
  }

  /**
   * Calculate EMA for the given prices and period
   * @param {Array} prices - Array of price data
   * @param {number} period - EMA period
   * @returns {Array} - Array of EMA values
   */
  _calculateEMA(prices, period) {
    const emaValues = [];
    const multiplier = 2 / (period + 1);

    // Calculate SMA for the first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += prices[i];
    }
    const firstEMA = sum / period;
    emaValues.push(firstEMA);

    // Calculate the rest of the EMA values
    for (let i = period; i < prices.length; i++) {
      const ema =
        (prices[i] - emaValues[emaValues.length - 1]) * multiplier +
        emaValues[emaValues.length - 1];
      emaValues.push(ema);
    }

    return emaValues;
  }

  /**
   * Analyze price data using enabled indicators
   * @param {Array} prices - Price data array
   * @returns {Object} - Combined signal analysis
   */
  analyzePrice(prices) {
    // Get CDC Action Zone signals (our primary indicator now)
    const cdcSignal = this._calculateCDCActionZone(prices);

    // Get MACD signals (secondary confirmation)
    const macdSignal = this._calculateMACDSignal(prices);

    // For now, just return CDC signals as primary but include MACD data
    return {
      signal: cdcSignal.signal,
      zone: cdcSignal.zone,
      macd: macdSignal.macd,
      isBull: cdcSignal.isBull,
      isBear: cdcSignal.isBear,
      fastEMA: cdcSignal.fastEMA,
      slowEMA: cdcSignal.slowEMA,
      details: {
        cdc: cdcSignal.technicalData,
        macd: macdSignal,
      },
    };
  }
}

module.exports = IndicatorManager;
