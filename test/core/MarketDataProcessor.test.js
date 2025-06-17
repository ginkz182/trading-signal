const { expect } = require("chai");
const sinon = require("sinon");
const MarketDataProcessor = require("../../src/core/MarketDataProcessor");

describe("MarketDataProcessor", () => {
  let processor;
  let consoleLogStub;
  let dateStub;

  beforeEach(() => {
    consoleLogStub = sinon.stub(console, "log");
    processor = new MarketDataProcessor();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with default limits", () => {
      expect(processor.limits).to.deep.equal({
        maxHistoricalData: 150,
        minRequiredData: 28,
        processingWindow: 80,
        dataLimitPerSymbol: 100,
      });
      expect(processor.stats).to.deep.equal({
        processedSymbols: 0,
        totalDataPoints: 0,
        limitedSymbols: 0,
        rejectedSymbols: 0,
      });
      expect(
        consoleLogStub.calledWith(
          "[PROCESSOR] Initialized with limits:",
          processor.limits
        )
      ).to.be.true;
    });

    it("should initialize with custom config", () => {
      const customConfig = {
        maxHistoricalData: 200,
        minRequiredData: 50,
        processingWindow: 100,
        dataLimitPerSymbol: 150,
      };
      const customProcessor = new MarketDataProcessor(customConfig);

      expect(customProcessor.limits).to.deep.equal(customConfig);
    });

    it("should use defaults for missing config values", () => {
      const partialConfig = {
        maxHistoricalData: 200,
        minRequiredData: 50,
      };
      const customProcessor = new MarketDataProcessor(partialConfig);

      expect(customProcessor.limits).to.deep.equal({
        maxHistoricalData: 200,
        minRequiredData: 50,
        processingWindow: 80,
        dataLimitPerSymbol: 100,
      });
    });
  });

  describe("prepareForAnalysis()", () => {
    it("should process valid crypto data correctly", () => {
      const rawPrices = Array.from({ length: 50 }, (_, i) => ({
        close: 100 + i,
      }));

      const result = processor.prepareForAnalysis(
        rawPrices,
        "crypto",
        "BTC-USD"
      );

      expect(result).to.not.be.null;
      expect(result.symbol).to.equal("BTC-USD");
      expect(result.marketType).to.equal("crypto");
      expect(result.originalLength).to.equal(50);
      expect(result.processedLength).to.equal(49); // Crypto slices 50->49
      expect(result.latestPrice).to.deep.equal({ close: 149 });
      expect(result.dataSource).to.equal("crypto_previous_close");
      expect(processor.stats.processedSymbols).to.equal(1);
      expect(processor.stats.totalDataPoints).to.equal(49); // Crypto slices 50->49
    });

    it("should reject insufficient data", () => {
      const rawPrices = Array.from({ length: 20 }, (_, i) => ({
        close: 100 + i,
      })); // Less than minRequiredData (28)

      const result = processor.prepareForAnalysis(
        rawPrices,
        "crypto",
        "BTC-USD"
      );

      expect(result).to.be.null;
      expect(processor.stats.rejectedSymbols).to.equal(1);
      expect(processor.stats.processedSymbols).to.equal(1);
      expect(
        consoleLogStub.calledWith(
          "[PROCESSOR] Insufficient data for BTC-USD: 20 points (need 28)"
        )
      ).to.be.true;
    });

    it("should handle null or undefined rawPrices", () => {
      const result1 = processor.prepareForAnalysis(null, "crypto", "BTC-USD");
      const result2 = processor.prepareForAnalysis(
        undefined,
        "crypto",
        "ETH-USD"
      );

      expect(result1).to.be.null;
      expect(result2).to.be.null;
      expect(processor.stats.rejectedSymbols).to.equal(2);
    });

    it("should limit data when exceeding processingWindow", () => {
      const rawPrices = Array.from({ length: 120 }, (_, i) => ({
        close: 100 + i,
      })); // Exceeds processingWindow (80)

      const result = processor.prepareForAnalysis(
        rawPrices,
        "crypto",
        "BTC-USD"
      );

      expect(result).to.not.be.null;
      expect(result.originalLength).to.equal(120);
      expect(result.processedLength).to.equal(79); // 120->80 (windowing) then 80->79 (crypto slice)
      expect(processor.stats.limitedSymbols).to.equal(1);
      expect(
        consoleLogStub.calledWith(
          "[PROCESSOR] BTC-USD: Limited from 120 to 80 points for analysis"
        )
      ).to.be.true;
    });

    it("should apply stock market logic during trading hours", () => {
      // Mock Date constructor and instance methods
      const mockDate = {
        getUTCHours: () => 15,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      // Re-create processor to use mocked date
      processor = new MarketDataProcessor();
      const rawPrices = Array.from({ length: 50 }, (_, i) => ({
        close: 100 + i,
      }));

      const result = processor.prepareForAnalysis(rawPrices, "stock", "AAPL");

      expect(result.dataSource).to.equal("stock_intraday_incomplete");
      expect(result.processedLength).to.equal(49); // Stock also slices during trading hours
    });

    it("should apply stock market logic outside trading hours", () => {
      // Mock after hours (Tuesday 22:00 UTC)
      const mockDate = {
        getUTCHours: () => 22,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      const rawPrices = Array.from({ length: 50 }, (_, i) => ({
        close: 100 + i,
      }));

      const result = processor.prepareForAnalysis(rawPrices, "stock", "AAPL");

      expect(result.dataSource).to.equal("stock_complete_afterhours");
      expect(result.processedLength).to.equal(50); // Uses all data after hours
    });

    it("should handle weekend stock market correctly", () => {
      // Mock weekend (Saturday)
      const mockDate = {
        getUTCHours: () => 15,
        getUTCDay: () => 6,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      const rawPrices = Array.from({ length: 50 }, (_, i) => ({
        close: 100 + i,
      }));

      const result = processor.prepareForAnalysis(rawPrices, "stock", "AAPL");

      expect(result.dataSource).to.equal("stock_complete_afterhours");
      expect(result.processedLength).to.equal(50); // Uses all data on weekends
    });
  });

  describe("_isInStockTradingHours()", () => {
    it("should return true during trading hours on weekdays", () => {
      // Mock Tuesday 15:00 UTC (trading hours)
      const mockDate = {
        getUTCHours: () => 15,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      expect(processor._isInStockTradingHours()).to.be.true;
    });

    it("should return false outside trading hours on weekdays", () => {
      // Mock Tuesday 22:00 UTC (after hours)
      const mockDate = {
        getUTCHours: () => 22,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      expect(processor._isInStockTradingHours()).to.be.false;
    });

    it("should return false on weekends", () => {
      // Mock Saturday during trading hours
      const mockDate = {
        getUTCHours: () => 15,
        getUTCDay: () => 6,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      expect(processor._isInStockTradingHours()).to.be.false;

      // Mock Sunday
      mockDate.getUTCDay = () => 0;
      expect(processor._isInStockTradingHours()).to.be.false;
    });

    it("should handle edge cases of trading hours", () => {
      processor = new MarketDataProcessor();

      // Test start of trading hours (14:30 UTC)
      const mockDate1 = {
        getUTCHours: () => 14,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate1);
      expect(processor._isInStockTradingHours()).to.be.true;

      // Test end of trading hours (21:00 UTC)
      mockDate1.getUTCHours = () => 21;
      expect(processor._isInStockTradingHours()).to.be.true;

      // Test just before trading hours (13:00 UTC)
      mockDate1.getUTCHours = () => 13;
      expect(processor._isInStockTradingHours()).to.be.false;

      // Test just after trading hours (22:00 UTC)
      mockDate1.getUTCHours = () => 22;
      expect(processor._isInStockTradingHours()).to.be.false;
    });
  });

  describe("getStats()", () => {
    it("should return correct statistics after processing", () => {
      // Process some data to generate stats
      const rawPrices1 = Array.from({ length: 50 }, (_, i) => ({
        close: 100 + i,
      }));
      const rawPrices2 = Array.from({ length: 120 }, (_, i) => ({
        close: 200 + i,
      })); // Will be limited
      const rawPrices3 = Array.from({ length: 20 }, (_, i) => ({
        close: 300 + i,
      })); // Will be rejected

      processor.prepareForAnalysis(rawPrices1, "crypto", "BTC-USD");
      processor.prepareForAnalysis(rawPrices2, "crypto", "ETH-USD");
      processor.prepareForAnalysis(rawPrices3, "crypto", "ADA-USD");

      const stats = processor.getStats();

      expect(stats.processedSymbols).to.equal(3);
      expect(stats.rejectedSymbols).to.equal(1);
      expect(stats.limitedSymbols).to.equal(1);
      // Correctly calculates: 49 + 79 + 0 = 128 (from prices.length)
      expect(stats.totalDataPoints).to.equal(128); // 49 + 79 + 0
      expect(stats.averageDataPointsPerSymbol).to.equal(43); // Math.round(128/3)
      expect(stats.limitingRate).to.equal(33); // Math.round(1/3 * 100)
      expect(stats.rejectionRate).to.equal(33); // Math.round(1/3 * 100)
    });

    it("should return zero rates for no processed symbols", () => {
      const stats = processor.getStats();

      expect(stats).to.deep.equal({
        processedSymbols: 0,
        totalDataPoints: 0,
        limitedSymbols: 0,
        rejectedSymbols: 0,
        averageDataPointsPerSymbol: 0,
        limitingRate: 0,
        rejectionRate: 0,
      });
    });
  });

  describe("resetStats()", () => {
    it("should reset all statistics", () => {
      // Generate some stats first
      const rawPrices = Array.from({ length: 50 }, (_, i) => ({
        close: 100 + i,
      }));
      processor.prepareForAnalysis(rawPrices, "crypto", "BTC-USD");

      expect(processor.stats.processedSymbols).to.equal(1);

      processor.resetStats();

      expect(processor.stats).to.deep.equal({
        processedSymbols: 0,
        totalDataPoints: 0,
        limitedSymbols: 0,
        rejectedSymbols: 0,
      });
      expect(consoleLogStub.calledWith("[PROCESSOR] Statistics reset")).to.be
        .true;
    });
  });

  describe("_applyMarketTimingLogic()", () => {
    it("should apply crypto timing logic correctly", () => {
      const allPrices = [
        { close: 100 },
        { close: 101 },
        { close: 102 },
        { close: 103 },
      ];

      const result = processor._applyMarketTimingLogic(allPrices, "crypto");

      expect(result.prices).to.deep.equal([
        { close: 100 },
        { close: 101 },
        { close: 102 },
      ]);
      expect(result.latestPrice).to.deep.equal({ close: 103 });
      expect(result.dataSource).to.equal("crypto_previous_close");
    });

    it("should apply stock timing logic during trading hours", () => {
      // Mock trading hours
      const mockDate = {
        getUTCHours: () => 15,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      const allPrices = [
        { close: 100 },
        { close: 101 },
        { close: 102 },
        { close: 103 },
      ];

      const result = processor._applyMarketTimingLogic(allPrices, "stock");

      expect(result.prices).to.deep.equal([
        { close: 100 },
        { close: 101 },
        { close: 102 },
      ]);
      expect(result.latestPrice).to.deep.equal({ close: 103 });
      expect(result.dataSource).to.equal("stock_intraday_incomplete");
    });

    it("should apply stock timing logic outside trading hours", () => {
      // Mock after hours
      const mockDate = {
        getUTCHours: () => 22,
        getUTCDay: () => 2,
      };
      dateStub = sinon.stub(global, "Date").returns(mockDate);

      processor = new MarketDataProcessor();
      const allPrices = [
        { close: 100 },
        { close: 101 },
        { close: 102 },
        { close: 103 },
      ];

      const result = processor._applyMarketTimingLogic(allPrices, "stock");

      expect(result.prices).to.deep.equal(allPrices);
      expect(result.latestPrice).to.deep.equal({ close: 103 });
      expect(result.dataSource).to.equal("stock_complete_afterhours");
    });
  });
});
