/**
 * BacktestService - CDC Action Zone (EMA 12/26 Crossover) Backtester
 * 
 * Handles:
 * - Usage limit enforcement (configurable per tier)
 * - Historical data fetching
 * - Running the EMA crossover simulation
 * - Recording usage
 */
const TechnicalService = require('./technical.service');
const BinanceService = require('./binance.service');
const YahooDataService = require('./data/YahooDataService');
const config = require('../config');

class BacktestService {
  constructor({ subscriberService } = {}) {
    this.technical = new TechnicalService({ fastPeriod: 12, slowPeriod: 26 });
    this.binanceService = new BinanceService('1d');
    this.yahooFinanceService = new YahooDataService('1d');
    this.subscriberService = subscriberService;
  }

  /**
   * Parse and validate backtest arguments from user input.
   * @param {string|null} rawArgs - Raw argument string (e.g. "BTC 365")
   * @returns {{ valid: boolean, symbol?: string, days?: number }}
   */
  parseArgs(rawArgs) {
    const args = rawArgs ? rawArgs.trim().split(/\s+/) : [];
    if (args.length < 2) return { valid: false };

    const symbol = args[0].toUpperCase();
    const days = parseInt(args[1]);

    if (isNaN(days) || days < 30 || days > 1000) return { valid: false };

    // const symbol = rawSymbol.includes('/') ? rawSymbol : `${rawSymbol}/USDT`;
    return { valid: true, symbol, days };
  }

  /**
   * Check if a user has remaining backtest quota this month.
   * @param {string} chatId
   * @param {boolean} isAdminOverride
   * @returns {{ allowed: boolean, used: number, limit: number|null }}
   */
  async checkUsageLimit(chatId, isAdminOverride = false) {
    if (isAdminOverride) {
      return { allowed: true, used: 0, limit: null };
    }

    const subscriber = await this.subscriberService.getSubscriber(chatId);
    const userTier = subscriber?.tier || 'free';
    const tierConfig = config.tiers[userTier];
    const limit = tierConfig?.backtestLimit;

    // null = unlimited (Pro tier)
    if (limit === null || limit === undefined) {
      return { allowed: true, used: 0, limit: null };
    }

    const used = await this.subscriberService.getBacktestUsageCount(chatId);
    return { allowed: used < limit, used, limit };
  }

  /**
   * Fetch historical candle data for a symbol.
   * @param {string} symbol - e.g. "BTC/USDT" or "AAPL"
   * @param {number} days - Backtest duration in days
   * @returns {Array|null}
   */
  async fetchCandles(symbol, days) {
    const candleLimit = days + 100; // extra for EMA warmup
    if (symbol.includes('/')) {
        return this.binanceService.getHistoricalPrices(symbol, candleLimit);
    } else {
        return this.yahooFinanceService.getHistoricalPrices(symbol, candleLimit);
    }
  }

  /**
   * Execute a full backtest: check limits, fetch data, run simulation, record usage.
   * @param {string} chatId - User's chat ID
   * @param {string} symbol - Trading pair (e.g. "BTC/USDT")
   * @param {number} days - Number of days to backtest
   * @param {boolean} isAdminOverride - Whether admin override is active
   * @returns {{ result: object, usage: { used: number, limit: number|null } }}
   * @throws {Error} If limit exceeded, data unavailable, or engine error
   */
  async execute(chatId, symbol, days, isAdminOverride = false) {
    // 1. Check usage limit
    const usageCheck = await this.checkUsageLimit(chatId, isAdminOverride);
    if (!usageCheck.allowed) {
      const err = new Error('LIMIT_EXCEEDED');
      err.code = 'LIMIT_EXCEEDED';
      err.used = usageCheck.used;
      err.limit = usageCheck.limit;
      throw err;
    }

    // 2. Fetch data
    const candles = await this.fetchCandles(symbol, days);
    if (!candles || candles.length === 0) {
      const err = new Error('NO_DATA');
      err.code = 'NO_DATA';
      throw err;
    }

    // 3. Run backtest
    const result = this.run(candles, days);
    result.symbol = symbol;

    // 4. Record usage
    await this.subscriberService.recordBacktestUsage(chatId);

    // 5. Get updated usage count
    const newUsed = usageCheck.limit !== null
      ? await this.subscriberService.getBacktestUsageCount(chatId)
      : 0;

    return {
      result,
      usage: { used: newUsed, limit: usageCheck.limit },
    };
  }

