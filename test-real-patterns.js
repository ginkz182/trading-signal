#!/usr/bin/env node

/**
 * Test Real Pattern Detection with Actual Market Data
 */

const SignalCalculator = require('./src/core/SignalCalculator');

console.log('🚀 Testing Real Pattern Detection');
console.log('=================================\n');

async function testRealPatternDetection() {
  try {
    // Create signal calculator with pattern detection enabled
    const calculator = new SignalCalculator();
    
    console.log('📊 Configuration:');
    console.log(`- Patterns Enabled: ${calculator.indicatorManager.enablePatterns}`);
    console.log(`- Crypto Pairs: ${calculator.tradingPairs.crypto.length}`);
    console.log(`- Stock Symbols: ${calculator.tradingPairs.stocks.length}`);
    console.log('');

    // Test with a few specific symbols that are likely to have patterns
    const testSymbols = [
      { symbol: 'BTC/USDT', type: 'crypto' },
      { symbol: 'ETH/USDT', type: 'crypto' },
      { symbol: 'SOL/USDT', type: 'crypto' }
    ];

    console.log('🔍 Testing Pattern Detection on Select Symbols:');
    console.log('===============================================\n');

    for (const { symbol, type } of testSymbols) {
      console.log(`📈 Analyzing ${symbol}...`);
      
      try {
        const result = await calculator._processTradingPair(symbol, type);
        
        if (result) {
          console.log(`   ✅ Signal: ${result.signal}`);
          console.log(`   💰 Price: $${result.price.toFixed(4)}`);
          
          if (result.pattern) {
            console.log(`   🔺 Pattern: ${result.pattern.pattern || 'None detected'}`);
            if (result.pattern.pattern) {
              console.log(`   📊 Confidence: ${result.pattern.confidence}%`);
              console.log(`   📍 Direction: ${result.pattern.direction}`);
              console.log(`   🎯 Breakout: ${result.pattern.breakout?.status || 'FORMING'}`);
            }
          }
          
          if (result.details?.combined) {
            console.log(`   🧠 Combined Confidence: ${result.details.combined.confidence}%`);
            console.log(`   💭 Reasoning: ${result.details.combined.reasoning}`);
          }
          
          if (result.dataStats) {
            console.log(`   📋 Data: ${result.dataStats.processed}/${result.dataStats.original} points`);
          }
        } else {
          console.log(`   ⚪ No significant signals (HOLD)`);
        }
        
        console.log('');
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log('');
      }
    }

    console.log('🏁 Pattern Detection Test Complete!');
    console.log('\nTo see all patterns with live notifications:');
    console.log('1. npm start');
    console.log('2. curl -X POST http://localhost:3000/trigger-scan');
    
  } catch (error) {
    console.error('Failed to test pattern detection:', error);
  }
}

// Run the test
testRealPatternDetection();