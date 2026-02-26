require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");
const ValidationService = require("../src/services/validation.service");

async function testValidationFlow() {
  const subService = new SubscriberService();
  const valService = new ValidationService();
  const testChatId = "TEST_USER_" + Date.now();
  
  console.log(`🚀 Starting Validation Integration Test for User: ${testChatId}`);

  try {
    // 1. Subscribe User (as Resident)
    console.log("\n1. Subscribing user...");
    await subService.subscribe(testChatId, { username: "test_validator" });
    await subService.updateSubscription(testChatId, 'purrfect_resident', 7, 'test');
    
    // 2. Validate & Add Crypto (BTC)
    console.log("\n2. Validating Crypto 'BTC'...");
    const valBTC = await valService.validate("BTC");
    console.log("BTC Validation:", valBTC);
    if (!valBTC.isValid || valBTC.type !== 'crypto') throw new Error("BTC validation failed");

    await subService.addAsset(testChatId, valBTC.formattedSymbol, valBTC.type);
    
    // 3. Validate & Add Stock (AAPL)
    console.log("\n3. Validating Stock 'AAPL'...");
    const valAAPL = await valService.validate("AAPL");
    console.log("AAPL Validation:", valAAPL);
    if (!valAAPL.isValid || valAAPL.type !== 'stock') throw new Error("AAPL validation failed");
    
    await subService.addAsset(testChatId, valAAPL.formattedSymbol, valAAPL.type);

    // 4. Validate & Add Suffix Crypto (ADA)
    console.log("\n4. Validating Suffix Crypto 'ADA'...");
    const valADA = await valService.validate("ADA");
    console.log("ADA Validation:", valADA);
    if (!valADA.isValid || valADA.type !== 'crypto' || valADA.formattedSymbol !== 'ADA/USDT') throw new Error("ADA validation/suffix failed");

    await subService.addAsset(testChatId, valADA.formattedSymbol, valADA.type);

    // 5. Verify Assets in Service
    console.log("\n5. Verifying unique assets...");
    const assets = await subService.getAllUniqueSubscribedAssets();
    console.log("Assets:", assets);
    
    if (!assets.crypto.includes("BTC/USDT")) throw new Error("BTC/USDT missing in crypto list");
    if (!assets.crypto.includes("ADA/USDT")) throw new Error("ADA/USDT missing in crypto list");
    if (!assets.stocks.includes("AAPL")) throw new Error("AAPL missing in stock list");

    // 6. Test Request Logic (DB Insert)
    console.log("\n6. Testing Request Asset...");
    await subService.pool.query(
        "INSERT INTO requested_assets (chat_id, symbol, status) VALUES ($1, $2, 'pending')",
        [testChatId, "INVALID_COIN"]
    );
    const reqRes = await subService.pool.query("SELECT * FROM requested_assets WHERE chat_id = $1", [testChatId]);
    if (reqRes.rows.length === 0) throw new Error("Request insertion failed");
    console.log("Request verified:", reqRes.rows[0]);

  } catch (error) {
    console.error("\n❌ Test Failed:", error);
    process.exitCode = 1;
  } finally {
    // Cleanup
    console.log("\n7. Cleanup...");
    if (subService && testChatId) {
        try {
            await subService.unsubscribe(testChatId);
            await subService.pool.query("DELETE FROM subscribers WHERE chat_id = $1", [testChatId]);
            await subService.pool.query("DELETE FROM requested_assets WHERE chat_id = $1", [testChatId]);
            console.log("Cleanup completed.");
        } catch (cleanupError) {
            console.error("Cleanup failed:", cleanupError);
        }
        
        // Close connections
        await subService.close();
    }
  }
}

testValidationFlow();
