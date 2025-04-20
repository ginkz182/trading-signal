const { expect } = require("chai");
const sinon = require("sinon");
const IndicatorManager = require("../../src/managers/indicator.manager");
const TechnicalService = require("../../src/services/technical.service");

describe("IndicatorManager", () => {
  let indicatorManager;
  let mockTechnicalService;

  beforeEach(() => {
    // Create a stub for TechnicalService
    mockTechnicalService = {
      calculateEmaCrossoverSignal: sinon.stub(),
    };

    // Create indicator manager instance
    indicatorManager = new IndicatorManager();

    // Replace the real technical service with our mock
    indicatorManager.technicalService = mockTechnicalService;
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
    });
  });

  describe("resetZones()", () => {
    it("should exist but not do anything in simplified version", () => {
      // Just make sure the method exists and doesn't throw
      expect(() => indicatorManager.resetZones()).to.not.throw();
    });
  });
});
