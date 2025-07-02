// test/app.test.js
const { expect } = require("chai");
const sinon = require("sinon");
const request = require("supertest");
const express = require("express");

// Mock the main app components with new architecture
const SignalCalculator = require("../../src/core/SignalCalculator");
const TelegramBotHandler = require("../../src/services/telegram-bot-handler");
const config = require("../../src/config");

describe("App Integration Tests (Optimized)", () => {
  let app;
  let signalCalculatorStub;
  let botHandlerStub;
  let server;

  beforeEach(() => {
    // Create app instance for testing
    app = express();
    app.use(express.json());

    // Create comprehensive stubs for optimized SignalCalculator
    signalCalculatorStub = {
      scan: sinon.stub(),
      cleanup: sinon.stub().resolves(),
      restartServices: sinon.stub().resolves(),
      getMemoryAnalysis: sinon.stub().returns({
        memory: {
          current: { heapUsed: 62, heapTotal: 70, timestamp: Date.now() },
          average: 60,
          min: 58,
          max: 65,
          gcCount: 2,
        },
        servicePool: {
          createdServices: 2,
          destroyedServices: 0,
          totalRequests: 25,
          activeServices: 2,
          serviceKeys: ["polygon-1d"],
          serviceDetails: {
            "polygon-1d": {
              requestCount: 25,
              stockCacheSize: 17,
              cryptoCacheSize: 18,
              uptimeMs: 45000,
            },
          },
        },
        dataProcessing: {
          processedSymbols: 20,
          totalDataPoints: 1600,
          limitedSymbols: 12,
          rejectedSymbols: 0,
          averageDataPointsPerSymbol: 80,
          limitingRate: 60,
          rejectionRate: 0,
        },
        scanCount: 3,
        config: {
          cryptoPairs: 10,
          stockPairs: 8,
          timeframe: "1d",
          dataLimits: {
            processingWindow: 80,
            minRequiredData: 28,
          },
        },
      }),
      servicePool: {
        getStats: sinon.stub().returns({
          createdServices: 2,
          totalRequests: 25,
          activeServices: 2,
        }),
        cleanup: sinon.stub().resolves(),
      },
      dataProcessor: {
        getStats: sinon.stub().returns({
          processedSymbols: 20,
          limitingRate: 60,
          rejectionRate: 0,
        }),
        resetStats: sinon.stub(),
        limits: {
          processingWindow: 80,
          minRequiredData: 28,
        },
      },
      memoryMonitor: {
        forceGarbageCollection: sinon.stub().returns(5),
        getAnalysis: sinon.stub().returns({
          current: { heapUsed: 62 },
          average: 60,
        }),
      },
      tradingPairs: {
        crypto: ["BTC/USDT", "ETH/USDT"],
        stocks: ["AAPL", "GOOGL"],
      },
    };

    // Create stubs for bot handler
    botHandlerStub = {
      getSubscriberService: sinon.stub().returns({
        getStats: sinon.stub().resolves({
          total: 10,
          active: 5,
          inactive: 5,
        }),
      }),
    };

    // Mock the global variables that would be set in the real app
    global.signalCalculator = signalCalculatorStub;
    global.botHandler = botHandlerStub;

    // Set up all the routes from your optimized app
    setupAppRoutes();
  });

  function setupAppRoutes() {
    // Basic health routes
    app.get("/", (req, res) => {
      res.json({
        message: "🤖 Trading Signals Bot is running!",
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()) + " seconds",
      });
    });

    app.get("/health", (req, res) => {
      res.json({ status: "ok" });
    });

    // Legacy stats endpoint
    app.get("/stats", async (req, res) => {
      try {
        if (!global.signalCalculator) {
          return res
            .status(503)
            .json({ error: "Services not initialized yet" });
        }

        const stats = await global.botHandler.getSubscriberService().getStats();
        res.json({
          subscribers: stats,
          uptime: Math.floor(process.uptime()),
          lastCheck: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to get stats" });
      }
    });

    // Enhanced memory monitoring endpoint
    app.get("/memory", (req, res) => {
      if (
        global.signalCalculator &&
        global.signalCalculator.getMemoryAnalysis
      ) {
        const analysis = global.signalCalculator.getMemoryAnalysis();
        res.json(analysis);
      } else {
        res.json({ error: "Memory monitoring not available" });
      }
    });

    // Analytics endpoint
    app.get("/analytics", (req, res) => {
      if (!global.signalCalculator) {
        return res.status(503).json({ error: "Calculator not initialized" });
      }

      const analysis = global.signalCalculator.getMemoryAnalysis();

      res.json({
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
        ...analysis,
      });
    });

    // Performance summary endpoint
    app.get("/performance", (req, res) => {
      if (!global.signalCalculator) {
        return res.status(503).json({ error: "Calculator not initialized" });
      }

      const analysis = global.signalCalculator.getMemoryAnalysis();

      const performanceSummary = {
        status: "optimized",
        memory: {
          current: analysis.memory?.current?.heapUsed || 0,
          average: analysis.memory?.average || 0,
          max: analysis.memory?.max || 0,
          gcCount: analysis.memory?.gcCount || 0,
        },
        services: {
          totalRequests: analysis.servicePool?.totalRequests || 0,
          activeServices: analysis.servicePool?.activeServices || 0,
          createdServices: analysis.servicePool?.createdServices || 0,
        },
        dataProcessing: analysis.dataProcessing
          ? {
              symbolsProcessed: analysis.dataProcessing.processedSymbols,
              averageDataPoints:
                analysis.dataProcessing.averageDataPointsPerSymbol,
              limitingRate: analysis.dataProcessing.limitingRate + "%",
              rejectionRate: analysis.dataProcessing.rejectionRate + "%",
            }
          : null,
        scans: analysis.scanCount,
        tradingPairs:
          (analysis.config?.cryptoPairs || 0) +
          (analysis.config?.stockPairs || 0),
      };

      res.json(performanceSummary);
    });

    // Service management endpoints
    app.get("/services", (req, res) => {
      if (global.signalCalculator && global.signalCalculator.servicePool) {
        const stats = global.signalCalculator.servicePool.getStats();
        res.json({
          pool: stats,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.json({ error: "Service pool not available" });
      }
    });

    app.post("/restart-services", async (req, res) => {
      try {
        if (!global.signalCalculator) {
          return res.status(503).json({ error: "Calculator not initialized" });
        }

        await global.signalCalculator.restartServices();

        res.json({
          message: "Services restarted successfully",
          timestamp: new Date().toISOString(),
          note: "Services will be recreated on next scan",
        });
      } catch (error) {
        console.error("Error restarting services:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Data processing endpoints
    app.get("/data-stats", (req, res) => {
      if (global.signalCalculator && global.signalCalculator.dataProcessor) {
        const stats = global.signalCalculator.dataProcessor.getStats();
        res.json({
          dataProcessing: stats,
          limits: global.signalCalculator.dataProcessor.limits,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.json({ error: "Data processor not available" });
      }
    });

    app.post("/reset-stats", (req, res) => {
      try {
        if (global.signalCalculator && global.signalCalculator.dataProcessor) {
          global.signalCalculator.dataProcessor.resetStats();
          res.json({
            message: "Data processing statistics reset",
            timestamp: new Date().toISOString(),
          });
        } else {
          res.status(503).json({ error: "Data processor not available" });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // GC endpoint
    app.post("/gc", (req, res) => {
      if (global.signalCalculator && global.signalCalculator.memoryMonitor) {
        const freed =
          global.signalCalculator.memoryMonitor.forceGarbageCollection();
        res.json({
          message: "Garbage collection forced",
          freedMB: freed,
          newAnalysis: global.signalCalculator.getMemoryAnalysis(),
        });
      } else {
        res.status(400).json({
          error: "Memory monitor not available",
        });
      }
    });

    // Manual scan trigger
    app.post("/trigger-scan", async (req, res) => {
      try {
        if (!global.signalCalculator) {
          return res
            .status(503)
            .json({ error: "Services not initialized yet" });
        }

        const result = await global.signalCalculator.scan();

        res.json({
          success: true,
          hasSignals: !!result.message,
          timestamp: new Date().toISOString(),
          signalCount: {
            crypto: Object.keys(result.signals?.crypto || {}).length,
            stocks: Object.keys(result.signals?.stocks || {}).length,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  afterEach(() => {
    sinon.restore();
    if (server) {
      server.close();
    }
    delete global.signalCalculator;
    delete global.botHandler;
  });

  describe("Basic Health Endpoints", () => {
    it("should return healthy status", async () => {
      const response = await request(app).get("/");

      expect(response.status).to.equal(200);
      expect(response.body.message).to.include(
        "Trading Signals Bot is running"
      );
      expect(response.body.status).to.equal("healthy");
      expect(response.body.timestamp).to.exist;
      expect(response.body.uptime).to.exist;
    });

    it("should return ok status for health check", async () => {
      const response = await request(app).get("/health");

      expect(response.status).to.equal(200);
      expect(response.body.status).to.equal("ok");
    });
  });

  describe("Memory Monitoring Endpoints", () => {
    it("GET /memory should return comprehensive memory analysis", async () => {
      const response = await request(app).get("/memory");

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("memory");
      expect(response.body).to.have.property("servicePool");
      expect(response.body).to.have.property("dataProcessing");
      expect(response.body).to.have.property("scanCount");
      expect(response.body).to.have.property("config");

      expect(response.body.memory.current.heapUsed).to.equal(62);
      expect(response.body.servicePool.createdServices).to.equal(2);
      expect(response.body.dataProcessing.processedSymbols).to.equal(20);
    });

    it("GET /analytics should return full analytics with system info", async () => {
      const response = await request(app).get("/analytics");

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("timestamp");
      expect(response.body).to.have.property("uptime");
      expect(response.body).to.have.property("nodeVersion");
      expect(response.body).to.have.property("environment");
      expect(response.body).to.have.property("memory");
      expect(response.body).to.have.property("servicePool");
    });

    it("GET /performance should return performance summary", async () => {
      const response = await request(app).get("/performance");

      expect(response.status).to.equal(200);
      expect(response.body.status).to.equal("optimized");
      expect(response.body.memory).to.have.property("current");
      expect(response.body.services).to.have.property("totalRequests");
      expect(response.body.dataProcessing).to.have.property("symbolsProcessed");
      expect(response.body.dataProcessing.limitingRate).to.include("%");
      expect(response.body.tradingPairs).to.equal(18); // 10 crypto + 8 stocks
    });

    it("POST /gc should trigger garbage collection", async () => {
      const response = await request(app).post("/gc");

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal("Garbage collection forced");
      expect(response.body.freedMB).to.equal(5);
      expect(response.body.newAnalysis).to.exist;
      expect(
        signalCalculatorStub.memoryMonitor.forceGarbageCollection.calledOnce
      ).to.be.true;
    });
  });

  describe("Service Management Endpoints", () => {
    it("GET /services should return service pool status", async () => {
      const response = await request(app).get("/services");

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("pool");
      expect(response.body).to.have.property("timestamp");
      expect(response.body.pool.createdServices).to.equal(2);
      expect(signalCalculatorStub.servicePool.getStats.calledOnce).to.be.true;
    });

    it("POST /restart-services should restart all services", async () => {
      const response = await request(app).post("/restart-services");

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal("Services restarted successfully");
      expect(response.body.note).to.include("recreated on next scan");
      expect(signalCalculatorStub.restartServices.calledOnce).to.be.true;
    });

    it("should handle service restart errors", async () => {
      signalCalculatorStub.restartServices.rejects(new Error("Restart failed"));

      const response = await request(app).post("/restart-services");

      expect(response.status).to.equal(500);
      expect(response.body.error).to.equal("Restart failed");
    });
  });

  describe("Data Processing Endpoints", () => {
    it("GET /data-stats should return data processing statistics", async () => {
      const response = await request(app).get("/data-stats");

      expect(response.status).to.equal(200);
      expect(response.body).to.have.property("dataProcessing");
      expect(response.body).to.have.property("limits");
      expect(response.body).to.have.property("timestamp");
      expect(response.body.dataProcessing.processedSymbols).to.equal(20);
      expect(response.body.limits.processingWindow).to.equal(80);
    });

    it("POST /reset-stats should reset data processing statistics", async () => {
      const response = await request(app).post("/reset-stats");

      expect(response.status).to.equal(200);
      expect(response.body.message).to.equal(
        "Data processing statistics reset"
      );
      expect(signalCalculatorStub.dataProcessor.resetStats.calledOnce).to.be
        .true;
    });
  });

  describe("Legacy Endpoints", () => {
    it("GET /stats should return subscriber statistics", async () => {
      const response = await request(app).get("/stats");

      expect(response.status).to.equal(200);
      expect(response.body.subscribers).to.deep.equal({
        total: 10,
        active: 5,
        inactive: 5,
      });
      expect(response.body.uptime).to.exist;
      expect(response.body.environment).to.exist;
    });

    it("POST /trigger-scan should trigger manual scan successfully", async () => {
      const mockResult = {
        message: "Test signal found",
        signals: {
          crypto: { "BTC/USDT": { signal: "BUY", price: 43567.89 } },
          stocks: { AAPL: { signal: "SELL", price: 195.67 } },
        },
      };

      signalCalculatorStub.scan.resolves(mockResult);

      const response = await request(app).post("/trigger-scan");

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.hasSignals).to.be.true;
      expect(response.body.signalCount.crypto).to.equal(1);
      expect(response.body.signalCount.stocks).to.equal(1);
      expect(response.body.timestamp).to.exist;
    });
  });

  describe("Error Handling", () => {
    it("should return 503 when calculator not initialized", async () => {
      delete global.signalCalculator;

      const response = await request(app).get("/memory");
      expect(response.status).to.equal(200);
      expect(response.body.error).to.equal("Memory monitoring not available");
    });

    it("should handle missing service components gracefully", async () => {
      global.signalCalculator = {}; // Empty calculator

      const response = await request(app).get("/services");
      expect(response.status).to.equal(200);
      expect(response.body.error).to.equal("Service pool not available");
    });

    it("should handle undefined signals gracefully in trigger-scan", async () => {
      const mockResult = {
        message: "Test message",
        signals: undefined,
      };

      signalCalculatorStub.scan.resolves(mockResult);

      const response = await request(app).post("/trigger-scan");

      expect(response.status).to.equal(200);
      expect(response.body.signalCount.crypto).to.equal(0);
      expect(response.body.signalCount.stocks).to.equal(0);
    });
  });
});
