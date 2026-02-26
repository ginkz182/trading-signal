const { expect } = require("chai");
const sinon = require("sinon");
const BacktestService = require("../../src/services/backtest.service");

describe("BacktestService", () => {
  let backtestService;
  let subscriberServiceStub;

  // Helper: generate deterministic candle data with guaranteed crossovers
  function makeCandlesWithCrossover(count = 200) {
    const candles = [];
    for (let i = 0; i < count; i++) {
      let price;
      if (i < 50) price = 100;                       // flat baseline
      else if (i < 80) price = 100 + (i - 50) * 5;   // strong uptrend (BUY)
      else if (i < 130) price = 250;                  // flat at top
      else if (i < 160) price = 250 - (i - 130) * 5;  // strong downtrend (SELL) 
      else price = 100;                               // flat at bottom
      candles.push({
        time: Date.now() - (count - i) * 86400000,
        open: price, high: price, low: price, close: price, volume: 1000,
      });
    }
    return candles;
  }

  // Helper: generate flat candle data (no crossovers)
  function makeFlatCandles(count = 200, price = 100) {
    const candles = [];
    for (let i = 0; i < count; i++) {
      candles.push({
        time: Date.now() - (count - i) * 86400000,
        open: price, high: price, low: price, close: price, volume: 1000,
      });
    }
    return candles;
  }

  beforeEach(() => {
    subscriberServiceStub = {
      getSubscriber: sinon.stub().resolves({ tier: 'premium', subscribed: true }),
      getBacktestUsageCount: sinon.stub().resolves(0),
      recordBacktestUsage: sinon.stub().resolves(),
    };

    backtestService = new BacktestService({ subscriberService: subscriberServiceStub });
    // Stub binanceService to avoid real API calls
    sinon.stub(backtestService.binanceService, 'getHistoricalPrices');
  });

  afterEach(() => {
    sinon.restore();
  });

  // --- parseArgs ---
  describe("parseArgs()", () => {
    it("should parse valid args: 'BTC 365'", () => {
      const result = backtestService.parseArgs("BTC 365");
      expect(result.valid).to.be.true;
      expect(result.symbol).to.equal("BTC");
      expect(result.days).to.equal(365);
    });

    it("should parse valid args with slash symbol: 'ETH/USDT 180'", () => {
      const result = backtestService.parseArgs("ETH/USDT 180");
      expect(result.valid).to.be.true;
      expect(result.symbol).to.equal("ETH/USDT");
      expect(result.days).to.equal(180);
    });

    it("should return invalid for missing arguments", () => {
      expect(backtestService.parseArgs(null).valid).to.be.false;
      expect(backtestService.parseArgs("").valid).to.be.false;
      expect(backtestService.parseArgs("BTC").valid).to.be.false;
    });

    it("should return invalid for days out of range", () => {
      expect(backtestService.parseArgs("BTC 10").valid).to.be.false;  // < 30
      expect(backtestService.parseArgs("BTC 2000").valid).to.be.false; // > 1000
    });

    it("should return invalid for non-numeric days", () => {
      expect(backtestService.parseArgs("BTC abc").valid).to.be.false;
    });

    it("should uppercase the symbol", () => {
      const result = backtestService.parseArgs("btc 90");
      expect(result.symbol).to.equal("BTC");
    });
  });

  // --- run (core engine) ---
  describe("run()", () => {
    it("should detect BUY and SELL crossovers in trending data", () => {
      const candles = makeCandlesWithCrossover();
      const result = backtestService.run(candles, 150);

      expect(result.totalTrades).to.be.greaterThan(0);
      expect(result.trades.some(t => t.type === 'BUY')).to.be.true;
      expect(result.trades.some(t => t.type === 'SELL')).to.be.true;
    });

    it("should calculate correct PnL for a profitable trade", () => {
      const candles = makeCandlesWithCrossover();
      const result = backtestService.run(candles, 150);

      // The uptrend should produce a positive PnL on the first completed trade
      const sellTrades = result.trades.filter(t => t.type === 'SELL');
      if (sellTrades.length > 0) {
        expect(parseFloat(sellTrades[0].pnl)).to.be.greaterThan(0);
      }
    });

    it("should return 0 trades for flat price data", () => {
      const candles = makeFlatCandles(200, 100);
      const result = backtestService.run(candles, 150);

      expect(result.totalTrades).to.equal(0);
      expect(result.totalPnl).to.equal(0);
      expect(result.finalValue).to.equal(10000);
    });

    it("should return correct structure with all required fields", () => {
      const candles = makeCandlesWithCrossover();
      const result = backtestService.run(candles, 150);

      expect(result).to.have.property('days', 150);
      expect(result).to.have.property('initialCapital', 10000);
      expect(result).to.have.property('finalValue').that.is.a('number');
      expect(result).to.have.property('totalPnl').that.is.a('number');
      expect(result).to.have.property('totalTrades').that.is.a('number');
      expect(result).to.have.property('completedTrades').that.is.a('number');
      expect(result).to.have.property('wins').that.is.a('number');
      expect(result).to.have.property('losses').that.is.a('number');
      expect(result).to.have.property('winRate').that.is.a('number');
      expect(result).to.have.property('maxDrawdown').that.is.a('number');
      expect(result).to.have.property('stillInPosition').that.is.a('boolean');
      expect(result).to.have.property('trades').that.is.an('array');
      expect(result).to.have.property('period');
      expect(result.period.from).to.be.instanceOf(Date);
      expect(result.period.to).to.be.instanceOf(Date);
    });

    it("should throw for empty candle data", () => {
      expect(() => backtestService.run([], 30)).to.throw('No candle data');
      expect(() => backtestService.run(null, 30)).to.throw('No candle data');
    });

    it("should throw for insufficient candle data", () => {
      const tooFew = makeFlatCandles(20);
      expect(() => backtestService.run(tooFew, 30)).to.throw('Not enough data');
    });

    it("should track max drawdown", () => {
      const candles = makeCandlesWithCrossover();
      const result = backtestService.run(candles, 150);

      expect(result.maxDrawdown).to.be.a('number');
      expect(result.maxDrawdown).to.be.at.least(0);
    });

    it("should use custom initial capital", () => {
      const candles = makeFlatCandles(200);
      const result = backtestService.run(candles, 150, 50000);
      expect(result.initialCapital).to.equal(50000);
      expect(result.finalValue).to.equal(50000);
    });
  });

  // --- run() - exact calculation tests (golden values) ---
  describe("run() - exact calculations", () => {
    /**
     * Scenario: Single winning trade
     * Data: flat@100 → uptrend(+5/candle) → flat@250 → downtrend(-5/candle) → flat@100
     * Expected: BUY @ $105 (crossover during uptrend), SELL @ $240 (crossover during downtrend)
     * PnL on trade: (240-105)/105 = +128.57%
     * Final capital: 10000 * (240/105) = $22857.14
     */
    it("should calculate exact PnL for a single winning trade", () => {
      const candles = makeCandlesWithCrossover();
      const result = backtestService.run(candles, 150);

      // Exact trade details
      expect(result.totalTrades).to.equal(2); // 1 BUY + 1 SELL
      expect(result.completedTrades).to.equal(1); // 1 round-trip
      expect(result.wins).to.equal(1);
      expect(result.losses).to.equal(0);
      expect(result.winRate).to.equal(100);
      expect(result.stillInPosition).to.be.false;

      // Exact entry/exit values
      const buyTrade = result.trades.find(t => t.type === 'BUY');
      const sellTrade = result.trades.find(t => t.type === 'SELL');
      expect(buyTrade.price).to.equal(105);
      expect(sellTrade.price).to.equal(240);
      expect(parseFloat(sellTrade.pnl)).to.equal(128.57);

      // Exact final capital: 10000 / 105 * 240 = 22857.142857...
      expect(result.finalValue).to.equal(22857.14);
      expect(result.totalPnl).to.equal(128.57);
      expect(result.unrealizedPnl).to.be.null;
    });

    /**
     * Scenario: Single losing trade
     * Data: flat@100 → sharp spike(+10/candle) → crash(-15/candle) → flat@25
     * Expected: BUY during uptrend, then SELL at a lower price during the crash.
     */
    it("should calculate exact PnL for a losing trade", () => {
      const candles = [];
      for (let i = 0; i < 200; i++) {
        let price;
        if (i < 50) price = 100;
        else if (i < 65) price = 100 + (i - 50) * 10;  // spike: 110..250
        else if (i < 80) price = 250 - (i - 65) * 15;   // crash: 235..25
        else price = 25;
        candles.push({
          time: 1000000 + i * 86400000,
          open: price, high: price, low: price, close: price, volume: 1000,
        });
      }

      const result = backtestService.run(candles, 150);

      // Should have at least 1 completed losing trade
      const sellTrades = result.trades.filter(t => t.type === 'SELL');
      expect(sellTrades.length).to.be.greaterThan(0);

      // The sell price should be less than the buy price
      const buyTrade = result.trades.find(t => t.type === 'BUY');
      const sellTrade = sellTrades[0];
      expect(sellTrade.price).to.be.lessThan(buyTrade.price);
      expect(parseFloat(sellTrade.pnl)).to.be.lessThan(0);

      // Overall PnL should be negative
      expect(result.totalPnl).to.be.lessThan(0);
      expect(result.losses).to.be.greaterThan(0);
      expect(result.winRate).to.equal(0);
    });

    /**
     * Scenario: Custom capital scales proportionally
     * Using same winning trade data but with $50,000 start
     * Expected: 50000 / 105 * 240 = $114285.71, PnL still +128.57%
     */
    it("should scale capital proportionally while PnL percentage stays the same", () => {
      const candles = makeCandlesWithCrossover();

      const result10k = backtestService.run(candles, 150, 10000);
      const result50k = backtestService.run(candles, 150, 50000);

      // PnL % should be identical regardless of starting capital
      expect(result10k.totalPnl).to.equal(result50k.totalPnl);
      expect(result10k.totalPnl).to.equal(128.57);

      // But absolute values scale proportionally
      expect(result50k.finalValue).to.equal(114285.71);
      expect(result50k.finalValue).to.be.closeTo(result10k.finalValue * 5, 0.02);
    });

    /**
     * Scenario: Max drawdown calculation
     * After buying at 105 during the uptrend, price continues to 250.
     * Then price drops from 250 back down — drawdown is tracked from the peak.
     */
    it("should calculate max drawdown from peak portfolio value", () => {
      const candles = makeCandlesWithCrossover();
      const result = backtestService.run(candles, 150);

      // Drawdown should be > 0 (the price drops after hitting 250 before selling at 240)
      expect(result.maxDrawdown).to.be.greaterThan(0);
      // Drawdown should be calculated as (peak - trough) / peak * 100
      // Peak portfolio value is at price 250: 10000/105 * 250 = 23809.52
      // Trough before sell is at price 240: 10000/105 * 240 = 22857.14
      // Drawdown = (23809.52 - 22857.14) / 23809.52 * 100 = 4.0%
      expect(result.maxDrawdown).to.equal(4);
    });
  });

  // --- checkUsageLimit ---
  describe("checkUsageLimit()", () => {
    it("should allow usage when under limit", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.resolves(1);

      const result = await backtestService.checkUsageLimit("123");
      expect(result.allowed).to.be.true;
      expect(result.used).to.equal(1);
      expect(result.limit).to.equal(3);
    });

    it("should deny usage when at limit", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.resolves(3);

      const result = await backtestService.checkUsageLimit("123");
      expect(result.allowed).to.be.false;
      expect(result.used).to.equal(3);
      expect(result.limit).to.equal(3);
    });

    it("should return unlimited for pro tier (null limit)", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'pro' });

      const result = await backtestService.checkUsageLimit("123");
      expect(result.allowed).to.be.true;
      expect(result.limit).to.be.null;
      // Should NOT call getBacktestUsageCount for unlimited
      expect(subscriberServiceStub.getBacktestUsageCount.called).to.be.false;
    });

    it("should default to free tier for unknown/no tier", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: undefined });

      const result = await backtestService.checkUsageLimit("123");
      // Free tier has backtestLimit: 0
      expect(result.allowed).to.be.false;
      expect(result.limit).to.equal(0);
    });
  });

  // --- execute (orchestration) ---
  describe("execute()", () => {
    it("should run full backtest and return result + usage", async () => {
      const candles = makeCandlesWithCrossover();
      backtestService.binanceService.getHistoricalPrices.resolves(candles);
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.onFirstCall().resolves(0).onSecondCall().resolves(1);

      const { result, usage } = await backtestService.execute("123", "BTC/USDT", 150);

      expect(result.symbol).to.equal("BTC/USDT");
      expect(result.totalTrades).to.be.greaterThan(0);
      expect(usage.used).to.equal(1);
      expect(usage.limit).to.equal(3);
      expect(subscriberServiceStub.recordBacktestUsage.calledOnce).to.be.true;
    });

    it("should throw LIMIT_EXCEEDED when limit reached", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.resolves(3);

      try {
        await backtestService.execute("123", "BTC/USDT", 180);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.code).to.equal('LIMIT_EXCEEDED');
        expect(err.used).to.equal(3);
        expect(err.limit).to.equal(3);
      }
    });

    it("should throw NO_DATA when no candles returned", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.resolves(0);
      backtestService.binanceService.getHistoricalPrices.resolves(null);

      try {
        await backtestService.execute("123", "INVALID/USDT", 180);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.code).to.equal('NO_DATA');
      }
    });

    it("should not record usage when limit exceeded", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.resolves(3);

      try {
        await backtestService.execute("123", "BTC/USDT", 180);
      } catch (err) {
        // expected
      }
      expect(subscriberServiceStub.recordBacktestUsage.called).to.be.false;
    });

    it("should not record usage when data fetch fails", async () => {
      subscriberServiceStub.getSubscriber.resolves({ tier: 'premium' });
      subscriberServiceStub.getBacktestUsageCount.resolves(0);
      backtestService.binanceService.getHistoricalPrices.resolves(null);

      try {
        await backtestService.execute("123", "XYZ/USDT", 180);
      } catch (err) {
        // expected
      }
      expect(subscriberServiceStub.recordBacktestUsage.called).to.be.false;
    });
  });
});
