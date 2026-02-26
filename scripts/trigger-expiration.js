require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");

async function manualTrigger() {
  console.log("⏰ Manually triggering subscription expiration check...");
  const service = new SubscriberService();
  
  try {
    await service.initialize();
    const results = await service.checkExpirations();
    console.log(`✅ Expiration check complete.`);
    console.log(`📉 Users downgraded: ${results.downgraded}`);
    if (results.distinctUsers && results.distinctUsers.length > 0) {
        console.log(`👤 Affected Chat IDs:`, results.distinctUsers);
    }
  } catch (error) {
    console.error("❌ Error in expiration check:", error);
  } finally {
    process.exit(0);
  }
}

manualTrigger();
