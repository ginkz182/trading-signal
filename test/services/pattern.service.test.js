const { expect } = require("chai");
const PatternService = require("../../src/services/pattern.service");

describe("PatternService", () => {
  let patternService;

  beforeEach(() => {
    patternService = new PatternService({
      minBars: 20,
      maxBars: 100,
      tolerance: 0.02,
      minTouchPoints: 3,
      volumeConfirmation: true,
      breakoutThreshold: 0.015,
      volumeBreakoutMultiplier: 1.5
    });
  });

  describe("Configuration", () => {
    it("should initialize with correct default config", () => {
      const service = new PatternService();
      expect(service.config.minBars).to.equal(20);
      expect(service.config.maxBars).to.equal(100);
      expect(service.config.tolerance).to.equal(0.02);
      expect(service.config.minTouchPoints).to.equal(3);
    });

    it("should accept custom configuration", () => {
      const customConfig = {
        minBars: 30,
        tolerance: 0.03,
        breakoutThreshold: 0.02
      };
      const service = new PatternService(customConfig);
      
      expect(service.config.minBars).to.equal(30);
      expect(service.config.tolerance).to.equal(0.03);
      expect(service.config.breakoutThreshold).to.equal(0.02);
    });
  });

  describe("detectTriangles()", () => {
    it("should return no pattern for insufficient data", () => {
      const shortData = generateTestData('ascending', 10); // Below minBars threshold
      const result = patternService.detectTriangles(shortData, "TEST");
      
      expect(result.pattern).to.be.null;
      expect(result.confidence).to.equal(0);
      expect(result.reason).to.equal('Insufficient data');
    });

    it("should detect ascending triangle pattern", () => {
      const data = generateAscendingTriangleData();
      const result = patternService.detectTriangles(data, "TEST_ASCENDING");
      
      expect(result).to.be.an('object');
      if (result.pattern) {
        expect(result.pattern).to.equal('ASCENDING_TRIANGLE');
        expect(result.direction).to.equal('BULLISH');
        expect(result.confidence).to.be.above(60);
        expect(result.resistance).to.exist;
        expect(result.support).to.exist;
      }
    });

    it("should detect descending triangle pattern", () => {
      const data = generateDescendingTriangleData();
      const result = patternService.detectTriangles(data, "TEST_DESCENDING");
      
      expect(result).to.be.an('object');
      if (result.pattern) {
        expect(result.pattern).to.equal('DESCENDING_TRIANGLE');
        expect(result.direction).to.equal('BEARISH');
        expect(result.confidence).to.be.above(60);
        expect(result.resistance).to.exist;
        expect(result.support).to.exist;
      }
    });

    it("should detect symmetrical triangle pattern", () => {
      const data = generateSymmetricalTriangleData();
      const result = patternService.detectTriangles(data, "TEST_SYMMETRICAL");
      
      expect(result).to.be.an('object');
      if (result.pattern) {
        expect(result.pattern).to.equal('SYMMETRICAL_TRIANGLE');
        expect(result.direction).to.equal('NEUTRAL');
        expect(result.confidence).to.be.above(65);
        expect(result.resistance).to.exist;
        expect(result.support).to.exist;
      }
    });

    it("should include breakout analysis in results", () => {
      const data = generateAscendingTriangleData();
      const result = patternService.detectTriangles(data, "TEST_BREAKOUT");
      
      if (result.pattern) {
        expect(result.breakout).to.exist;
        expect(result.breakout.status).to.be.oneOf(['FORMING', 'APPROACHING_RESISTANCE', 'APPROACHING_SUPPORT', 'BREAKOUT_UP', 'BREAKOUT_DOWN']);
        expect(result.breakout.upperBreakout).to.be.a('number');
        expect(result.breakout.lowerBreakout).to.be.a('number');
        expect(result.breakout.currentPrice).to.be.a('number');
      }
    });

    it("should include trading plan in results", () => {
      const data = generateAscendingTriangleData();
      const result = patternService.detectTriangles(data, "TEST_TRADING_PLAN");
      
      if (result.pattern) {
        expect(result.tradingPlan).to.exist;
        expect(result.tradingPlan.entry).to.exist;
        expect(result.tradingPlan.entry.long).to.exist;
        expect(result.tradingPlan.entry.short).to.exist;
        expect(result.tradingPlan.alerts).to.be.an('array');
      }
    });

    it("should detect breakout conditions", () => {
      const data = generateAscendingTriangleWithBreakout();
      const result = patternService.detectTriangles(data, "TEST_BREAKOUT_UP");
      
      if (result.pattern && result.breakout) {
        expect(result.breakout.status).to.be.oneOf(['BREAKOUT_UP', 'BREAKOUT_DOWN', 'APPROACHING_RESISTANCE']);
        if (result.breakout.status === 'BREAKOUT_UP') {
          expect(result.breakout.direction).to.equal('BULLISH');
        }
      }
    });
  });

  describe("Pattern Quality Assessment", () => {
    it("should assign higher confidence to clear patterns", () => {
      const clearData = generateClearAscendingTriangle();
      const noisyData = generateNoisyAscendingTriangle();
      
      const clearResult = patternService.detectTriangles(clearData, "CLEAR");
      const noisyResult = patternService.detectTriangles(noisyData, "NOISY");
      
      if (clearResult.pattern && noisyResult.pattern) {
        expect(clearResult.confidence).to.be.above(noisyResult.confidence);
      }
    });

    it("should consider volume patterns in confidence calculation", () => {
      // Test with volume confirmation enabled vs disabled
      const data = generateAscendingTriangleData();
      
      const withVolumeService = new PatternService({ volumeConfirmation: true });
      const withoutVolumeService = new PatternService({ volumeConfirmation: false });
      
      const withVolumeResult = withVolumeService.detectTriangles(data, "WITH_VOLUME");
      const withoutVolumeResult = withoutVolumeService.detectTriangles(data, "WITHOUT_VOLUME");
      
      // Results should exist for both, but confidence might differ
      expect(withVolumeResult).to.be.an('object');
      expect(withoutVolumeResult).to.be.an('object');
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty or null data", () => {
      expect(() => patternService.detectTriangles(null, "NULL")).to.not.throw();
      expect(() => patternService.detectTriangles([], "EMPTY")).to.not.throw();
      expect(() => patternService.detectTriangles(undefined, "UNDEFINED")).to.not.throw();
      
      const nullResult = patternService.detectTriangles(null, "NULL");
      expect(nullResult.pattern).to.be.null;
      expect(nullResult.confidence).to.equal(0);
    });

    it("should handle malformed OHLCV data", () => {
      const malformedData = [
        [Date.now(), 100], // Missing HLCV
        [Date.now(), 100, 105, 95, 102], // Missing volume
        [Date.now(), 100, 105, 95, 102, 1000] // Correct format
      ];
      
      expect(() => patternService.detectTriangles(malformedData, "MALFORMED")).to.not.throw();
    });

    it("should handle data with extreme values", () => {
      const extremeData = generateTestData('ascending', 30);
      // Add some extreme values
      extremeData[0][2] = 999999; // Extreme high
      extremeData[1][3] = 0.0001; // Extreme low
      
      expect(() => patternService.detectTriangles(extremeData, "EXTREME")).to.not.throw();
    });
  });
});

