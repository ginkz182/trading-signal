/**
 * SimplifiedIndicatorManager - Manages technical indicators and signal analysis
 * Focused only on EMA crossovers for signal generation
 */
const TechnicalService = require("../services/technical.service");

class IndicatorManager {
  constructor(config = {}) {
    this.technicalService = new TechnicalService({
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
    });
  }

  /**
   * Analyze price data using EMA crossover strategy
   * @param {Array} prices - Price data array
   * @param {String} symbol - Symbol identifier
   * @returns {Object} - Signal analysis
   */
  analyzePrice(prices, symbol) {
    // Check if we have enough data points
    if (!prices || prices.length < 28) {
      console.warn(
        `Insufficient data for ${symbol}, need at least 28 data points`
      );
      return {
        signal: "HOLD",
        fastEMA: null,
        slowEMA: null,
        isBull: false,
        isBear: false,
      };
    }

    // Warn about potential accuracy issues with EMA26
    const recommendedMinimum = 260; // 10x the slowPeriod for stability
    if (prices.length < recommendedMinimum) {
      console.warn(
        `[${symbol}] Limited data (${prices.length} points). Recommended: ${recommendedMinimum}+ for accurate EMA26. Results may be less accurate.`
      );
    }

    // Get EMA crossover signals
    const emaCrossoverSignal =
      this.technicalService.calculateEmaCrossoverSignal(prices);

    // Return analysis
    return {
      signal: emaCrossoverSignal.signal,
      fastEMA: emaCrossoverSignal.fastEMA,
      slowEMA: emaCrossoverSignal.slowEMA,
      isBull: emaCrossoverSignal.isBull,
      isBear: emaCrossoverSignal.isBear,
      details: {
        emaCrossover: {
          fastEMA: emaCrossoverSignal.fastEMA,
          slowEMA: emaCrossoverSignal.slowEMA,
        },
      },
    };
  }

  /**
   * Reset for testing
   */
  resetZones() {
    // No zones to reset in this simplified version
    return;
  }
}

module.exports = IndicatorManager;
