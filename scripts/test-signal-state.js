require("dotenv").config();
const SubscriberService = require("../src/services/subscriber.service");

async function testAssetStateUpdates() {
    console.log("============================================");
    console.log("🚀 Testing Asset State Updates (Position Tracker)");
    console.log("============================================\n");

    const subscriberService = new SubscriberService({
        databaseUrl: process.env.DATABASE_URL
    });

    try {
        await subscriberService.initialize();

        const testSymbol = "TEST_BTC/USDT";

        // ---------------------------------------------------------
        console.log(`[TEST 1] Testing BUY Signal (Trend changed to UPTREND)...`);
        // Simulate a BUY signal appearing at $90,000 today
        const buyPrice = 90000;
        const buyDate = new Date();
        
        const buyState = await subscriberService.recordBuySignal(testSymbol, buyPrice, buyDate);
        console.log(`✅ Database State after BUY:`);
        console.log({
            symbol: buyState.symbol,
            current_trend: buyState.current_trend,
            entry_price: buyState.entry_price,
            entry_date: buyState.entry_date
        });
        console.log("\n---------------------------------------------------------");

        // ---------------------------------------------------------
        console.log(`[TEST 2] Testing SELL Signal (Trend changed to DOWNTREND)...`);
        // Simulate a SELL signal appearing at $99,000 automatically computing a 10% PnL
        const sellPrice = 99000;
        const sellDate = new Date();
        
        const sellState = await subscriberService.recordSellSignal(testSymbol, sellPrice, sellDate);
        console.log(`✅ Database State after SELL:`);
        console.log({
            symbol: sellState.symbol,
            current_trend: sellState.current_trend,
            exit_price: sellState.exit_price,
            realized_pnl_percentage: sellState.realized_pnl_percentage + '%'
        });
        console.log("\n---------------------------------------------------------");

        // ---------------------------------------------------------
        console.log(`[TEST 3] Verifying data is readable for the /position command...`);
        const states = await subscriberService.getAssetStates([testSymbol]);
        console.log(`✅ Output from getAssetStates():`, states);

        // Cleanup
        console.log(`\n🧹 Cleaning up test data...`);
        await subscriberService.pool.query("DELETE FROM asset_states WHERE symbol = $1", [testSymbol]);
        console.log("✅ Test data removed.");

    } catch (error) {
        console.error("❌ Error during test:", error);
    } finally {
        await subscriberService.close();
        process.exit(0);
    }
}

testAssetStateUpdates();
