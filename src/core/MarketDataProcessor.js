/**
 * MarketDataProcessor with increased data window for better EMA accuracy
 */
class MarketDataProcessor {
  constructor(config = {}) {
    this.limits = {
      maxHistoricalData: config.maxHistoricalData || 150,
      minRequiredData: config.minRequiredData || 28,
      processingWindow: config.processingWindow || 150, // INCREASED from 80 to 150
      dataLimitPerSymbol: config.dataLimitPerSymbol || 150, // INCREASED
    };

    this.stats = {
      processedSymbols: 0,
      totalDataPoints: 0,
      limitedSymbols: 0,
      rejectedSymbols: 0,
    };

    console.log(
      `[PROCESSOR] Initialized with LARGER limits for EMA accuracy:`,
      this.limits
    );
  }

  /**
   * Process raw price data for analysis
   */
  prepareForAnalysis(rawPrices, marketType, symbol) {
    this.stats.processedSymbols++;

    if (!rawPrices || rawPrices.length < this.limits.minRequiredData) {
      console.log(
        `[PROCESSOR] Insufficient data for ${symbol}: ${
          rawPrices?.length || 0
        } points (need ${this.limits.minRequiredData})`
      );
      this.stats.rejectedSymbols++;
      return null;
    }

    // Apply intelligent data windowing based on processing needs
    let processedPrices = rawPrices;
    const originalLength = rawPrices.length;

    if (rawPrices.length > this.limits.processingWindow) {
      // Keep the most recent data for analysis
      processedPrices = rawPrices.slice(-this.limits.processingWindow);
      this.stats.limitedSymbols++;
      console.log(
        `[PROCESSOR] ${symbol}: Limited from ${originalLength} to ${this.limits.processingWindow} points for better EMA accuracy`
      );
    } else {
      console.log(
        `[PROCESSOR] ${symbol}: Using all ${originalLength} points (within ${this.limits.processingWindow} limit)`
      );
    }

    // Apply market-specific timing logic
    const { prices, latestPrice, dataSource } = this._applyMarketTimingLogic(
      processedPrices,
      marketType
    );

    this.stats.totalDataPoints += prices.length;

    console.log(
      `[PROCESSOR] ${symbol}: Final analysis data: ${
        prices.length
      } points (EMA 26 will have ${Math.max(0, prices.length - 26 + 1)} values)`
    );

    return {
      symbol,
      prices,
      latestPrice,
      dataSource,
      originalLength,
      processedLength: prices.length,
      marketType,
    };
  }

  /**
   * Apply market-specific timing rules
   */
  _applyMarketTimingLogic(allPrices, marketType) {
    if (marketType === "crypto") {
      // Crypto: Use previous day's complete data
      return {
        prices: allPrices.slice(0, -1),
        latestPrice: allPrices[allPrices.length - 1],
        dataSource: "crypto_previous_close",
      };
    } else {
      // Stock market logic with trading hours consideration
      const inTradingHours = this._isInStockTradingHours();

      if (inTradingHours) {
        // During trading: current day is incomplete, use previous complete data
        return {
          prices: allPrices.slice(0, -1),
          latestPrice: allPrices[allPrices.length - 1],
          dataSource: "stock_intraday_incomplete",
        };
      } else {
        // After hours/weekends: use all data (latest is complete)
        return {
          prices: allPrices,
          latestPrice: allPrices[allPrices.length - 1],
          dataSource: "stock_complete_afterhours",
        };
      }
    }
  }

  _isInStockTradingHours() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // US market hours: roughly 14:30-21:00 UTC (9:30-16:00 EST)
    return utcHour >= 14 && utcHour <= 21;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      averageDataPointsPerSymbol:
        this.stats.processedSymbols > 0
          ? Math.round(this.stats.totalDataPoints / this.stats.processedSymbols)
          : 0,
      limitingRate:
        this.stats.processedSymbols > 0
          ? Math.round(
              (this.stats.limitedSymbols / this.stats.processedSymbols) * 100
            )
          : 0,
      rejectionRate:
        this.stats.processedSymbols > 0
          ? Math.round(
              (this.stats.rejectedSymbols / this.stats.processedSymbols) * 100
            )
          : 0,
    };
  }

  /**
   * Reset statistics (useful for testing or periodic resets)
   */
  resetStats() {
    this.stats = {
      processedSymbols: 0,
      totalDataPoints: 0,
      limitedSymbols: 0,
      rejectedSymbols: 0,
    };
    console.log(`[PROCESSOR] Statistics reset`);
  }
}

module.exports = MarketDataProcessor;
