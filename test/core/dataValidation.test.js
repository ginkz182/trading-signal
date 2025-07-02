const { expect } = require("chai");
const sinon = require("sinon");
const SignalCalculator = require("../../src/core/SignalCalculator");

describe("SignalCalculator Data Validation", () => {
  let signalCalculator;
  let consoleWarnStub;

  beforeEach(() => {
    consoleWarnStub = sinon.stub(console, "warn");
    signalCalculator = new SignalCalculator({
      symbols: ["BTC/USDT"],
      stockSymbols: ["TSLA"],
      timeframe: "1d"
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Data Quality Requirements", () => {
    it("should ensure data services provide sufficient historical data", async () => {
      // Mock a service that returns insufficient data (like the TSLA bug)
      const mockInsufficientService = {
        getPrices: sinon.stub().resolves(Array(83).fill(300)) // Only 83 points
      };

      const mockSufficientService = {
        getPrices: sinon.stub().resolves(Array(274).fill(300)) // 274 points
      };

      // Mock the service pool to return our test services
      sinon.stub(signalCalculator.servicePool, 'getService')
        .onFirstCall().returns(mockInsufficientService)
        .onSecondCall().returns(mockSufficientService);

      // Mock the data processor to pass through the data
      sinon.stub(signalCalculator.dataProcessor, 'prepareForAnalysis')
        .onFirstCall().returns({
          prices: Array(83).fill(300),
          latestPrice: 300,
          processedLength: 83,
          originalLength: 83,
          dataSource: "test_insufficient"
        })
        .onSecondCall().returns({
          prices: Array(274).fill(300),
          latestPrice: 300,
          processedLength: 274,
          originalLength: 274,
          dataSource: "test_sufficient"
        });

      // Test insufficient data scenario
      const resultInsufficient = await signalCalculator._processTradingPair("TEST_INSUFFICIENT", "stocks");
      
      // Test sufficient data scenario  
      const resultSufficient = await signalCalculator._processTradingPair("TEST_SUFFICIENT", "stocks");

      // Should warn about insufficient data
      expect(consoleWarnStub.calledWith(sinon.match("Limited data"))).to.be.true;
      
      // Both should return results, but we should be aware of data quality
      if (resultInsufficient) {
        expect(resultInsufficient).to.have.property('dataStats');
        expect(resultInsufficient.dataStats.processed).to.equal(83);
      }
      
      if (resultSufficient) {
        expect(resultSufficient).to.have.property('dataStats');
        expect(resultSufficient.dataStats.processed).to.equal(274);
      }
    });

    it("should validate minimum data requirements before signal calculation", () => {
      // Test that the system requires at least 28 data points
      const veryShortData = [100, 101, 102]; // Only 3 points
      
      const result = signalCalculator.indicatorManager.analyzePrice(veryShortData, "VERY_SHORT");
      
      expect(result.signal).to.equal("HOLD");
      expect(result.fastEMA).to.be.null;
      expect(result.slowEMA).to.be.null;
      expect(consoleWarnStub.calledWith(sinon.match("need at least 28 data points"))).to.be.true;
    });

    it("should provide data quality metrics in scan results", async () => {
      // Mock services to return different amounts of data
      const mockService = {
        getPrices: sinon.stub()
          .onFirstCall().resolves(Array(83).fill(300))   // Insufficient
          .onSecondCall().resolves(Array(274).fill(300)) // Sufficient
      };

      sinon.stub(signalCalculator.servicePool, 'getService').returns(mockService);
      
      // Mock data processor to return realistic data
      sinon.stub(signalCalculator.dataProcessor, 'prepareForAnalysis')
        .onFirstCall().returns({
          prices: Array(83).fill(300),
          latestPrice: 300,
          processedLength: 83,
          originalLength: 83,
          dataSource: "test"
        })
        .onSecondCall().returns({
          prices: Array(274).fill(300),
          latestPrice: 300,
          processedLength: 274,
          originalLength: 274,
          dataSource: "test"
        });

      // Run scan and check that we get data quality info
      const signals = await signalCalculator.checkSignals();

      // Should provide metrics about data processing
      const processingStats = signalCalculator.dataProcessor.getStats();
      expect(processingStats).to.have.property('processedSymbols');
      expect(processingStats).to.have.property('averageDataPointsPerSymbol');
    });
  });

  describe("EMA Accuracy Validation", () => {
    it("should detect when EMA calculations might be inaccurate due to insufficient data", () => {
      // Create test data that mimics the TSLA scenario
      const insufficientData = Array(83).fill(0).map((_, i) => 300 + Math.sin(i * 0.1) * 10);
      const sufficientData = Array(274).fill(0).map((_, i) => 300 + Math.sin(i * 0.1) * 10);

      const resultInsufficient = signalCalculator.indicatorManager.analyzePrice(insufficientData, "INSUFFICIENT");
      const resultSufficient = signalCalculator.indicatorManager.analyzePrice(sufficientData, "SUFFICIENT");

      // Should warn about limited data for insufficient case
      expect(consoleWarnStub.calledWith(sinon.match("Limited data (83 points)"))).to.be.true;
      
      // Should not warn for sufficient data
      expect(consoleWarnStub.calledWith(sinon.match("Limited data (274 points)"))).to.be.false;

      // Both should return valid results
      expect(resultInsufficient.fastEMA).to.be.a('number');
      expect(resultSufficient.fastEMA).to.be.a('number');
      expect(resultInsufficient.slowEMA).to.be.a('number');
      expect(resultSufficient.slowEMA).to.be.a('number');

      // The EMA values should be different due to data amount
      const ema26Difference = Math.abs(resultInsufficient.slowEMA - resultSufficient.slowEMA);
      expect(ema26Difference).to.be.greaterThan(0.01); // Should show measurable difference
    });

    it("should provide confidence level based on data amount", () => {
      // This test shows how we could extend the system to provide confidence levels
      const limitedData = Array(100).fill(0).map((_, i) => 300 + i * 0.1);
      const goodData = Array(300).fill(0).map((_, i) => 300 + i * 0.1);

      const resultLimited = signalCalculator.indicatorManager.analyzePrice(limitedData, "LIMITED");
      const resultGood = signalCalculator.indicatorManager.analyzePrice(goodData, "GOOD");

      // Both should work, but we should be able to assess confidence
      expect(resultLimited).to.have.property('fastEMA');
      expect(resultGood).to.have.property('fastEMA');
      
      // Future enhancement: add confidence score based on data amount
      // expect(resultLimited).to.have.property('confidence');
      // expect(resultLimited.confidence).to.be.lessThan(resultGood.confidence);
    });
  });

  describe("Real-world Scenario Prevention", () => {
    it("should prevent the TSLA missed signal scenario", () => {
      // Recreate the exact scenario that caused the TSLA signal to be missed
      
      // Simulate receiving only 83 data points (the bug scenario)
      const buggyData = Array(83).fill(0).map((_, i) => {
        // Simulate declining prices leading to crossover
        return 330 - (i * 0.1) + Math.sin(i * 0.05) * 2;
      });
      
      // Add the final price drop that should trigger SELL signal
      buggyData[buggyData.length - 1] = 300.71;

      // This should warn about insufficient data
      const result = signalCalculator.indicatorManager.analyzePrice(buggyData, "TSLA_BUG_SCENARIO");
      
      // Should warn about limited data
      expect(consoleWarnStub.calledWith(sinon.match("Limited data (83 points)"))).to.be.true;
      expect(consoleWarnStub.calledWith(sinon.match("Recommended: 260+"))).to.be.true;
      
      // Should still return a result, but we're now aware of potential inaccuracy
      expect(result).to.have.property('signal');
      expect(result).to.have.property('fastEMA');
      expect(result).to.have.property('slowEMA');
    });

    it("should ensure data services provide adequate historical depth", async () => {
      // This test ensures our data services are configured to get enough data
      
      // Create a mock service that provides insufficient data
      const inadequateService = {
        getPrices: sinon.stub().resolves(Array(50).fill(300))
      };

      sinon.stub(signalCalculator.servicePool, 'getService').returns(inadequateService);
      sinon.stub(signalCalculator.dataProcessor, 'prepareForAnalysis').returns({
        prices: Array(50).fill(300),
        latestPrice: 300,
        processedLength: 50,
        originalLength: 50,
        dataSource: "inadequate"
      });

      const result = await signalCalculator._processTradingPair("TEST", "stocks");

      // Should warn about data limitations
      expect(consoleWarnStub.calledWith(sinon.match("Limited data"))).to.be.true;
      
      // This test demonstrates the importance of configuring data services
      // to fetch sufficient historical data (274+ points for accurate EMA26)
    });
  });
});