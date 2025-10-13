/**
 * IndicatorManager - Manages technical indicators and pattern analysis
 * Enhanced with triangle pattern detection capabilities
 */
const TechnicalService = require("../services/technical.service");
const PatternService = require("../services/pattern.service");

class IndicatorManager {
  constructor(config = {}) {
    this.technicalService = new TechnicalService({
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
    });
    
    // Initialize pattern detection service
    this.patternService = new PatternService({
      minBars: config.patternMinBars || 20,
      maxBars: config.patternMaxBars || 100,
      tolerance: config.patternTolerance || 0.02,
      minTouchPoints: config.patternMinTouchPoints || 3,
      volumeConfirmation: config.patternVolumeConfirmation !== false,
      breakoutThreshold: config.patternBreakoutThreshold || 0.015,
      volumeBreakoutMultiplier: config.patternVolumeBreakoutMultiplier || 1.5,
    });
    
    this.enablePatterns = config.enablePatterns !== false; // Default enabled
  }

  /**
   * Analyze market data using EMA crossover strategy and pattern detection
   * @param {Object} marketData - Processed market data from MarketDataProcessor
   * @param {String} symbol - Symbol identifier
   * @returns {Object} - Enhanced signal analysis
   */
  analyzePrice(marketData, symbol) {
    // Handle backward compatibility - if passed array of prices
    let prices, ohlcvData;
    if (Array.isArray(marketData)) {
      prices = marketData;
      ohlcvData = null;
    } else {
      prices = marketData.prices;
      ohlcvData = marketData.ohlcv;
    }
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
        pattern: null,
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

    // Get pattern analysis if OHLCV data is available and patterns enabled
    let patternAnalysis = null;
    if (this.enablePatterns && ohlcvData && ohlcvData.length >= this.patternService.config.minBars) {
      try {
        patternAnalysis = this.patternService.detectTriangles(ohlcvData, symbol);
      } catch (error) {
        console.error(`[PATTERN] Error analyzing patterns for ${symbol}:`, error.message);
        patternAnalysis = { pattern: null, confidence: 0, reason: 'Analysis error' };
      }
    }

    // Return both signals separately (no combination)
    return {
      // EMA Crossover Signal (Primary - CDC Action Zone)
      signal: emaCrossoverSignal.signal,
      fastEMA: emaCrossoverSignal.fastEMA,
      slowEMA: emaCrossoverSignal.slowEMA,
      isBull: emaCrossoverSignal.isBull,
      isBear: emaCrossoverSignal.isBear,
      
      // Pattern Analysis (Secondary - Triangle Alerts)
      pattern: patternAnalysis,
      
      details: {
        emaCrossover: {
          fastEMA: emaCrossoverSignal.fastEMA,
          slowEMA: emaCrossoverSignal.slowEMA,
          signal: emaCrossoverSignal.signal,
        },
        pattern: patternAnalysis,
      },
    };
  }

  /**
   * Combine EMA crossover signals with pattern analysis
   * @param {Object} emaSignal - EMA crossover signal data
   * @param {Object} patternAnalysis - Pattern analysis result
   * @returns {Object} - Combined signal with reasoning
   */
  _combineSignals(emaSignal, patternAnalysis) {
    let signal = emaSignal.signal;
    let isBull = emaSignal.isBull;
    let isBear = emaSignal.isBear;
    let confidence = 60; // Base confidence for EMA-only signals
    let reasoning = [`EMA signal: ${signal}`];

    // If no pattern detected, return EMA signal only
    if (!patternAnalysis || !patternAnalysis.pattern) {
      return {
        signal,
        isBull,
        isBear,
        confidence,
        reasoning: reasoning.join(', ')
      };
    }

    // Pattern detected - integrate with EMA signal
    const patternConfidence = patternAnalysis.confidence;
    const patternDirection = patternAnalysis.direction;
    const breakoutStatus = patternAnalysis.breakout?.status;
    
    reasoning.push(`${patternAnalysis.pattern} detected (${patternConfidence}% confidence)`);

    // Handle pattern breakouts - these override EMA signals
    if (breakoutStatus === 'BREAKOUT_UP') {
      signal = 'BUY';
      isBull = true;
      isBear = false;
      confidence = Math.max(75, patternConfidence);
      reasoning.push('Bullish breakout confirmed');
    } else if (breakoutStatus === 'BREAKOUT_DOWN') {
      signal = 'SELL';
      isBull = false;
      isBear = true;
      confidence = Math.max(75, patternConfidence);
      reasoning.push('Bearish breakout confirmed');
    } else {
      // Pattern forming but no breakout - adjust EMA signal based on pattern bias
      if (patternDirection === 'BULLISH' && emaSignal.signal === 'BUY') {
        // Pattern supports EMA buy signal
        confidence = Math.min(90, 65 + (patternConfidence * 0.3));
        reasoning.push('Pattern supports bullish EMA signal');
      } else if (patternDirection === 'BEARISH' && emaSignal.signal === 'SELL') {
        // Pattern supports EMA sell signal
        confidence = Math.min(90, 65 + (patternConfidence * 0.3));
        reasoning.push('Pattern supports bearish EMA signal');
      } else if (patternDirection === 'BULLISH' && emaSignal.signal === 'SELL') {
        // Pattern conflicts with EMA signal - reduce confidence
        confidence = Math.max(45, 60 - (patternConfidence * 0.2));
        reasoning.push('Pattern conflicts with EMA signal - reduced confidence');
      } else if (patternDirection === 'BEARISH' && emaSignal.signal === 'BUY') {
        // Pattern conflicts with EMA signal - reduce confidence
        confidence = Math.max(45, 60 - (patternConfidence * 0.2));
        reasoning.push('Pattern conflicts with EMA signal - reduced confidence');
      } else if (patternDirection === 'NEUTRAL') {
        // Neutral pattern - slight confidence boost for HOLD signals
        if (emaSignal.signal === 'HOLD') {
          confidence = Math.min(75, 60 + (patternConfidence * 0.15));
          reasoning.push('Symmetrical triangle forming - await breakout direction');
        }
      }

      // Handle approaching resistance/support
      if (breakoutStatus === 'APPROACHING_RESISTANCE') {
        reasoning.push('Price approaching triangle resistance');
        if (emaSignal.signal === 'BUY') {
          confidence = Math.min(confidence + 5, 85);
        }
      } else if (breakoutStatus === 'APPROACHING_SUPPORT') {
        reasoning.push('Price approaching triangle support');
        if (emaSignal.signal === 'SELL') {
          confidence = Math.min(confidence + 5, 85);
        }
      }
    }

    return {
      signal,
      isBull,
      isBear,
      confidence: Math.round(confidence),
      reasoning: reasoning.join(', ')
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
