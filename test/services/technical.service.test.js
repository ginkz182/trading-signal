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

  describe("calculateMACD()", () => {
    it("should calculate MACD values for sufficient data", () => {
      // Generate sample price data - uptrend then downtrend
      const prices = [];
      for (let i = 0; i < 40; i++) {
        if (i < 20) {
          prices.push(100 + i); // Uptrend
        } else {
          prices.push(120 - (i - 20)); // Downtrend
        }
      }

      const macdResult = technicalService.calculateMACD(prices);

      // Basic validation
      expect(macdResult).to.be.an("array");
      expect(macdResult.length).to.be.greaterThan(0);

      // Check structure of MACD result
      const lastMacd = macdResult[macdResult.length - 1];
      expect(lastMacd).to.have.property("MACD");
      expect(lastMacd).to.have.property("signal");
      expect(lastMacd).to.have.property("histogram");

      // Check trend direction - after downtrend, MACD should be negative
      expect(lastMacd.MACD).to.be.lessThan(0);
    });

    it("should handle insufficient data gracefully", () => {
      // Create very small price array
      const prices = [100, 101, 102];

      // Should not throw an error
      expect(() => {
        const result = technicalService.calculateMACD(prices);

        if (result) {
          expect(result).to.be.an("array");
        }
      }).to.not.throw();
    });

    it("should handle linear uptrend correctly", () => {
      // Generate linearly increasing prices
      const prices = [];
      for (let i = 0; i < 40; i++) {
        prices.push(100 + i);
      }

      const macdResult = technicalService.calculateMACD(prices);
      const lastMacd = macdResult[macdResult.length - 1];

      // In a linear uptrend, MACD should be positive
      expect(lastMacd.MACD).to.be.greaterThan(0);
    });

    it("should handle linear downtrend correctly", () => {
      // Generate linearly decreasing prices
      const prices = [];
      for (let i = 0; i < 40; i++) {
        prices.push(140 - i);
      }

      const macdResult = technicalService.calculateMACD(prices);
      const lastMacd = macdResult[macdResult.length - 1];

      // In a linear downtrend, MACD should be negative
      expect(lastMacd.MACD).to.be.lessThan(0);
    });
  });

  describe("checkZeroCross()", () => {
    it("should detect BUY signal when MACD crosses above zero", () => {
      const macdValues = [
        { MACD: -1.5 },
        { MACD: -0.5 },
        { MACD: 0.5 }, // Crosses above zero here
      ];

      const signal = technicalService.checkZeroCross(macdValues);

      expect(signal).to.equal("BUY");
    });

    it("should detect SELL signal when MACD crosses below zero", () => {
      const macdValues = [
        { MACD: 1.5 },
        { MACD: 0.5 },
        { MACD: -0.5 }, // Crosses below zero here
      ];

      const signal = technicalService.checkZeroCross(macdValues);

      expect(signal).to.equal("SELL");
    });

    it("should return HOLD when MACD doesn't cross zero", () => {
      // All positive values
      const macdValues1 = [{ MACD: 1.5 }, { MACD: 1.8 }, { MACD: 2.0 }];

      expect(technicalService.checkZeroCross(macdValues1)).to.equal("HOLD");

      // All negative values
      const macdValues2 = [{ MACD: -1.5 }, { MACD: -1.8 }, { MACD: -2.0 }];

      expect(technicalService.checkZeroCross(macdValues2)).to.equal("HOLD");
    });

    it("should handle exact zero MACD value", () => {
      // Test crossing from negative to exactly zero
      const macdValues1 = [
        { MACD: -1.5 },
        { MACD: -0.5 },
        { MACD: 0 }, // Exactly zero
      ];

      // This depends on how your implementation handles exact zero,
      // but it should be either BUY or HOLD, not SELL
      const signal1 = technicalService.checkZeroCross(macdValues1);
      expect(["BUY", "HOLD"]).to.include(signal1);

      // Test crossing from positive to exactly zero
      const macdValues2 = [
        { MACD: 1.5 },
        { MACD: 0.5 },
        { MACD: 0 }, // Exactly zero
      ];

      // This should be either SELL or HOLD, not BUY
      const signal2 = technicalService.checkZeroCross(macdValues2);
      expect(["SELL", "HOLD"]).to.include(signal2);
    });

    it("should handle minimal data input", () => {
      const macdValues = [{ MACD: 1.5 }];

      // With only one data point, no cross can be detected
      expect(technicalService.checkZeroCross(macdValues)).to.equal("HOLD");
    });
  });
});
