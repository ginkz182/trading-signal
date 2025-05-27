// test/app.test.js
const { expect } = require("chai");
const sinon = require("sinon");
const request = require("supertest");
const express = require("express");

// Mock the main app components
const SignalCalculator = require("../src/SignalCalculator");
const TelegramBotHandler = require("../src/services/telegram-bot-handler");
const config = require("../src/config");

describe("App Integration Tests", () => {
  let app;
  let signalCalculatorStub;
  let botHandlerStub;
  let server;

  beforeEach(() => {
    // Create app instance for testing
    app = express();
    app.use(express.json());

    // Create stubs for main components
    signalCalculatorStub = sinon.createStubInstance(SignalCalculator);
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

    // Set up basic routes for testing
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
  });

  afterEach(() => {
    sinon.restore();
    if (server) {
      server.close();
    }
    delete global.signalCalculator;
    delete global.botHandler;
  });

  describe("GET /", () => {
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
  });

  describe("GET /health", () => {
    it("should return ok status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).to.equal(200);
      expect(response.body.status).to.equal("ok");
    });
  });

  describe("GET /stats", () => {
    it("should return subscriber statistics when services are initialized", async () => {
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

    it("should return 503 when services are not initialized", async () => {
      delete global.signalCalculator;

      const response = await request(app).get("/stats");

      expect(response.status).to.equal(503);
      expect(response.body.error).to.equal("Services not initialized yet");
    });

    it("should handle stats service errors", async () => {
      global.botHandler
        .getSubscriberService()
        .getStats.rejects(new Error("Database error"));

      const response = await request(app).get("/stats");

      expect(response.status).to.equal(500);
      expect(response.body.error).to.equal("Failed to get stats");
    });
  });

  describe("POST /trigger-scan", () => {
    it("should trigger manual scan successfully", async () => {
      const mockResult = {
        message: "Test signal found",
        signals: {
          crypto: { "BTC-USDT": { signal: "BUY" } },
          stocks: { AAPL: { signal: "SELL" } },
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

    it("should handle scan with no signals", async () => {
      const mockResult = {
        message: null,
        signals: {
          crypto: {},
          stocks: {},
        },
      };

      signalCalculatorStub.scan.resolves(mockResult);

      const response = await request(app).post("/trigger-scan");

      expect(response.status).to.equal(200);
      expect(response.body.success).to.be.true;
      expect(response.body.hasSignals).to.be.false;
      expect(response.body.signalCount.crypto).to.equal(0);
      expect(response.body.signalCount.stocks).to.equal(0);
    });

    it("should return 503 when services are not initialized", async () => {
      delete global.signalCalculator;

      const response = await request(app).post("/trigger-scan");

      expect(response.status).to.equal(503);
      expect(response.body.error).to.equal("Services not initialized yet");
    });

    it("should handle scan errors", async () => {
      signalCalculatorStub.scan.rejects(new Error("Scan failed"));

      const response = await request(app).post("/trigger-scan");

      expect(response.status).to.equal(500);
      expect(response.body.success).to.be.false;
      expect(response.body.error).to.equal("Scan failed");
    });
  });

  describe("Error handling", () => {
    it("should handle undefined signals gracefully", async () => {
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

    it("should handle partial signal data", async () => {
      const mockResult = {
        message: "Test message",
        signals: {
          crypto: { "BTC-USDT": { signal: "BUY" } },
          // Missing stocks property
        },
      };

      signalCalculatorStub.scan.resolves(mockResult);

      const response = await request(app).post("/trigger-scan");

      expect(response.status).to.equal(200);
      expect(response.body.signalCount.crypto).to.equal(1);
      expect(response.body.signalCount.stocks).to.equal(0);
    });
  });
});
