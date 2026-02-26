require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");

async function testFlow() {
  const service = new SubscriberService();
  const testChatId = "TEST_USER_" + Date.now();
  
  console.log(`🚀 Starting Integration Test for User: ${testChatId}`);

  try {
    // 1. Subscribe User
    console.log("\n1. Subscribing user...");
    await service.subscribe(testChatId, { username: "test_user" });
    const sub = await service.getSubscriber(testChatId);
    console.log("Subscriber:", sub);

    // 2. Get Initial Assets (Should be Default)
    console.log("\n2. Checking initial assets...");
    const initialAssets = await service.getUserAssets(testChatId);
    console.log("Initial Assets:", initialAssets);
    
    // 3. Add Custom Asset (Should trigger sync + add)
    console.log("\n3. Adding custom asset 'SOL'...");
    await service.addAsset(testChatId, "SOL");
    
    const assetsAfterAdd = await service.getUserAssets(testChatId);
    console.log("Assets after ADD:", assetsAfterAdd);
    
    if (!assetsAfterAdd.includes("SOL")) throw new Error("SOL not found!");
    if (assetsAfterAdd.length <= 1) throw new Error("Defaults not synced!");

    // 4. Remove Asset
    console.log("\n4. Removing asset 'BTC'...");
    await service.removeAsset(testChatId, "BTC");
    
    const assetsAfterRemove = await service.getUserAssets(testChatId);
    console.log("Assets after REMOVE:", assetsAfterRemove);
    
    if (assetsAfterRemove.includes("BTC")) throw new Error("BTC still present!");

    // 5. Check Unique Subscribed Assets
    console.log("\n5. Checking all unique subscribed assets...");
    const uniqueAssets = await service.getAllUniqueSubscribedAssets();
    console.log("All Unique Assets:", uniqueAssets);

    // 6. Subscription Management Test
    console.log("\n6. Testing Subscription Management...");
    
    // Grant subscription (Resident, 1 day)
    console.log("Upgrading to resident...");
    await service.updateSubscription(testChatId, 'resident', 1, 'test_script');
    let subUpdate = await service.getSubscriber(testChatId);
    console.log(`Upgraded to: ${subUpdate.tier}`);
    if (subUpdate.tier !== 'resident') throw new Error("Upgrade failed");

    // Force Expiration (Set to yesterday)
    console.log("Forcing expiration...");
    await service.pool.query(
        "UPDATE subscribers SET subscription_end_at = NOW() - INTERVAL '1 day' WHERE chat_id = $1", 
        [testChatId]
    );

    // Run Expiration Check
    console.log("Running expiration check...");
    const stats = await service.checkExpirations();
    console.log("Expiration Stats:", stats);
    
    // Only check for > 0 because other tests/runs might have left data, but at least our user should be there
    if (!stats.distinctUsers.includes(testChatId)) throw new Error("Expiration check failed for test user");

    subUpdate = await service.getSubscriber(testChatId);
    console.log(`Status after check: ${subUpdate.tier}`);
    if (subUpdate.tier !== 'free') throw new Error("Downgrade failed");

    // 7. Cleanup
    console.log("\n7. Cleaning up...");
    await service.unsubscribe(testChatId);
    // Manually delete for clean slate (optional, but good for meaningful tests)
    const client = await service.pool.connect();
    await client.query("DELETE FROM subscribers WHERE chat_id = $1", [testChatId]);
    await client.query("DELETE FROM subscription_history WHERE chat_id = $1", [testChatId]);
    client.release();

    console.log("\n✅ Test Flow Passed Successfully!");

  } catch (error) {
    console.error("\n❌ Test Failed:", error);
  } finally {
    await service.close();
  }
}

testFlow();
