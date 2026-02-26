require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");
const NotificationService = require("../src/services/notification.service");

async function simulateSignal() {
  console.log("🚀 Starting signal simulation for Filtered Broadcasts test...");

  try {
    const subscriberService = new SubscriberService({
      databaseUrl: process.env.DATABASE_URL,
    });
    await subscriberService.initialize();

    const notificationService = new NotificationService({
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      subscriberService: subscriberService,
    });

    const mockSignals = {
      crypto: {
        'BTC/USDT': { signal: 'BUY', price: 95000.50, previousDayPrice: 92000.00, isBull: true, isBear: false, details: 'Strong breakout', dataSource: 'MOCK' },
        'DOGE/USDT': { signal: 'BUY', price: 0.15, previousDayPrice: 0.14, isBull: true, isBear: false, details: 'Meme rally', dataSource: 'MOCK' }
      },
      stocks: {}
    };

    console.log("Sending mock signals to subscribers...");
    const result = await notificationService.sendSignalsToSubscribers(mockSignals);
    
    console.log(`✅ Simulation complete.`);
    console.log(`📡 Total Sent: ${result.totalSent}`);
    console.log(`✅ Successful: ${result.successful.length}`);
    console.log(`❌ Failed: ${result.failed.length}`);
    if (result.failed.length > 0) {
        console.log("Failed details:", result.failed);
    }
  } catch (error) {
    console.error("❌ Error in simulation:", error);
  } finally {
    process.exit(0);
  }
}

simulateSignal();