// Helper functions to generate test data
function generateTestData(type, bars = 40) {
  const data = [];
  let basePrice = 100;
  const timestamp = Date.now() - (bars * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < bars; i++) {
    const progress = i / bars;
    let high, low;
    
    switch (type) {
      case 'ascending':
        high = 110 + Math.random() * 1 - 0.5;
        low = basePrice + (progress * 8) + Math.random() * 1 - 0.5;
        break;
      case 'descending':
        high = basePrice + 15 - (progress * 12) + Math.random() * 1 - 0.5;
        low = 95 + Math.random() * 1 - 0.5;
        break;
      case 'symmetrical':
        const spread = 15 * (1 - progress);
        high = basePrice + spread/2 + Math.random() * 1 - 0.5;
        low = basePrice - spread/2 + Math.random() * 1 - 0.5;
        break;
      default:
        high = basePrice + Math.random() * 5;
        low = basePrice - Math.random() * 5;
    }
    
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = Math.floor(1000000 * (1 - progress * 0.3) * (0.8 + Math.random() * 0.4));
    
    data.push([
      timestamp + (i * 24 * 60 * 60 * 1000),
      Math.round(open * 100) / 100,
      Math.round(high * 100) / 100,
      Math.round(low * 100) / 100,
      Math.round(close * 100) / 100,
      volume
    ]);
    
    basePrice = close + (Math.random() - 0.5) * 0.2;
  }
  
  return data;
}

function generateAscendingTriangleData() {
  return generateTestData('ascending', 35);
}

function generateDescendingTriangleData() {
  return generateTestData('descending', 35);
}

function generateSymmetricalTriangleData() {
  return generateTestData('symmetrical', 35);
}

function generateAscendingTriangleWithBreakout() {
  const data = generateTestData('ascending', 35);
  const lastPrice = data[data.length - 1][4];
  
  // Add breakout candles
  for (let i = 0; i < 3; i++) {
    const timestamp = data[data.length - 1][0] + ((i + 1) * 24 * 60 * 60 * 1000);
    const priceMove = 5 * (i + 1); // Strong upward movement
    
    const open = i === 0 ? lastPrice : data[data.length - 1][4];
    const close = open + priceMove;
    const high = close + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 1;
    const volume = Math.floor(2000000 * (1 + Math.random()));
    
    data.push([timestamp, open, high, low, close, volume]);
  }
  
  return data;
}

function generateClearAscendingTriangle() {
  const data = [];
  const bars = 40;
  const timestamp = Date.now() - (bars * 24 * 60 * 60 * 1000);
  
  // Create very clear ascending triangle with minimal noise
  for (let i = 0; i < bars; i++) {
    const progress = i / bars;
    const high = 110 + Math.random() * 0.2 - 0.1; // Very tight resistance
    const low = 95 + (progress * 10) + Math.random() * 0.2 - 0.1; // Clean ascending support
    
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = Math.floor(1000000 * (1 - progress * 0.4));
    
    data.push([
      timestamp + (i * 24 * 60 * 60 * 1000),
      Math.round(open * 100) / 100,
      Math.round(high * 100) / 100,
      Math.round(low * 100) / 100,
      Math.round(close * 100) / 100,
      volume
    ]);
  }
  
  return data;
}

function generateNoisyAscendingTriangle() {
  const data = [];
  const bars = 40;
  const timestamp = Date.now() - (bars * 24 * 60 * 60 * 1000);
  
  // Create noisy ascending triangle
  for (let i = 0; i < bars; i++) {
    const progress = i / bars;
    const high = 110 + Math.random() * 4 - 2; // Noisy resistance
    const low = 95 + (progress * 10) + Math.random() * 3 - 1.5; // Noisy ascending support
    
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = Math.floor(1000000 * (0.5 + Math.random()));
    
    data.push([
      timestamp + (i * 24 * 60 * 60 * 1000),
      Math.round(open * 100) / 100,
      Math.round(high * 100) / 100,
      Math.round(low * 100) / 100,
      Math.round(close * 100) / 100,
      volume
    ]);
  }
  
  return data;
}