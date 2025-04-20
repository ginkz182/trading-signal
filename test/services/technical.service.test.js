const { expect } = require("chai");
const sinon = require("sinon");
const TechnicalService = require("../../src/services/technical.service");

describe("TechnicalService", () => {
  let technicalService;

  beforeEach(() => {
    technicalService = new TechnicalService();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("calculateEMA()", () => {
    it("should calculate EMA values for sufficient data", () => {
      // Generate sample price data - uptrend
      const prices = [];
      for (let i = 0; i < 40; i++) {
        prices.push(100 + i);
      }

      const emaResult = technicalService.calculateEMA(prices, 12);

      // Basic validation
      expect(emaResult).to.be.an("array");
      expect(emaResult.length).to.be.greaterThan(0);

      // Check first EMA value (should be SMA of first 12 values)
      const expectedFirstEMA =
        prices.slice(0, 12).reduce((sum, price) => sum + price, 0) / 12;
      expect(emaResult[0]).to.be.closeTo(expectedFirstEMA, 0.0001);

      // Check that EMA follows the trend direction
      expect(emaResult[emaResult.length - 1]).to.be.greaterThan(emaResult[0]);
    });

    it("should handle insufficient data gracefully", () => {
      // Create very small price array
      const prices = [100, 101, 102];
      const period = 12;

      // Should not throw an error
      const result = technicalService.calculateEMA(prices, period);
      // With insufficient data, we should get an empty array
      expect(result).to.be.an("array");
      expect(result.length).to.equal(0);
    });

    it("should handle exact minimum data required", () => {
      // Create price array with exactly the required period length
      const prices = [
        100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
      ];
      const period = 12;

      const result = technicalService.calculateEMA(prices, period);

      expect(result).to.be.an("array");
      expect(result.length).to.equal(1);
      expect(result[0]).to.equal(
        prices.reduce((sum, price) => sum + price, 0) / period
      );
    });
  });

  describe("checkEmaCrossover()", () => {
    it("should detect BUY signal when fast EMA crosses above slow EMA", () => {
      const fastEMA = [10, 11, 12]; // Rising fast EMA
      const slowEMA = [12, 11.5, 11]; // Falling slow EMA

      // Previous: fastEMA < slowEMA, Current: fastEMA > slowEMA
      const signal = technicalService.checkEmaCrossover(fastEMA, slowEMA);

      expect(signal).to.equal("BUY");
    });

    it("should detect SELL signal when fast EMA crosses below slow EMA", () => {
      const fastEMA = [12, 11, 10]; // Falling fast EMA
      const slowEMA = [10, 10.5, 11]; // Rising slow EMA

      // Previous: fastEMA > slowEMA, Current: fastEMA < slowEMA
      const signal = technicalService.checkEmaCrossover(fastEMA, slowEMA);

      expect(signal).to.equal("SELL");
    });

    it("should return HOLD when EMAs don't cross", () => {
      // Fast EMA always above slow EMA
      const fastEMA1 = [12, 13, 14];
      const slowEMA1 = [10, 11, 12];

      expect(technicalService.checkEmaCrossover(fastEMA1, slowEMA1)).to.equal(
        "HOLD"
      );

      // Fast EMA always below slow EMA
      const fastEMA2 = [8, 9, 10];
      const slowEMA2 = [12, 13, 14];

      expect(technicalService.checkEmaCrossover(fastEMA2, slowEMA2)).to.equal(
        "HOLD"
      );
    });

    it("should handle minimal data input", () => {
      const fastEMA = [12];
      const slowEMA = [10];

      // With only one data point, no cross can be detected
      expect(technicalService.checkEmaCrossover(fastEMA, slowEMA)).to.equal(
        "HOLD"
      );
    });
  });

  describe("calculateEmaCrossoverSignal()", () => {
    it("should return BUY signal for uptrend crossover", () => {
      // Create sample prices that would generate an uptrend crossover
      const prices = [];
      // First create a downtrend
      for (let i = 0; i < 20; i++) {
        prices.push(120 - i);
      }
      // Then create an uptrend that would trigger crossover
      for (let i = 0; i < 20; i++) {
        prices.push(100 + i * 2);
      }

      const result = technicalService.calculateEmaCrossoverSignal(prices);

      expect(result.signal).to.equal("BUY");
      expect(result.isBull).to.be.true;
      expect(result.isBear).to.be.false;
      expect(result.fastEMA).to.be.greaterThan(result.slowEMA);
    });

    it("should return SELL signal for downtrend crossover", () => {
      // Create sample prices that would generate a downtrend crossover
      const prices = [];
      // First create an uptrend
      for (let i = 0; i < 20; i++) {
        prices.push(100 + i);
      }
      // Then create a downtrend that would trigger crossover
      for (let i = 0; i < 20; i++) {
        prices.push(120 - i * 2);
      }

      const result = technicalService.calculateEmaCrossoverSignal(prices);

      expect(result.signal).to.equal("SELL");
      expect(result.isBull).to.be.false;
      expect(result.isBear).to.be.true;
      expect(result.fastEMA).to.be.lessThan(result.slowEMA);
    });

    it("should return HOLD when no crossover is detected", () => {
      // Create sample prices in a steady uptrend (no crossover)
      const prices = [];
      for (let i = 0; i < 40; i++) {
        prices.push(100 + i);
      }

      const result = technicalService.calculateEmaCrossoverSignal(prices);

      // In a steady uptrend, fast EMA should always be above slow EMA, no crossover
      expect(result.signal).to.equal("HOLD");
      expect(result.fastEMA).to.be.greaterThan(result.slowEMA);
    });

    it("should handle insufficient data", () => {
      // Create very small price array
      const prices = [100, 101, 102];

      const result = technicalService.calculateEmaCrossoverSignal(prices);

      expect(result.signal).to.equal("HOLD");
      expect(result.fastEMA).to.be.null;
      expect(result.slowEMA).to.be.null;
    });
  });
});
