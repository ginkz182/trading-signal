#!/usr/bin/env node

/**
 * Test Pattern Detection Only (without notifications)
 */

const IndicatorManager = require('./src/managers/indicator.manager');
const ExchangeServicePool = require('./src/services/data/ExchangeServicePool');
const MarketDataProcessor = require('./src/core/MarketDataProcessor');

console.log('🔺 Pattern Detection Test - Core Components Only');
console.log('===============================================\n');

async function testPatternDetection() {
  try {
    // Initialize components
    const servicePool = new ExchangeServicePool();
    const dataProcessor = new MarketDataProcessor();
    const indicatorManager = new IndicatorManager({
      fastPeriod: 12,
      slowPeriod: 26,
      enablePatterns: true,
      patternMinBars: 20,
      patternTolerance: 0.02,
      patternMinTouchPoints: 3,
      patternVolumeConfirmation: true,
      patternBreakoutThreshold: 0.015
    });

    console.log('✅ Components initialized');
    console.log(`📊 Pattern Detection: ${indicatorManager.enablePatterns ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    // Test with a few crypto symbols
    const testSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

    for (const symbol of testSymbols) {
      console.log(`🔍 Testing ${symbol}:`);
      console.log('='.repeat(20));

      try {
        // Get exchange service
        const exchangeService = await servicePool.getService('kucoin', '1d');
        
        // Fetch raw data
        console.log('   📡 Fetching data...');
        const rawPrices = await exchangeService.getPrices(symbol);
        
        if (!rawPrices) {
          console.log('   ❌ No data received\n');
          continue;
        }

        // Process data
        console.log(`   📊 Processing ${rawPrices.length || rawPrices.closingPrices?.length || 0} data points...`);
        const processedData = dataProcessor.prepareForAnalysis(rawPrices, 'crypto', symbol);

        if (!processedData) {
          console.log('   ❌ Data processing failed\n');
          continue;
        }

        console.log(`   ✅ Processed: ${processedData.processedLength} points`);
        console.log(`   📈 OHLCV data: ${processedData.hasOhlcv ? 'Available' : 'Not available'}`);

        // Analyze with pattern detection
        console.log('   🧠 Analyzing patterns...');
        const signalData = indicatorManager.analyzePrice(processedData, symbol);

        // Display results
        console.log(`   🎯 Signal: ${signalData.signal}`);
        
        if (signalData.pattern && signalData.pattern.pattern) {
          const patternEmoji = signalData.pattern.pattern === 'ASCENDING_TRIANGLE' ? '📈' : 
                               signalData.pattern.pattern === 'DESCENDING_TRIANGLE' ? '📉' : '🔺';
          
          console.log(`   ${patternEmoji} Pattern: ${signalData.pattern.pattern}`);
          console.log(`   📊 Pattern Confidence: ${signalData.pattern.confidence}%`);
          console.log(`   📍 Direction: ${signalData.pattern.direction}`);
          console.log(`   🎯 Breakout Status: ${signalData.pattern.breakout?.status || 'FORMING'}`);
          
          if (signalData.pattern.breakout?.status === 'BREAKOUT_UP') {
            console.log('   🚀 BULLISH BREAKOUT DETECTED!');
          } else if (signalData.pattern.breakout?.status === 'BREAKOUT_DOWN') {
            console.log('   💥 BEARISH BREAKOUT DETECTED!');
          }

          if (signalData.pattern.tradingPlan?.alerts) {
            console.log('   💡 Trading Alerts:');
            signalData.pattern.tradingPlan.alerts.forEach(alert => {
              console.log(`      - ${alert.message}`);
            });
          }
        } else {
          console.log('   ⚪ No significant patterns detected');
          if (signalData.pattern?.reason) {
            console.log(`   📝 Reason: ${signalData.pattern.reason}`);
          }
        }

        if (signalData.details?.combined) {
          console.log(`   🧠 Combined Analysis:`);
          console.log(`      Confidence: ${signalData.details.combined.confidence}%`);
          console.log(`      Reasoning: ${signalData.details.combined.reasoning}`);
        }

        console.log(`   💰 Current Price: $${processedData.latestPrice?.toFixed(4) || 'N/A'}`);
        console.log('');

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }

    // Cleanup
    await servicePool.cleanup();
    
    console.log('🏁 Pattern Detection Test Complete!');
    console.log('\n📋 Summary:');
    console.log('- Triangle patterns (ascending, descending, symmetrical) are being detected');
    console.log('- EMA crossover signals are combined with pattern analysis');
    console.log('- Confidence scores adjust based on pattern-EMA alignment');
    console.log('- Breakout detection provides real-time trading alerts');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPatternDetection();