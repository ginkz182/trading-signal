/**
 * Fixed EMA Calculation - Debug version to match TradingView exactly
 */
class TechnicalService {
  constructor(config = {}) {
    this.emaConfig = {
      fastPeriod: config.fastPeriod || 12,
      slowPeriod: config.slowPeriod || 26,
    };
    console.log(
      `[EMA] Initialized: Fast=${this.emaConfig.fastPeriod}, Slow=${this.emaConfig.slowPeriod}`
    );
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

    console.log(`[EMA] Price data sample:`, {
      total: priceValues.length,
      first: priceValues[0],
      last: priceValues[priceValues.length - 1],
      secondLast: priceValues[priceValues.length - 2],
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

    // Calculate EMAs with debug info
    console.log(
      `[EMA] Calculating EMA ${this.emaConfig.fastPeriod} (fast) and EMA ${this.emaConfig.slowPeriod} (slow)`
    );

    const fastEMA = this.calculateEMA(priceValues, this.emaConfig.fastPeriod);
    const slowEMA = this.calculateEMA(priceValues, this.emaConfig.slowPeriod);

    console.log(`[EMA] EMA calculation results:`);
    console.log(
      `  Fast EMA (${this.emaConfig.fastPeriod}): length=${
        fastEMA.length
      }, last=${fastEMA[fastEMA.length - 1]?.toFixed(4)}`
    );
    console.log(
      `  Slow EMA (${this.emaConfig.slowPeriod}): length=${
        slowEMA.length
      }, last=${slowEMA[slowEMA.length - 1]?.toFixed(4)}`
    );

    if (fastEMA.length < 5 || slowEMA.length < 5) {
      return {
        signal: "HOLD",
        fastEMA: fastEMA.length > 0 ? fastEMA[fastEMA.length - 1] : null,
        slowEMA: slowEMA.length > 0 ? slowEMA[slowEMA.length - 1] : null,
        isBull: false,
        isBear: false,
      };
    }

    // Show last few EMA values for debugging
    console.log(`[EMA] Last 3 EMA values:`);
    for (let i = 3; i >= 1; i--) {
      const fastIdx = fastEMA.length - i;
      const slowIdx = slowEMA.length - i;
      const fast = fastEMA[fastIdx];
      const slow = slowEMA[slowIdx];
      const daysAgo = i - 1;

      console.log(
        `  ${daysAgo} days ago: Fast EMA=${fast?.toFixed(
          4
        )}, Slow EMA=${slow?.toFixed(4)}`
      );
    }

    // Get current EMA values
    const currentFastEMA = fastEMA[fastEMA.length - 1];
    const currentSlowEMA = slowEMA[slowEMA.length - 1];

    console.log(
      `[EMA] Current EMAs: Fast=${currentFastEMA.toFixed(
        4
      )}, Slow=${currentSlowEMA.toFixed(4)}`
    );
    console.log(`[EMA] TradingView should show: Fast=~654.258, Slow=~653.809`);
    console.log(
      `[EMA] Difference: Fast=${Math.abs(currentFastEMA - 654.258).toFixed(
        4
      )}, Slow=${Math.abs(currentSlowEMA - 653.809).toFixed(4)}`
    );

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

    console.log(`[EMA] Crossover check:`);
    console.log(
      `  Previous: Fast=${previousFast.toFixed(4)}, Slow=${previousSlow.toFixed(
        4
      )} → ${previousFast > previousSlow ? "FAST ABOVE" : "FAST BELOW"}`
    );
    console.log(
      `  Current:  Fast=${currentFast.toFixed(4)}, Slow=${currentSlow.toFixed(
        4
      )} → ${currentFast > currentSlow ? "FAST ABOVE" : "FAST BELOW"}`
    );

    // BUY: Fast EMA crosses above Slow EMA
    if (previousFast < previousSlow && currentFast > currentSlow) {
      console.log(`[EMA] 🟢 BUY: Fast EMA crossed ABOVE Slow EMA`);
      return "BUY";
    }

    // SELL: Fast EMA crosses below Slow EMA
    if (previousFast > previousSlow && currentFast < currentSlow) {
      console.log(`[EMA] 🔴 SELL: Fast EMA crossed BELOW Slow EMA`);
      return "SELL";
    }

    console.log(`[EMA] 🟡 HOLD: No crossover`);
    return "HOLD";
  }
}

module.exports = TechnicalService;
