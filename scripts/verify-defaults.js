require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");

async function verifyDefaults() {
  const service = new SubscriberService();
  const testChatId = "TEST_DEFAULTS_" + Date.now();

  try {
    console.log(`Checking defaults for new user ${testChatId}...`);
    
    // Trigger sync by adding a dummy asset (or just calling existing method if exposed, but addAsset triggers it)
    // We'll try to add a random asset to trigger sync.
    await service.addAsset(testChatId, "DUMMY");
    
    const assets = await service.getAllUniqueSubscribedAssets();
    // But wait, getAllUniqueSubscribedAssets returns ALL assets for EVERYONE (union).
    // I need getUserAssets to check specific user.
    const userAssets = await service.getUserAssets(testChatId);
    
    console.log("User Defaults:", userAssets);
    
    const hasNVDA = userAssets.includes("NVDA");
    console.log(`Has NVDA (Stock)? ${hasNVDA}`);
    
    // Cleanup
    await service.unsubscribe(testChatId);
    await service.pool.query("DELETE FROM subscribers WHERE chat_id = $1", [testChatId]);
    await service.pool.query("DELETE FROM user_assets WHERE chat_id = $1", [testChatId]);
    await service.close();

  } catch (e) {
    console.error(e);
  }
}

verifyDefaults();
