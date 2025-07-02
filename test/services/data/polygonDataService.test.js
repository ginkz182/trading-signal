const { expect } = require("chai");
const sinon = require("sinon");
const axios = require("axios");
const PolygonDataService = require("../../../src/services/data/PolygonDataService");

describe("PolygonDataService", () => {
  let polygonService;
  let axiosStub;
  let consoleLogStub;
  let consoleErrorStub;

  beforeEach(() => {
    // Set up environment variable for testing
    process.env.POLYGON_API_KEY = "test-api-key";
    
    consoleLogStub = sinon.stub(console, "log");
    consoleErrorStub = sinon.stub(console, "error");
    axiosStub = sinon.stub(axios, "get");
    
    polygonService = new PolygonDataService("1d");
    
    // Mock the rate limit delay to speed up tests
    sinon.stub(polygonService, "rateLimitDelay").resolves();
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.POLYGON_API_KEY;
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(polygonService.timeframe).to.equal("1d");
      expect(polygonService.apiKey).to.equal("test-api-key");
      expect(polygonService.baseUrl).to.equal("https://api.polygon.io");
      expect(polygonService.stockCache).to.be.instanceOf(Map);
      expect(polygonService.cryptoCache).to.be.instanceOf(Map);
      expect(polygonService.lastFetchDate).to.be.null;
    });

    it("should warn when API key is missing", () => {
      delete process.env.POLYGON_API_KEY;
      const consoleWarnStub = sinon.stub(console, "warn");
      
      new PolygonDataService("1d");
      
      expect(consoleWarnStub.calledWith(
        "[POLYGON] API key not found. Set POLYGON_API_KEY environment variable"
      )).to.be.true;
    });
  });

  describe("convertToPolygonSymbol", () => {
    it("should convert crypto pairs to Polygon format", () => {
      expect(polygonService.convertToPolygonSymbol("BTC/USDT")).to.equal("X:BTCUSD");
      expect(polygonService.convertToPolygonSymbol("ETH/USDT")).to.equal("X:ETHUSD");
      expect(polygonService.convertToPolygonSymbol("SOL/USD")).to.equal("X:SOLUSD");
    });

    it("should keep stock symbols unchanged", () => {
      expect(polygonService.convertToPolygonSymbol("TSLA")).to.equal("TSLA");
      expect(polygonService.convertToPolygonSymbol("AAPL")).to.equal("AAPL");
      expect(polygonService.convertToPolygonSymbol("GOOGL")).to.equal("GOOGL");
    });
  });

  describe("getHistoricalPrices", () => {
    it("should fetch historical data successfully", async () => {
      const mockResponse = {
        data: {
          status: "OK",
          results: [
            { c: 100.50 },
            { c: 101.25 },
            { c: 102.00 }
          ]
        }
      };

      axiosStub.resolves(mockResponse);

      const prices = await polygonService.getHistoricalPrices("TSLA");

      expect(prices).to.deep.equal([100.50, 101.25, 102.00]);
      expect(axiosStub.calledOnce).to.be.true;
    });

    it("should handle delayed status", async () => {
      const mockResponse = {
        data: {
          status: "DELAYED",
          results: [
            { c: 100.50 },
            { c: 101.25 }
          ]
        }
      };

      axiosStub.resolves(mockResponse);

      const prices = await polygonService.getHistoricalPrices("TSLA");

      expect(prices).to.deep.equal([100.50, 101.25]);
      expect(consoleLogStub.calledWith("[POLYGON] TSLA: Using delayed data (free tier)")).to.be.true;
    });

    it("should return null on API error", async () => {
      const mockResponse = {
        data: {
          status: "ERROR",
          error: "Invalid symbol"
        }
      };

      axiosStub.resolves(mockResponse);

      const prices = await polygonService.getHistoricalPrices("INVALID");

      expect(prices).to.be.null;
      expect(consoleErrorStub.calledWith("[POLYGON] Error for INVALID: ERROR")).to.be.true;
    });

    it("should handle rate limiting", async () => {
      const error = new Error("Rate limited");
      error.response = { status: 429 };
      
      axiosStub.onFirstCall().rejects(error);
      axiosStub.onSecondCall().resolves({
        data: {
          status: "OK",
          results: [{ c: 100.50 }]
        }
      });

      // Mock sleep to speed up test
      sinon.stub(polygonService, "sleep").resolves();

      const prices = await polygonService.getHistoricalPrices("TSLA");

      expect(prices).to.deep.equal([100.50]);
      expect(axiosStub.calledTwice).to.be.true;
    });

    it("should return null when no API key provided", async () => {
      polygonService.apiKey = null;

      const prices = await polygonService.getHistoricalPrices("TSLA");

      expect(prices).to.be.null;
      expect(consoleErrorStub.calledWith("[POLYGON] API key required")).to.be.true;
    });
  });

  describe("fetchBulkData", () => {
    it("should fetch bulk stock data successfully", async () => {
      const mockResponse = {
        data: {
          status: "OK",
          results: [
            { T: "TSLA", c: 300.50 },
            { T: "AAPL", c: 195.25 }
          ]
        }
      };

      axiosStub.resolves(mockResponse);

      const success = await polygonService.fetchBulkData();

      expect(success).to.be.true;
      expect(polygonService.stockCache.size).to.equal(2);
      expect(polygonService.stockCache.get("TSLA")).to.deep.equal({ T: "TSLA", c: 300.50 });
    });

    it("should use cached data if available", async () => {
      // Set up cache
      const today = new Date();
      today.setDate(today.getDate() - 1);
      polygonService.lastFetchDate = today.toISOString().split('T')[0];
      polygonService.stockCache.set("TSLA", { T: "TSLA", c: 300.50 });

      const success = await polygonService.fetchBulkData();

      expect(success).to.be.true;
      expect(axiosStub.called).to.be.false;
      expect(consoleLogStub.calledWith(sinon.match("Using cached stock data"))).to.be.true;
    });
  });

  describe("fetchBulkCrypto", () => {
    it("should fetch bulk crypto data successfully", async () => {
      const mockResponse = {
        data: {
          status: "OK",
          results: [
            { T: "X:BTCUSD", c: 43567.89 },
            { T: "X:ETHUSD", c: 2605.23 }
          ]
        }
      };

      axiosStub.resolves(mockResponse);

      const success = await polygonService.fetchBulkCrypto();

      expect(success).to.be.true;
      expect(polygonService.cryptoCache.size).to.equal(2);
      expect(polygonService.cryptoCache.get("X:BTCUSD")).to.deep.equal({ T: "X:BTCUSD", c: 43567.89 });
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        data: {
          status: "ERROR",
          error: "Invalid request"
        }
      };

      axiosStub.resolves(mockResponse);

      const success = await polygonService.fetchBulkCrypto();

      expect(success).to.be.false;
      expect(consoleErrorStub.calledWith("[POLYGON] Bulk crypto API error: ERROR")).to.be.true;
    });
  });

  describe("getPrices", () => {
    it("should convert crypto symbols and fetch prices", async () => {
      const mockResponse = {
        data: {
          status: "OK",
          results: [
            { c: 43567.89 },
            { c: 43650.12 }
          ]
        }
      };

      axiosStub.resolves(mockResponse);

      const prices = await polygonService.getPrices("BTC/USDT");

      expect(prices).to.deep.equal([43567.89, 43650.12]);
      
      // Check that the URL contains the converted symbol
      const callArgs = axiosStub.getCall(0).args;
      expect(callArgs[0]).to.include("X:BTCUSD");
    });

    it("should handle stock symbols directly", async () => {
      const mockResponse = {
        data: {
          status: "OK",
          results: [
            { c: 300.50 },
            { c: 301.25 }
          ]
        }
      };

      axiosStub.resolves(mockResponse);

      const prices = await polygonService.getPrices("TSLA");

      expect(prices).to.deep.equal([300.50, 301.25]);
      
      // Check that the URL contains the original symbol
      const callArgs = axiosStub.getCall(0).args;
      expect(callArgs[0]).to.include("TSLA");
    });
  });

  describe("clearCache", () => {
    it("should clear all caches", () => {
      polygonService.stockCache.set("TSLA", {});
      polygonService.cryptoCache.set("X:BTCUSD", {});
      polygonService.lastFetchDate = "2023-01-01";

      polygonService.clearCache();

      expect(polygonService.stockCache.size).to.equal(0);
      expect(polygonService.cryptoCache.size).to.equal(0);
      expect(polygonService.lastFetchDate).to.be.null;
      expect(consoleLogStub.calledWith("[MEMORY] Polygon cache cleared")).to.be.true;
    });
  });

  describe("cleanup", () => {
    it("should clear caches and reset API key", () => {
      polygonService.stockCache.set("TSLA", {});
      polygonService.cryptoCache.set("X:BTCUSD", {});

      polygonService.cleanup();

      expect(polygonService.stockCache.size).to.equal(0);
      expect(polygonService.cryptoCache.size).to.equal(0);
      expect(polygonService.apiKey).to.be.null;
      expect(consoleLogStub.calledWith("[MEMORY] Polygon cleanup")).to.be.true;
    });
  });

  describe("rateLimitDelay", () => {
    it("should wait for rate limit delay", async () => {
      // Restore the stub to test the actual method
      polygonService.rateLimitDelay.restore();
      
      const sleepStub = sinon.stub(polygonService, "sleep").resolves();

      await polygonService.rateLimitDelay();

      expect(sleepStub.calledWith(12000)).to.be.true;
    });
  });
});