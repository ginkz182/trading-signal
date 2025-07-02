const { expect } = require("chai");
const sinon = require("sinon");
const ExchangeServicePool = require("../../../src/services/data/ExchangeServicePool");
const KuCoinDataService = require("../../../src/services/data/KuCoinDataService");
const YahooDataService = require("../../../src/services/data/YahooDataService");
const PolygonDataService = require("../../../src/services/data/PolygonDataService");

describe("ExchangeServicePool", () => {
  let servicePool;
  let consoleLogStub;

  beforeEach(() => {
    consoleLogStub = sinon.stub(console, "log");
    servicePool = new ExchangeServicePool();
  });

  afterEach(async () => {
    if (servicePool) {
      await servicePool.cleanup();
    }
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with empty services and default stats", () => {
      expect(servicePool.services).to.be.an("object").that.is.empty;
      expect(servicePool.stats).to.deep.include({
        createdServices: 0,
        destroyedServices: 0,
        totalRequests: 0,
      });
      expect(
        consoleLogStub.calledWith("[POOL] Exchange service pool initialized")
      ).to.be.true;
    });
  });

  describe("getService()", () => {
    it("should create and return a KuCoin service", async () => {
      const service = await servicePool.getService("kucoin", "1d");

      expect(service).to.be.instanceOf(KuCoinDataService);
      expect(service.timeframe).to.equal("1d");
      expect(servicePool.stats.createdServices).to.equal(1);
      expect(servicePool.stats.totalRequests).to.equal(1);
    });

    it("should create and return a Yahoo service", async () => {
      const service = await servicePool.getService("yahoo", "4h");

      expect(service).to.be.instanceOf(YahooDataService);
      expect(service.timeframe).to.equal("4h");
      expect(servicePool.stats.createdServices).to.equal(1);
      expect(servicePool.stats.totalRequests).to.equal(1);
    });

    it("should create and return a Polygon service", async () => {
      const service = await servicePool.getService("polygon", "1d");

      expect(service).to.be.instanceOf(PolygonDataService);
      expect(service.timeframe).to.equal("1d");
      expect(servicePool.stats.createdServices).to.equal(1);
      expect(servicePool.stats.totalRequests).to.equal(1);
    });

    it("should reuse existing service instances", async () => {
      const service1 = await servicePool.getService("kucoin", "1d");
      const service2 = await servicePool.getService("kucoin", "1d");

      expect(service1).to.equal(service2);
      expect(servicePool.stats.createdServices).to.equal(1);
      expect(servicePool.stats.totalRequests).to.equal(2);
    });

    it("should create different instances for different configurations", async () => {
      const kucoinService = await servicePool.getService("kucoin", "1d");
      const polygonService = await servicePool.getService("polygon", "1d");
      const kucoin4hService = await servicePool.getService("kucoin", "4h");

      expect(kucoinService).to.not.equal(polygonService);
      expect(kucoinService).to.not.equal(kucoin4hService);
      expect(servicePool.stats.createdServices).to.equal(3);
      expect(servicePool.stats.totalRequests).to.equal(3);
    });

    it("should throw error for unsupported service type", async () => {
      try {
        await servicePool.getService("unsupported", "1d");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.equal("Unsupported service type: unsupported");
      }
    });

    it("should handle case-insensitive service types", async () => {
      const kucoinService = await servicePool.getService("KUCOIN", "1d");
      const polygonService = await servicePool.getService("Polygon", "1d");

      expect(kucoinService).to.be.instanceOf(KuCoinDataService);
      expect(polygonService).to.be.instanceOf(PolygonDataService);
    });
  });

  describe("getStats()", () => {
    it("should return correct statistics", async () => {
      await servicePool.getService("kucoin", "1d");
      await servicePool.getService("polygon", "1d");

      const stats = servicePool.getStats();

      expect(stats).to.include({
        createdServices: 2,
        destroyedServices: 0,
        totalRequests: 2,
        activeServices: 2,
      });
      expect(stats.serviceKeys).to.deep.equal(["kucoin-1d", "polygon-1d"]);
      expect(stats.serviceDetails).to.be.an("object");
    });

    it("should include service details when available", async () => {
      // Mock a service with getStats method
      const mockService = {
        getStats: sinon.stub().returns({ requests: 5, errors: 0 }),
      };
      servicePool.services["mock-1d"] = mockService;

      const stats = servicePool.getStats();

      expect(stats.serviceDetails["mock-1d"]).to.deep.equal({
        requests: 5,
        errors: 0,
      });
    });
  });

  describe("cleanup()", () => {
    it("should cleanup all services", async () => {
      // Create some services
      await servicePool.getService("kucoin", "1d");
      await servicePool.getService("yahoo", "4h");

      expect(Object.keys(servicePool.services)).to.have.length(2);

      await servicePool.cleanup();

      expect(servicePool.services).to.be.empty;
      expect(servicePool.stats.lastCleanup).to.be.a("string");
    });

    it("should handle services with destroy method", async () => {
      const mockService = {
        destroy: sinon.stub().resolves(),
      };
      servicePool.services["mock-1d"] = mockService;

      await servicePool.cleanup();

      expect(mockService.destroy.calledOnce).to.be.true;
      expect(servicePool.stats.destroyedServices).to.equal(1);
    });

    it("should handle cleanup errors gracefully", async () => {
      const consoleErrorStub = sinon.stub(console, "error");
      const mockService = {
        destroy: sinon.stub().rejects(new Error("Cleanup failed")),
      };
      servicePool.services["mock-1d"] = mockService;

      await servicePool.cleanup();

      expect(
        consoleErrorStub.calledWith(
          "[POOL] Error destroying service mock-1d:",
          "Cleanup failed"
        )
      ).to.be.true;
      expect(servicePool.services).to.be.empty;
    });
  });

  describe("restartService()", () => {
    it("should restart an existing service", async () => {
      const mockService = {
        destroy: sinon.stub().resolves(),
      };
      servicePool.services["kucoin-1d"] = mockService;
      servicePool.stats.createdServices = 1;

      await servicePool.restartService("kucoin", "1d");

      expect(mockService.destroy.calledOnce).to.be.true;
      expect(servicePool.services["kucoin-1d"]).to.be.undefined;
      expect(servicePool.stats.destroyedServices).to.equal(1);
    });

    it("should handle restarting non-existent service", async () => {
      await servicePool.restartService("kucoin", "1d");

      // Should not throw error
      expect(servicePool.stats.destroyedServices).to.equal(0);
    });

    it("should recreate service on next getService call", async () => {
      // Create initial service
      const service1 = await servicePool.getService("kucoin", "1d");

      // Restart the service
      await servicePool.restartService("kucoin", "1d");

      // Get service again - should be a new instance
      const service2 = await servicePool.getService("kucoin", "1d");

      expect(service1).to.not.equal(service2);
      expect(servicePool.stats.createdServices).to.equal(2);
      expect(servicePool.stats.destroyedServices).to.equal(1);
    });
  });
});
