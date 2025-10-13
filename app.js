// app.js - Main file for Railway deployment
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const SignalCalculator = require("./src/core/SignalCalculator");
const TelegramBotHandler = require("./src/services/telegram-bot-handler");
const config = require("./src/config");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint (Railway uses this to check if app is running)
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

// Global variables for services
let signalCalculator;
let botHandler;

// Initialize all services
async function initializeServices() {
  try {
    console.log("🔧 Initializing services...");

    // Initialize Signal Calculator with Railway-optimized config
    signalCalculator = new SignalCalculator(config);

    // Initialize Telegram Bot Handler
    botHandler = new TelegramBotHandler({
      token: process.env.TELEGRAM_BOT_TOKEN,
      subscriberConfig: {
        databaseUrl: process.env.DATABASE_URL,
      },
    });

    console.log("✅ All services initialized successfully");

    // Run initial signal check
    console.log("🔍 Running initial signal check...");
    await signalCalculator.scan({ sendNotification: false });
    console.log("✅ Initial check completed");
  } catch (error) {
    console.error("❌ Error initializing services:", error);
    // Don't exit in production, let Railway restart the app
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
  }
}

// Schedule signal checking - runs daily at 00:05 UTC
cron.schedule(
  "5 0 * * *",
  async () => {
    console.log(
      "⏰ [" + new Date().toISOString() + "] Scheduled signal check starting..."
    );
    try {
      const result = await signalCalculator.scan();
      if (result.message) {
        console.log("📊 Signals found and sent to subscribers");
      } else {
        console.log("📈 No signals detected");
      }
    } catch (error) {
      console.error("❌ Error in scheduled signal check:", error);
    }
  },
  {
    timezone: "UTC",
  }
);

// Additional endpoints for monitoring and manual control
app.get("/stats", async (req, res) => {
  try {
    if (!signalCalculator) {
      return res.status(503).json({ error: "Services not initialized yet" });
    }

    const stats = await signalCalculator.notificationService.getStats();
    res.json({
      subscribers: stats,
      uptime: Math.floor(process.uptime()),
      lastCheck: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// Manual trigger endpoint (useful for testing)
app.post("/trigger-scan", async (req, res) => {
  try {
    if (!signalCalculator) {
      return res.status(503).json({ error: "Services not initialized yet" });
    }

    console.log("🔧 Manual signal scan triggered via API");
    const result = await signalCalculator.scan();

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
    console.error("❌ Manual scan error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add this after your existing endpoints

// Update your existing /memory endpoint:
app.get("/memory", (req, res) => {
  if (signalCalculator && signalCalculator.getMemoryAnalysis) {
    const analysis = signalCalculator.getMemoryAnalysis();
    res.json(analysis); // Now includes servicePool stats
  } else {
    res.json({ error: "Memory monitoring not available" });
  }
});

// Add new service management endpoint:
app.post("/restart-services", async (req, res) => {
  try {
    if (!signalCalculator) {
      return res.status(503).json({ error: "Calculator not initialized" });
    }

    console.log("🔄 Restarting services via API...");
    await signalCalculator.restartServices();

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

// Add service pool status endpoint:
app.get("/services", (req, res) => {
  if (signalCalculator && signalCalculator.servicePool) {
    const stats = signalCalculator.servicePool.getStats();
    res.json({
      pool: stats,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.json({ error: "Service pool not available" });
  }
});

// Force garbage collection endpoint
app.post("/gc", (req, res) => {
  if (signalCalculator && signalCalculator.memoryMonitor) {
    const freed = signalCalculator.memoryMonitor.forceGarbageCollection();
    res.json({
      message: "Garbage collection forced",
      freedMB: freed,
      newAnalysis: signalCalculator.getMemoryAnalysis(),
    });
  } else {
    res.json({ error: "Memory monitor not available" });
  }
});

// Enhanced memory endpoint with full analytics
app.get("/analytics", (req, res) => {
  if (!signalCalculator) {
    return res.status(503).json({ error: "Calculator not initialized" });
  }

  const analysis = signalCalculator.getMemoryAnalysis();

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
  if (!signalCalculator) {
    return res.status(503).json({ error: "Calculator not initialized" });
  }

  const analysis = signalCalculator.getMemoryAnalysis();

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
          averageDataPoints: analysis.dataProcessing.averageDataPointsPerSymbol,
          limitingRate: analysis.dataProcessing.limitingRate + "%",
          rejectionRate: analysis.dataProcessing.rejectionRate + "%",
        }
      : null,
    scans: analysis.scanCount,
    tradingPairs:
      analysis.config?.cryptoPairs + analysis.config?.stockPairs || 0,
  };

  res.json(performanceSummary);
});

// Data processing statistics endpoint
app.get("/data-stats", (req, res) => {
  if (signalCalculator && signalCalculator.dataProcessor) {
    const stats = signalCalculator.dataProcessor.getStats();
    res.json({
      dataProcessing: stats,
      limits: signalCalculator.dataProcessor.limits,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.json({ error: "Data processor not available" });
  }
});

// Reset data processing statistics
app.post("/reset-stats", (req, res) => {
  try {
    if (signalCalculator && signalCalculator.dataProcessor) {
      signalCalculator.dataProcessor.resetStats();
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

// Start the application
async function start() {
  try {
    // Initialize services first
    await initializeServices();

    // Start the web server
    app.listen(PORT, "0.0.0.0", () => {
      console.log("🚀 Trading Signals Bot started successfully!");
      console.log(`📡 Server running on port ${PORT}`);
      console.log(`🤖 Telegram bot is listening for commands`);
      console.log(`⏰ Signal checks scheduled for 00:01 UTC daily`);
      console.log(`📊 Stats available at: /stats`);
      console.log(`🔧 Manual trigger at: POST /trigger-scan`);
    });
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    process.exit(1);
  }
}

// Update your graceful shutdown to include cleanup
process.on("SIGTERM", async () => {
  console.log("👋 Received SIGTERM, shutting down gracefully...");
  if (signalCalculator && signalCalculator.cleanup) {
    await signalCalculator.cleanup();
  }
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("👋 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  // In production, you might want to restart gracefully
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
});

// Start the application
start();
