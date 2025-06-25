/**
 * Fixed EMA Calculation - Debug version to match TradingView exactly
 */
class TechnicalService {
  constructor(config = {}) {
    this.emaConfig = {
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
    };
  }

  calculateEMA(prices, period) {
    if (prices.length < period) {
      return [];
    }

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

  calculateEmaCrossoverSignal(prices) {
    const priceValues = prices.map((p) => {
      const value = p.close || p;
      return typeof value === "number" ? value : parseFloat(value);
    });


    if (priceValues.length < this.emaConfig.slowPeriod + 5) {
      return {
        signal: "HOLD",
        fastEMA: null,
        slowEMA: null,
        isBull: false,
        isBear: false,
      };
    }

    // Calculate EMAs

    const fastEMA = this.calculateEMA(priceValues, this.emaConfig.fastPeriod);
    const slowEMA = this.calculateEMA(priceValues, this.emaConfig.slowPeriod);


    if (fastEMA.length < 5 || slowEMA.length < 5) {
      return {
        signal: "HOLD",
        fastEMA: fastEMA.length > 0 ? fastEMA[fastEMA.length - 1] : null,
        slowEMA: slowEMA.length > 0 ? slowEMA[slowEMA.length - 1] : null,
        isBull: false,
        isBear: false,
      };
    }


    // Get current EMA values
    const currentFastEMA = fastEMA[fastEMA.length - 1];
    const currentSlowEMA = slowEMA[slowEMA.length - 1];


    const isBull = currentFastEMA > currentSlowEMA;
    const isBear = currentFastEMA < currentSlowEMA;

    // Simple crossover check
    const signal = this.checkEmaCrossover(fastEMA, slowEMA);

    return {
      signal,
      fastEMA: currentFastEMA,
      slowEMA: currentSlowEMA,
      isBull,
      isBear,
    };
  }

  checkEmaCrossover(fastEMA, slowEMA) {
    if (fastEMA.length < 2 || slowEMA.length < 2) {
      return "HOLD";
    }

    // Get last two values
    const currentFast = fastEMA[fastEMA.length - 1];
    const previousFast = fastEMA[fastEMA.length - 2];
    const currentSlow = slowEMA[slowEMA.length - 1];
    const previousSlow = slowEMA[slowEMA.length - 2];


    // BUY: Fast EMA crosses above Slow EMA
    if (previousFast < previousSlow && currentFast > currentSlow) {
      return "BUY";
    }

    // SELL: Fast EMA crosses below Slow EMA
    if (previousFast > previousSlow && currentFast < currentSlow) {
      return "SELL";
    }

    return "HOLD";
  }
}

module.exports = TechnicalService;
