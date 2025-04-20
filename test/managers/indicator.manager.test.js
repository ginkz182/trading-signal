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
      calculateMACD: sinon.stub(),
      checkZeroCross: sinon.stub(),
    };

    // Create indicator manager instance
    indicatorManager = new IndicatorManager();

    // Replace the real technical service with our mock
    indicatorManager.technicalService = mockTechnicalService;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("_calculateEMA()", () => {
    it("should calculate EMA correctly", () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const period = 5;

      const emaValues = indicatorManager._calculateEMA(prices, period);

      // Check initial EMA (should be SMA of first 5 values)
      expect(emaValues[0]).to.equal((10 + 11 + 12 + 13 + 14) / 5);

      // Check length of returned array
      expect(emaValues.length).to.equal(prices.length - period + 1);

      // Manually calculate a few more values to verify
      const multiplier = 2 / (period + 1);
      let expectedEma = emaValues[0];

      expectedEma = (prices[5] - expectedEma) * multiplier + expectedEma;
      expect(emaValues[1]).to.be.closeTo(expectedEma, 0.0001);

      expectedEma = (prices[6] - expectedEma) * multiplier + expectedEma;
      expect(emaValues[2]).to.be.closeTo(expectedEma, 0.0001);
    });

    it("should handle minimum required data", () => {
      const prices = [10, 11, 12];
      const period = 3;

      const emaValues = indicatorManager._calculateEMA(prices, period);

      expect(emaValues.length).to.equal(1);
      expect(emaValues[0]).to.equal((10 + 11 + 12) / 3);
    });
  });

  describe("_calculateMACDSignal()", () => {
    it("should return correct signal based on MACD values", () => {
      const prices = [100, 101, 102, 103, 104, 105];
      const macdValues = [{ MACD: -0.5 }, { MACD: 0.2 }, { MACD: 0.7 }];

      mockTechnicalService.calculateMACD.returns(macdValues);
      mockTechnicalService.checkZeroCross.returns("BUY");

      const result = indicatorManager._calculateMACDSignal(prices);

      expect(mockTechnicalService.calculateMACD.calledWith(prices)).to.be.true;
      expect(mockTechnicalService.checkZeroCross.calledWith(macdValues)).to.be
        .true;

      expect(result.signal).to.equal("BUY");
      expect(result.macd).to.equal(0.7); // Last MACD value
    });
  });

  describe("_calculateCDCActionZone()", () => {
    it("should return HOLD when insufficient data provided", () => {
      const prices = Array(5).fill(100); // Not enough data points

      const result = indicatorManager._calculateCDCActionZone(prices);

      expect(result.signal).to.equal("HOLD");
      expect(result.zone).to.equal("UNKNOWN");
    });

    it("should identify GREEN zone (BUY signal)", () => {
      // Create an array of 30 prices
      const prices = Array(30).fill(100);
      prices[prices.length - 1] = 120; // Current price
      prices[prices.length - 2] = 95; // Previous price

      // ONLY stub, don't spy - we're replacing the implementation
      sinon
        .stub(indicatorManager, "_calculateEMA")
        .callsFake((data, period) => {
          if (period === indicatorManager.cdcConfig.fastPeriod) {
            return [105, 110]; // Previous and current fast EMA
          } else {
            return [95, 100]; // Previous and current slow EMA
          }
        });

      const result = indicatorManager._calculateCDCActionZone(prices);

      expect(result.zone).to.equal("GREEN");
      expect(result.isBull).to.be.true;
      expect(result.isBear).to.be.false;
      expect(result.signal).to.equal("BUY"); // Should be BUY since isGreen && !wasGreen
    });

    it("should identify RED zone (SELL signal)", () => {
      // Create an array of 30 prices
      const prices = Array(30).fill(100);
      prices[prices.length - 1] = 80; // Current price
      prices[prices.length - 2] = 105; // Previous price

      // Create a new stub for each test to avoid conflicts
      const calculateEMAStub = sinon.stub(indicatorManager, "_calculateEMA");
      calculateEMAStub.callsFake((data, period) => {
        if (period === indicatorManager.cdcConfig.fastPeriod) {
          return [95, 90]; // Previous and current fast EMA
        } else {
          return [105, 100]; // Previous and current slow EMA
        }
      });

      const result = indicatorManager._calculateCDCActionZone(prices);

      expect(result.zone).to.equal("RED");
      expect(result.isBull).to.be.false;
      expect(result.isBear).to.be.true;
      expect(result.signal).to.equal("SELL"); // Should be SELL since isRed && !wasRed
    });

    it("should identify BLUE zone (Pre Buy 2)", () => {
      // Create an array of 30 prices
      const prices = Array(30).fill(100);
      prices[prices.length - 1] = 115; // Current price > fast EMA & slow EMA

      // Create a new stub for each test to avoid conflicts
      const calculateEMAStub = sinon.stub(indicatorManager, "_calculateEMA");
      calculateEMAStub.callsFake((data, period) => {
        if (period === indicatorManager.cdcConfig.fastPeriod) {
          return [95, 95]; // Fast EMA stays the same
        } else {
          return [110, 110]; // Slow EMA stays the same
        }
      });

      const result = indicatorManager._calculateCDCActionZone(prices);

      expect(result.zone).to.equal("BLUE");
      expect(result.isBull).to.be.false;
      expect(result.isBear).to.be.true;
      expect(result.signal).to.equal("HOLD"); // No change in condition
    });

    it("should maintain HOLD signal when no crossover occurs", () => {
      // Create an array of 30 prices with no significant changes
      const prices = Array(30).fill(100);

      // Create a new stub for each test to avoid conflicts
      const calculateEMAStub = sinon.stub(indicatorManager, "_calculateEMA");
      calculateEMAStub.callsFake((data, period) => {
        if (period === indicatorManager.cdcConfig.fastPeriod) {
          return [105, 105]; // No change in fast EMA
        } else {
          return [95, 95]; // No change in slow EMA
        }
      });

      const result = indicatorManager._calculateCDCActionZone(prices);

      expect(result.signal).to.equal("HOLD");
    });
  });

  describe("analyzePrice()", () => {
    it("should combine CDC Action Zone and MACD signals", () => {
      const prices = Array(30).fill(100);

      // Create separate stubs for each test
      const cdcStub = sinon.stub(indicatorManager, "_calculateCDCActionZone");
      const macdStub = sinon.stub(indicatorManager, "_calculateMACDSignal");

      cdcStub.returns({
        signal: "BUY",
        zone: "GREEN",
        isBull: true,
        isBear: false,
        fastEMA: 105,
        slowEMA: 100,
        technicalData: { buyCond: true, sellCond: false },
      });

      macdStub.returns({
        signal: "BUY",
        macd: 1.5,
      });

      const result = indicatorManager.analyzePrice(prices);

      expect(result.signal).to.equal("BUY");
      expect(result.zone).to.equal("GREEN");
      expect(result.macd).to.equal(1.5);
      expect(result.isBull).to.be.true;
      expect(result.isBear).to.be.false;
      expect(result.fastEMA).to.equal(105);
      expect(result.slowEMA).to.equal(100);
      expect(result.details).to.exist;
    });

    it("should prioritize CDC Action Zone signals over MACD", () => {
      const prices = Array(30).fill(100);

      // Create new stubs for this test to avoid conflict
      const cdcStub = sinon.stub(indicatorManager, "_calculateCDCActionZone");
      const macdStub = sinon.stub(indicatorManager, "_calculateMACDSignal");

      // CDC says SELL but MACD says BUY
      cdcStub.returns({
        signal: "SELL",
        zone: "RED",
        isBull: false,
        isBear: true,
        fastEMA: 95,
        slowEMA: 100,
        technicalData: { buyCond: false, sellCond: true },
      });

      macdStub.returns({
        signal: "BUY",
        macd: 0.5,
      });

      const result = indicatorManager.analyzePrice(prices);

      // Should prioritize CDC signal
      expect(result.signal).to.equal("SELL");
      expect(result.zone).to.equal("RED");
      // But should still include MACD data
      expect(result.macd).to.equal(0.5);
    });
  });
});
