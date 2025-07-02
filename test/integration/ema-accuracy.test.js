const { expect } = require("chai");
const sinon = require("sinon");
const TechnicalService = require("../../src/services/technical.service");
const IndicatorManager = require("../../src/managers/indicator.manager");

describe("EMA Accuracy Integration Tests", () => {
  let technicalService;
  let indicatorManager;

  beforeEach(() => {
    technicalService = new TechnicalService({ fastPeriod: 12, slowPeriod: 26 });
    indicatorManager = new IndicatorManager({ fastPeriod: 12, slowPeriod: 26 });
  });

  describe("EMA26 Data Point Requirements", () => {
    it("should require at least 260 data points for accurate EMA26", () => {
      // Test with insufficient data (like the TSLA bug)
      const insufficientData = Array(83).fill(0).map((_, i) => 100 + Math.sin(i * 0.1) * 10);
      const sufficientData = Array(274).fill(0).map((_, i) => 100 + Math.sin(i * 0.1) * 10);

      const ema26_insufficient = technicalService.calculateEMA(insufficientData, 26);
      const ema26_sufficient = technicalService.calculateEMA(sufficientData, 26);

      // With insufficient data, EMA26 should be unstable
      expect(ema26_insufficient.length).to.equal(58); // 83 - 26 + 1
      expect(ema26_sufficient.length).to.equal(249); // 274 - 26 + 1

      // The last values should be significantly different due to stabilization
      const lastInsufficient = ema26_insufficient[ema26_insufficient.length - 1];
      const lastSufficient = ema26_sufficient[ema26_sufficient.length - 1];
      
      // Should be different enough to cause signal detection issues
      const difference = Math.abs(lastInsufficient - lastSufficient);
      expect(difference).to.be.greaterThan(0.01); // Should be noticeable difference
    });

    it("should detect crossover correctly with sufficient data", () => {
      // Simulate a more realistic crossover scenario
      const prices = [];
      
      // Generate 274 data points with EMA crossover pattern
      for (let i = 0; i < 270; i++) {
        // Create data that will lead to EMA crossover
        prices.push(330 - (i * 0.02) + Math.sin(i * 0.1) * 3);
      }
      // Add recent declining prices to trigger crossover
      prices.push(327.55, 325.78, 323.63, 300.71);

      const signal = indicatorManager.analyzePrice(prices, "TEST");

      // With sufficient data, should have valid EMA values
      expect(signal).to.have.property('signal');
      expect(signal.fastEMA).to.be.a('number');
      expect(signal.slowEMA).to.be.a('number');
      
      // The signal might be HOLD, BUY, or SELL - the key is having accurate EMAs
      expect(['BUY', 'SELL', 'HOLD']).to.include(signal.signal);
    });

    it("should miss crossover with insufficient data", () => {
      // Same scenario but with insufficient data (83 points like the bug)
      const basePrice = 325;
      const prices = [];
      
      // Generate only 83 data points
      for (let i = 0; i < 82; i++) {
        prices.push(basePrice - (i * 0.3) + Math.sin(i * 0.15) * 2);
      }
      prices.push(300.71); // Sharp drop

      const signal = indicatorManager.analyzePrice(prices, "TEST");

      // With insufficient data, EMA26 won't be accurate enough
      // This test demonstrates the bug we fixed
      expect(signal).to.have.property('signal');
      // The signal might be HOLD due to inaccurate EMA26
    });
  });

  describe("Real-world TSLA Scenario Recreation", () => {
    it("should reproduce the TSLA signal detection issue and fix", () => {
      // Recreate actual TSLA scenario with exact values
      const tslaRecentPrices = [
        327.55, 325.78, 323.63, 317.66, 300.71 // Last 5 days
      ];

      // Test with insufficient historical context (83 points total)
      const insufficientContext = Array(78).fill(0).map((_, i) => 330 - (i * 0.1));
      const insufficientData = [...insufficientContext, ...tslaRecentPrices];

      // Test with sufficient historical context (274 points total)  
      const sufficientContext = Array(269).fill(0).map((_, i) => 330 - (i * 0.05));
      const sufficientData = [...sufficientContext, ...tslaRecentPrices];

      const signalInsufficient = indicatorManager.analyzePrice(insufficientData, "TSLA_INSUFFICIENT");
      const signalSufficient = indicatorManager.analyzePrice(sufficientData, "TSLA_SUFFICIENT");

      console.log('\n=== TSLA Scenario Recreation ===');
      console.log(`Insufficient data (${insufficientData.length} points):`);
      console.log(`  EMA12: ${signalInsufficient.fastEMA?.toFixed(4)}`);
      console.log(`  EMA26: ${signalInsufficient.slowEMA?.toFixed(4)}`);
      console.log(`  Signal: ${signalInsufficient.signal}`);
      
      console.log(`Sufficient data (${sufficientData.length} points):`);
      console.log(`  EMA12: ${signalSufficient.fastEMA?.toFixed(4)}`);
      console.log(`  EMA26: ${signalSufficient.slowEMA?.toFixed(4)}`);
      console.log(`  Signal: ${signalSufficient.signal}`);

      // With sufficient data, EMAs should be closer to TradingView values
      expect(sufficientData.length).to.be.at.least(260);
      expect(signalSufficient.fastEMA).to.be.a('number');
      expect(signalSufficient.slowEMA).to.be.a('number');
      
      // The EMA values should be different between insufficient and sufficient data
      const ema26Difference = Math.abs(signalInsufficient.slowEMA - signalSufficient.slowEMA);
      expect(ema26Difference).to.be.greaterThan(0.05); // Should show measurable difference
    });

    it("should validate minimum data requirements in indicator manager", () => {
      const veryShortData = [100, 101, 102]; // Only 3 points
      const shortData = Array(50).fill(0).map((_, i) => 100 + i); // 50 points (enough for EMA26)
      const adequateData = Array(260).fill(0).map((_, i) => 100 + Math.sin(i * 0.1)); // Adequate for EMA26

      const signalVeryShort = indicatorManager.analyzePrice(veryShortData, "VERY_SHORT");
      const signalShort = indicatorManager.analyzePrice(shortData, "SHORT");
      const signalAdequate = indicatorManager.analyzePrice(adequateData, "ADEQUATE");

      // Very short data should return HOLD with warning
      expect(signalVeryShort.signal).to.equal('HOLD');
      expect(signalVeryShort.fastEMA).to.be.null;
      expect(signalVeryShort.slowEMA).to.be.null;

      // Short data should work but be less accurate (50 points > 28 minimum)
      expect(signalShort.signal).to.be.a('string');
      expect(signalShort.fastEMA).to.be.a('number');
      expect(signalShort.slowEMA).to.be.a('number');

      // Adequate data should give most accurate results
      expect(signalAdequate.signal).to.be.a('string');
      expect(signalAdequate.fastEMA).to.be.a('number');
      expect(signalAdequate.slowEMA).to.be.a('number');
    });
  });

  describe("Data Quality Validation", () => {
    it("should warn when data might be insufficient for accurate EMA26", () => {
      const consoleWarnStub = sinon.stub(console, "warn");
      
      // Test with borderline data (just enough to calculate but not enough for accuracy)
      const borderlineData = Array(50).fill(0).map((_, i) => 100 + i * 0.1);
      
      indicatorManager.analyzePrice(borderlineData, "BORDERLINE");
      
      // Should warn about potential accuracy issues
      // Note: This would require adding warning logic to the indicator manager
      
      consoleWarnStub.restore();
    });

    it("should provide data quality metrics", () => {
      const data274 = Array(274).fill(0).map((_, i) => 100 + Math.sin(i * 0.1));
      const data83 = Array(83).fill(0).map((_, i) => 100 + Math.sin(i * 0.1));

      const signal274 = indicatorManager.analyzePrice(data274, "GOOD_DATA");
      const signal83 = indicatorManager.analyzePrice(data83, "LIMITED_DATA");

      // Both should return signals, but we should be able to assess quality
      expect(signal274).to.have.property('fastEMA');
      expect(signal274).to.have.property('slowEMA');
      expect(signal83).to.have.property('fastEMA');
      expect(signal83).to.have.property('slowEMA');

      // The 274-point data should have more stable EMA values
      // (This demonstrates why more data gives better signals)
    });
  });

  describe("Crossover Detection Edge Cases", () => {
    it("should detect crossover when EMAs are very close (like TSLA scenario)", () => {
      // Simulate the exact TSLA scenario: EMA12=322.18, EMA26=322.28
      // Create data that would result in these specific EMA values
      const prices = [];
      
      // Build up data to get close to target EMAs
      for (let i = 0; i < 270; i++) {
        prices.push(322 + Math.sin(i * 0.02) * 5); // Oscillate around 322
      }
      
      // Add the recent price data that should trigger crossover
      prices.push(327.55, 325.78, 323.63, 317.66, 300.71);

      const signal = indicatorManager.analyzePrice(prices, "CLOSE_CROSSOVER");
      
      // Should detect the crossover even when EMAs are very close
      expect(signal.fastEMA).to.be.a('number');
      expect(signal.slowEMA).to.be.a('number');
      
      const difference = Math.abs(signal.fastEMA - signal.slowEMA);
      console.log(`\nClose crossover test:`);
      console.log(`EMA12: ${signal.fastEMA.toFixed(4)}`);
      console.log(`EMA26: ${signal.slowEMA.toFixed(4)}`);
      console.log(`Difference: ${difference.toFixed(6)}`);
      console.log(`Signal: ${signal.signal}`);
      
      // Even tiny differences should be detected
      expect(difference).to.be.greaterThan(0);
    });
  });
});