  /**
   * Run a backtest on the given candle data.
   * @param {Array} candles - Array of {time, open, high, low, close, volume}
   * @param {number} days - Number of trading days to backtest over (from the end of the data)
   * @param {number} initialCapital - Starting capital for the simulation
   * @returns {object} Backtest results
   */
  run(candles, days, initialCapital = 10000) {
    if (!candles || candles.length === 0) {
      throw new Error('No candle data provided.');
    }

    // We need extra candles for EMA warmup (at least 26 for slow EMA)
    const warmupPeriod = 26;

    if (candles.length < warmupPeriod + 5) {
      throw new Error(`Not enough data. Need at least ${warmupPeriod + 5} candles, got ${candles.length}.`);
    }

    // Get close prices
    const closePrices = candles.map(c => c.close);

    // Calculate EMAs over the entire dataset
    const fastEMA = this.technical.calculateEMA(closePrices, 12);
    const slowEMA = this.technical.calculateEMA(closePrices, 26);

    // Align EMAs: slowEMA starts at index 25 (0-indexed), fastEMA at index 11
    // slowEMA[i] corresponds to closePrices[i + 25]
    // fastEMA[i] corresponds to closePrices[i + 11]

    // The effective trading window starts after the slow EMA warmup
    // We want the LAST `days` candles for the backtest period
    const dataStartIdx = 25; // First candle index where we have both EMAs
    const dataEndIdx = candles.length - 1;
    const backtestStartIdx = Math.max(dataStartIdx, dataEndIdx - days + 1);

    // Simulation state
    let capital = initialCapital;
    let position = 0; // number of units held
    let entryPrice = 0;
    const trades = [];
    let inPosition = false;

    let peakCapital = initialCapital;
    let maxDrawdown = 0;

    for (let i = backtestStartIdx; i <= dataEndIdx; i++) {
      // slowEMA index for candle[i] is (i - 25)
      const slowIdx = i - 25;
      // fastEMA index for candle[i] is (i - 11)
      const fastIdx = i - 11;

      if (slowIdx < 1 || fastIdx < 1) continue; // Need at least 2 points for crossover

      const currentFast = fastEMA[fastIdx];
      const previousFast = fastEMA[fastIdx - 1];
      const currentSlow = slowEMA[slowIdx];
      const previousSlow = slowEMA[slowIdx - 1];

      const price = closePrices[i];
      const time = candles[i].time;

      // BUY signal: Fast EMA crosses above Slow EMA
      if (!inPosition && previousFast <= previousSlow && currentFast > currentSlow) {
        position = capital / price;
        entryPrice = price;
        inPosition = true;
        trades.push({ type: 'BUY', price, time: new Date(time), capital: capital.toFixed(2) });
      }
      // SELL signal: Fast EMA crosses below Slow EMA
      else if (inPosition && previousFast >= previousSlow && currentFast < currentSlow) {
        capital = position * price;
        const pnl = ((price - entryPrice) / entryPrice) * 100;
        trades.push({ type: 'SELL', price, time: new Date(time), capital: capital.toFixed(2), pnl: pnl.toFixed(2) });
        inPosition = false;
        position = 0;
        entryPrice = 0;
      }

      // Track drawdown
      const currentValue = inPosition ? position * price : capital;
      if (currentValue > peakCapital) peakCapital = currentValue;
      const drawdown = ((peakCapital - currentValue) / peakCapital) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // If still in position at the end, calculate unrealized PnL at last close
    const lastPrice = closePrices[closePrices.length - 1];
    const finalValue = inPosition ? position * lastPrice : capital;
    const unrealizedPnl = inPosition ? ((lastPrice - entryPrice) / entryPrice) * 100 : 0;

    // Calculate trade statistics
    const sellTrades = trades.filter(t => t.type === 'SELL');
    const wins = sellTrades.filter(t => parseFloat(t.pnl) > 0).length;
    const losses = sellTrades.filter(t => parseFloat(t.pnl) <= 0).length;
    const totalCompleted = sellTrades.length;
    const winRate = totalCompleted > 0 ? (wins / totalCompleted) * 100 : 0;

    return {
      symbol: null, // Set by caller
      days,
      initialCapital,
      finalValue: parseFloat(finalValue.toFixed(2)),
      totalPnl: parseFloat(((finalValue - initialCapital) / initialCapital * 100).toFixed(2)),
      totalTrades: trades.length,
      completedTrades: totalCompleted,
      wins,
      losses,
      winRate: parseFloat(winRate.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      stillInPosition: inPosition,
      unrealizedPnl: inPosition ? parseFloat(unrealizedPnl.toFixed(2)) : null,
      trades,
      period: {
        from: new Date(candles[backtestStartIdx].time),
        to: new Date(candles[dataEndIdx].time),
      },
    };
  }
}

module.exports = BacktestService;
