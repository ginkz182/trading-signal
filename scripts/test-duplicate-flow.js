require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");
const ValidationService = require("../src/services/validation.service");

async function testDuplicateFlow() {
  const subService = new SubscriberService();
  const valService = new ValidationService();
  const testChatId = "TEST_DUP_" + Date.now();
  
  console.log(`🚀 Starting Duplicate Integration Test for User: ${testChatId}`);

  try {
    // 1. Subscribe User
    console.log("\n1. Subscribing user...");
    await subService.subscribe(testChatId, { username: "test_dup" });
    
    // 2. Add 'NVDA' (Stock) - Should be in defaults now
    console.log("\n2. Trying to add 'NVDA' (Should be default)...");
    const valNVDA = await valService.validate("NVDA");
    const result1 = await subService.addAsset(testChatId, valNVDA.formattedSymbol, valNVDA.type);
    console.log("Result 1 (NVDA):", result1);
    
    if (result1.status === 'added') throw new Error("NVDA should have been detected as duplicate (in defaults)");

    // 3. Add 'AAPL' (Stock) - New Asset
    console.log("\n3. Adding 'AAPL' (New)...");
    const valAAPL = await valService.validate("AAPL");
    const result2 = await subService.addAsset(testChatId, valAAPL.formattedSymbol, valAAPL.type);
    console.log("Result 2 (AAPL):", result2);
    
    if (result2.status !== 'added') throw new Error("AAPL should have been added");

    // 4. Add 'AAPL' Again - Duplicate
    console.log("\n4. Adding 'AAPL' Again (Duplicate)...");
    const result3 = await subService.addAsset(testChatId, valAAPL.formattedSymbol, valAAPL.type);
    console.log("Result 3 (AAPL Dup):", result3);
    
    if (result3.status === 'added') throw new Error("AAPL duplicate should have been detected");

    console.log("\n✅ Duplicate Flow Passed Successfully!");

  } catch (error) {
    console.error("\n❌ Test Failed:", error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    if (subService && testChatId) {
        await subService.unsubscribe(testChatId);
        await subService.pool.query("DELETE FROM subscribers WHERE chat_id = $1", [testChatId]);
        await subService.pool.query("DELETE FROM user_assets WHERE chat_id = $1", [testChatId]);
        await subService.close();
    }
  }
}

testDuplicateFlow();
