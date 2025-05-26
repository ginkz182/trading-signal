// app.js - Main file for Railway deployment
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const SignalCalculator = require("./src/SignalCalculator");
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

// Schedule signal checking - runs daily at 00:01 UTC
cron.schedule(
  "1 0 * * *",
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

// Graceful shutdown handlers
process.on("SIGTERM", async () => {
  console.log("👋 Received SIGTERM, shutting down gracefully...");
  // Close database connections if needed
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
