const { expect } = require("chai");
const sinon = require("sinon");
const IndicatorManager = require("../../src/managers/indicator.manager");
const TechnicalService = require("../../src/services/technical.service");
const PatternService = require("../../src/services/pattern.service");

describe("IndicatorManager", () => {
  let indicatorManager;
  let mockTechnicalService;
  let mockPatternService;

  beforeEach(() => {
    // Create a stub for TechnicalService
    mockTechnicalService = {
      calculateEmaCrossoverSignal: sinon.stub(),
    };

    // Create a stub for PatternService
    mockPatternService = {
      detectTriangles: sinon.stub(),
      config: { minBars: 20 },
    };

    // Create indicator manager instance
    indicatorManager = new IndicatorManager();

    // Replace the real services with our mocks
    indicatorManager.technicalService = mockTechnicalService;
    indicatorManager.patternService = mockPatternService;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("analyzePrice()", () => {
    it("should return BUY signal from EMA crossover", () => {
      const prices = Array(30).fill(100);
      const symbol = "BTC/USDT";

      // Mock the EMA crossover signal to return BUY
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "BUY",
        fastEMA: 105,
        slowEMA: 100,
        isBull: true,
        isBear: false,
      });

      const result = indicatorManager.analyzePrice(prices, symbol);

      expect(
        mockTechnicalService.calculateEmaCrossoverSignal.calledWith(prices)
      ).to.be.true;
      expect(result.signal).to.equal("BUY");
      expect(result.fastEMA).to.equal(105);
      expect(result.slowEMA).to.equal(100);
      expect(result.isBull).to.be.true;
      expect(result.isBear).to.be.false;
      expect(result.details).to.exist;
      expect(result.details.emaCrossover).to.exist;
    });

    it("should return SELL signal from EMA crossover", () => {
      const prices = Array(30).fill(100);
      const symbol = "BTC/USDT";

      // Mock the EMA crossover signal to return SELL
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "SELL",
        fastEMA: 95,
        slowEMA: 100,
        isBull: false,
        isBear: true,
      });

      const result = indicatorManager.analyzePrice(prices, symbol);

      expect(
        mockTechnicalService.calculateEmaCrossoverSignal.calledWith(prices)
      ).to.be.true;
      expect(result.signal).to.equal("SELL");
      expect(result.fastEMA).to.equal(95);
      expect(result.slowEMA).to.equal(100);
      expect(result.isBull).to.be.false;
      expect(result.isBear).to.be.true;
    });

    it("should return HOLD signal when no EMA crossover is detected", () => {
      const prices = Array(30).fill(100);
      const symbol = "BTC/USDT";

      // Mock the EMA crossover signal to return HOLD
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "HOLD",
        fastEMA: 105,
        slowEMA: 100,
        isBull: true,
        isBear: false,
      });

      const result = indicatorManager.analyzePrice(prices, symbol);

      expect(result.signal).to.equal("HOLD");
    });

    it("should handle insufficient data", () => {
      const prices = Array(5).fill(100); // Not enough data points
      const symbol = "BTC/USDT";

      const result = indicatorManager.analyzePrice(prices, symbol);

      expect(result.signal).to.equal("HOLD");
      expect(result.fastEMA).to.be.null;
      expect(result.slowEMA).to.be.null;
      expect(result.pattern).to.be.null;
    });

    it("should analyze patterns when OHLCV data is provided", () => {
      const marketData = {
        prices: Array(30).fill(100),
        ohlcv: Array(25).fill([1234567890, 100, 105, 95, 102, 1000])
      };
      const symbol = "BTC/USDT";

      // Mock EMA signal
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "BUY",
        fastEMA: 105,
        slowEMA: 100,
        isBull: true,
        isBear: false,
      });

      // Mock pattern detection
      mockPatternService.detectTriangles.returns({
        pattern: "ASCENDING_TRIANGLE",
        confidence: 75,
        direction: "BULLISH",
        breakout: { status: "FORMING" },
        tradingPlan: { alerts: [{ message: "Watch for breakout above 110" }] }
      });

      const result = indicatorManager.analyzePrice(marketData, symbol);

      expect(mockPatternService.detectTriangles.calledWith(marketData.ohlcv, symbol)).to.be.true;
      expect(result.pattern).to.exist;
      expect(result.pattern.pattern).to.equal("ASCENDING_TRIANGLE");
      expect(result.details.pattern).to.exist;
      
      // Should return separate EMA and pattern signals
      expect(result.signal).to.equal("BUY"); // EMA signal
      expect(result.pattern.pattern).to.equal("ASCENDING_TRIANGLE"); // Pattern signal
    });


    it("should handle pattern analysis errors gracefully", () => {
      const marketData = {
        prices: Array(30).fill(100),
        ohlcv: Array(25).fill([1234567890, 100, 105, 95, 102, 1000])
      };
      const symbol = "BTC/USDT";

      // Mock EMA signal
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "HOLD",
        fastEMA: 102,
        slowEMA: 101,
        isBull: false,
        isBear: false,
      });

      // Mock pattern service to throw error
      mockPatternService.detectTriangles.throws(new Error("Pattern analysis failed"));

      const result = indicatorManager.analyzePrice(marketData, symbol);

      expect(result.signal).to.equal("HOLD"); // Should still work with EMA
      expect(result.pattern).to.exist;
      expect(result.pattern.reason).to.equal("Analysis error");
    });

    it("should skip pattern analysis when patterns are disabled", () => {
      const marketData = {
        prices: Array(30).fill(100),
        ohlcv: Array(25).fill([1234567890, 100, 105, 95, 102, 1000])
      };
      const symbol = "BTC/USDT";

      // Disable patterns
      indicatorManager.enablePatterns = false;

      // Mock EMA signal
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "BUY",
        fastEMA: 105,
        slowEMA: 100,
        isBull: true,
        isBear: false,
      });

      const result = indicatorManager.analyzePrice(marketData, symbol);

      expect(mockPatternService.detectTriangles.called).to.be.false;
      expect(result.pattern).to.be.null;
      expect(result.signal).to.equal("BUY");
    });

    it("should work with backward compatibility for price arrays", () => {
      const prices = Array(30).fill(100);
      const symbol = "BTC/USDT";

      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "HOLD",
        fastEMA: 102,
        slowEMA: 101,
        isBull: false,
        isBear: false,
      });

      const result = indicatorManager.analyzePrice(prices, symbol);

      expect(mockPatternService.detectTriangles.called).to.be.false; // No OHLCV data
      expect(result.pattern).to.be.null;
      expect(result.signal).to.equal("HOLD");
    });

    it("should return separate signals without combination", () => {
      const marketData = {
        prices: Array(30).fill(100),
        ohlcv: Array(25).fill([1234567890, 100, 105, 95, 102, 1000])
      };
      const symbol = "BTC/USDT";

      // Mock EMA BUY signal
      mockTechnicalService.calculateEmaCrossoverSignal.returns({
        signal: "BUY",
        fastEMA: 105,
        slowEMA: 100,
        isBull: true,
        isBear: false,
      });

      // Mock pattern detection
      mockPatternService.detectTriangles.returns({
        pattern: "ASCENDING_TRIANGLE",
        confidence: 75,
        direction: "BULLISH",
        breakout: { status: "FORMING" }
      });

      const result = indicatorManager.analyzePrice(marketData, symbol);

      // Should return EMA signal as primary signal
      expect(result.signal).to.equal("BUY");
      expect(result.isBull).to.be.true;
      expect(result.isBear).to.be.false;
      
      // Should include pattern as separate analysis
      expect(result.pattern).to.exist;
      expect(result.pattern.pattern).to.equal("ASCENDING_TRIANGLE");
      
      // Should NOT have combined confidence/reasoning
      expect(result.details.combined).to.not.exist;
    });
  });

  describe("resetZones()", () => {
    it("should exist but not do anything in simplified version", () => {
      // Just make sure the method exists and doesn't throw
      expect(() => indicatorManager.resetZones()).to.not.throw();
    });
  });
});
