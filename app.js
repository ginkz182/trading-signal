// app.js - Main file for Railway deployment
require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const SignalCalculator = require("./src/core/SignalCalculator");
const TelegramBotHandler = require("./src/services/telegram-bot-handler");
const NotificationService = require("./src/services/notification.service");
const PaymentService = require("./src/services/payment.service");
const SubscriberService = require("./src/services/subscriber.service");
const MonitorService = require("./src/services/monitor.service");
const createWebhookController = require("./src/controllers/webhook.controller");
const config = require("./src/config");

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Payment Service early for Webhooks
// Note: We need subscriberService, effectively we need to init it properly.
// But `initializeServices` is async and called later. 
// For webhooks to work *immediately* on startup, we might need a slight refactor 
// or just init them here.
// However, `app.js` structure inits services in `initializeServices`.
// Let's keep the pattern but we need to declare variables globally.

// Global variables for services
let signalCalculator;
let botHandler;
let notificationService;
let subscriberService;
let monitorService;
let paymentService;

// --- Webhooks (Must be before express.json) ---
// We need a temporary or lazy access to paymentService inside the route
app.use('/api/webhooks', (req, res, next) => {
    if (!paymentService) {
        return res.status(503).send("Payment service not ready");
    }
    // Pass control to the actual router
    next();
}, (req, res, next) => {
    // We create the router on the fly or reuse it? 
    // Actually, `createWebhookController` returns a router.
    // We can mount it, but it needs paymentService instance.
    // Solution: Initialize services FIRST, or use a wrapper.
    createWebhookController(paymentService)(req, res, next);
});

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

// Payment result pages
app.get("/payment/success", (req, res) => {
  const botUsername = config.telegram.botUsername;
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Successful</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f0f0f;color:#fff;}
.card{text-align:center;padding:40px;border-radius:16px;background:#1a1a2e;max-width:400px;}
h1{color:#4ade80;margin-bottom:8px;}a{display:inline-block;margin-top:20px;padding:12px 32px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;}
a:hover{background:#1d4ed8;}</style></head>
<body><div class="card"><h1>🎉 Payment Successful!</h1><p>Your subscription has been activated.</p>
<a href="https://t.me/${botUsername}">Return to Bot</a></div></body></html>`);
});

app.get("/payment/cancel", (req, res) => {
  const botUsername = config.telegram.botUsername;
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Cancelled</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0f0f0f;color:#fff;}
.card{text-align:center;padding:40px;border-radius:16px;background:#1a1a2e;max-width:400px;}
h1{margin-bottom:8px;}a{display:inline-block;margin-top:20px;padding:12px 32px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;}
a:hover{background:#1d4ed8;}</style></head>
<body><div class="card"><h1>Payment Cancelled</h1><p>No charges were made. You can try again anytime.</p>
<a href="https://t.me/${botUsername}">Return to Bot</a></div></body></html>`);
});



async function runCronJob() {
  const jobName = "Daily Signal Scan";
  console.log(
    "⏰ [" + new Date().toISOString() + "] Scheduled signal check starting...",
  );
  try {
    const result = await signalCalculator.scan();
    if (result.message) {
      console.log("📊 Signals found and sent to subscribers");
    } else {
      console.log("📈 No signals detected");
    }
    if (monitorService) {
      await monitorService.notifyCronRunStatus(true, jobName);
    }
    return { success: true, result };
  } catch (error) {
    console.error("❌ Error in scheduled signal check:", error);
    if (monitorService) {
      await monitorService.notifyCronRunStatus(false, jobName, error);
    }
    return { success: false, error };
  }
}

// Initialize all services
async function initializeServices() {
  try {
    console.log("🔧 Initializing services...");

    // Core services
    subscriberService = new SubscriberService({
      databaseUrl: process.env.DATABASE_URL,
    });
    await subscriberService.initialize();

    notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      subscriberService: subscriberService,
    });

    monitorService = new MonitorService(
      notificationService,
      process.env.ADMIN_CHAT_ID,
    );

    // Initialize Signal Calculator with Railway-optimized config
    signalCalculator = new SignalCalculator(config, notificationService);

    // Initialize Payment Service
    paymentService = new PaymentService(subscriberService, notificationService, monitorService);

    // Initialize Telegram Bot Handler
    botHandler = new TelegramBotHandler({
      token: process.env.TELEGRAM_BOT_TOKEN,
      subscriberService: subscriberService,
      monitorService: monitorService,
      paymentService: paymentService, // Inject for /subscribe command
    });

    console.log("✅ All services initialized successfully");
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
    await runCronJob();
  },
  {
    timezone: "UTC",
  },
);

// Schedule subscription expiration check - runs daily at 01:00 UTC
cron.schedule(
  "0 1 * * *",
  async () => {
    console.log("⏰ Running daily subscription expiration check...");
    if (subscriberService) {
        try {
            const results = await subscriberService.checkExpirations();
            console.log(`✅ Expiration check complete. Downgraded: ${results.downgraded}`);
            if (monitorService) {
                await monitorService.notifyCronRunStatus(true, "Subscription Expiration Check");
            }
        } catch (error) {
            console.error("❌ Error in expiration check:", error);
            if (monitorService) {
                await monitorService.notifyCronRunStatus(false, "Subscription Expiration Check", error);
            }
        }
    }
  },
  {
    timezone: "UTC",
  },
);

// --- Subscription Management API ---
app.post("/api/subscription/update", async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { chatId, tier, durationDays } = req.body;

    if (!chatId || !tier) {
        return res.status(400).json({ error: "Missing chatId or tier" });
    }

    try {
        if (!subscriberService) {
            return res.status(503).json({ error: "Service not available" });
        }

        const result = await subscriberService.updateSubscription(chatId, tier, durationDays, "api_purchase");
        
        // Notify user about update
        if (botHandler && botHandler.bot) {
            try {
                await botHandler.bot.sendMessage(
                    chatId, 
                    `🎉 <b>Subscription Update!</b>\n\nYou have been upgraded to <b>${tier.toUpperCase()}</b> tier.\nExpires: ${result.expiresAt ? result.expiresAt.toLocaleDateString() : 'Never'}`,
                    { parse_mode: 'HTML' }
                );
            } catch (e) {
                console.warn(`Failed to notify user ${chatId} of update via API`);
            }
        }

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("API Subscription Update Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
