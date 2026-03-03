require("dotenv").config();
const { Pool } = require("pg");
const fs = require('fs');
const path = require('path');
const config = require("../src/config");

// Services initialization
const SubscriberService = require("../src/services/subscriber.service");
const SignalCalculator = require("../src/core/SignalCalculator");

async function main() {
    console.log("🚀 Starting historical asset state initialization...");
    console.log(`Timecheck: ${new Date().toISOString()}`);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const subscriberService = new SubscriberService({ databaseUrl: process.env.DATABASE_URL });
    await subscriberService.initialize();

    // Setup dummy notification service to pass context
    const mockNotificationService = { subscriberService };

    // Set up SignalCalculator explicitly just for initialization
    const signalCalculator = new SignalCalculator({ 
        timeframe: '1d' // Or whatever default is used
    }, mockNotificationService);

    try {
        await pool.query('TRUNCATE TABLE asset_states');
        console.log("Cleared existing asset states for re-initialization.");

        // Find ALL unique assets that are currently tracked by users
        const query = await pool.query(`
            SELECT DISTINCT symbol, type 
            FROM user_assets
            WHERE action = 'added'
        `);
        
        const customAssets = query.rows;
        const defaultCrypto = (config.symbols || []).map(s => ({ symbol: s, type: 'crypto' }));
        const defaultStocks = (config.stockSymbols || []).map(s => ({ symbol: s, type: 'stock' }));

        // Deduplicate
        const uniqueAssetsMap = new Map();
        [...defaultCrypto, ...defaultStocks, ...customAssets].forEach(asset => {
            if (!uniqueAssetsMap.has(asset.symbol)) {
                uniqueAssetsMap.set(asset.symbol, asset.type);
            }
        });

        const totalToProcess = uniqueAssetsMap.size;
        console.log(`Found ${totalToProcess} unique assets to process across defaults and user lists.`);

        let processed = 0;
        let success = 0;
        let failed = 0;

        for (const [symbol, type] of uniqueAssetsMap.entries()) {
            processed++;
            console.log(`[${processed}/${totalToProcess}] Initializing states for ${symbol} (${type})...`);
            try {
                // Call the existing exact historical back-lookup logic!
                await signalCalculator.initializeAssetState(symbol, type);
                success++;
            } catch (err) {
                console.error(`❌ Failed to initialize ${symbol}:`, err.message);
                failed++;
            }
            
            // Add a small delay between assets to not hit Yahoo/Kucoin rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        console.log("\n=================================");
        console.log("🏁 Initialization complete!");
        console.log(`   Total assets: ${totalToProcess}`);
        console.log(`   Success: ${success}`);
        console.log(`   Failed: ${failed}`);
        console.log("=================================");

    } catch (e) {
        console.error("Fatal error during initialization:", e);
    } finally {
        await signalCalculator.cleanup();
        await subscriberService.close();
        await pool.end();
        process.exit(0);
    }
}

main().catch(console.error);
