#!/usr/bin/env node

/**
 * Pattern Detection Demo - Shows how the integrated system works
 * This demonstrates EMA + Triangle Pattern detection working together
 */

const IndicatorManager = require('./src/managers/indicator.manager');

console.log('🔺 Triangle Pattern Detection Demo');
console.log('==================================\n');

// Create indicator manager with pattern detection enabled
const indicatorManager = new IndicatorManager({
  fastPeriod: 12,
  slowPeriod: 26,
  enablePatterns: true,
  patternMinBars: 20,
  patternTolerance: 0.02,
  patternMinTouchPoints: 3
});

// Demo 1: Ascending Triangle with Bullish EMA Signal
console.log('📈 Demo 1: Ascending Triangle + Bullish EMA');
console.log('===========================================');

// Create mock OHLCV data for ascending triangle
const ascendingTriangleData = generateAscendingTriangle();

const result1 = indicatorManager.analyzePrice(ascendingTriangleData, 'DEMO/USDT');

console.log(`Signal: ${result1.signal}`);
console.log(`Confidence: ${result1.details?.combined?.confidence || 'N/A'}%`);
console.log(`Reasoning: ${result1.details?.combined?.reasoning || 'EMA only'}`);

if (result1.pattern && result1.pattern.pattern) {
  console.log(`\n🔺 Pattern Detected: ${result1.pattern.pattern}`);
  console.log(`   Confidence: ${result1.pattern.confidence}%`);
  console.log(`   Direction: ${result1.pattern.direction}`);
  console.log(`   Breakout Status: ${result1.pattern.breakout?.status || 'FORMING'}`);
  
  if (result1.pattern.tradingPlan?.alerts) {
    console.log(`\n💡 Trading Alerts:`);
    result1.pattern.tradingPlan.alerts.forEach(alert => {
      console.log(`   - ${alert.message}`);
    });
  }
}

console.log('\n' + '='.repeat(60) + '\n');

// Demo 2: Descending Triangle with Conflicting EMA Signal
console.log('📉 Demo 2: Descending Triangle vs Bullish EMA (Conflict)');
console.log('====================================================');

const descendingTriangleData = generateDescendingTriangle();

const result2 = indicatorManager.analyzePrice(descendingTriangleData, 'DEMO2/USDT');

console.log(`Signal: ${result2.signal}`);
console.log(`Confidence: ${result2.details?.combined?.confidence || 'N/A'}%`);
console.log(`Reasoning: ${result2.details?.combined?.reasoning || 'EMA only'}`);

if (result2.pattern && result2.pattern.pattern) {
  console.log(`\n🔻 Pattern Detected: ${result2.pattern.pattern}`);
  console.log(`   Confidence: ${result2.pattern.confidence}%`);
  console.log(`   Direction: ${result2.pattern.direction}`);
  console.log(`   Breakout Status: ${result2.pattern.breakout?.status || 'FORMING'}`);
}

console.log('\n' + '='.repeat(60) + '\n');

// Demo 3: Real-time Pattern Scanning
console.log('🔄 Demo 3: Simulating Real Market Scan');
console.log('====================================');

const mockMarketData = [
  { symbol: 'BTC/USDT', data: generateSymmetricalTriangle() },
  { symbol: 'ETH/USDT', data: generateAscendingTriangle() },
  { symbol: 'SOL/USDT', data: generateDescendingTriangle() }
];

mockMarketData.forEach((pair, index) => {
  console.log(`\n${index + 1}. Analyzing ${pair.symbol}...`);
  
  const result = indicatorManager.analyzePrice(pair.data, pair.symbol);
  
  console.log(`   Signal: ${result.signal} (Confidence: ${result.details?.combined?.confidence || 'N/A'}%)`);
  
  if (result.pattern && result.pattern.pattern) {
    const emoji = result.pattern.pattern === 'ASCENDING_TRIANGLE' ? '📈' : 
                  result.pattern.pattern === 'DESCENDING_TRIANGLE' ? '📉' : '🔺';
    console.log(`   ${emoji} ${result.pattern.pattern} detected (${result.pattern.confidence}%)`);
    
    if (result.pattern.breakout?.status !== 'FORMING') {
      console.log(`   🚨 ${result.pattern.breakout.status}!`);
    }
  } else {
    console.log(`   No significant patterns detected`);
  }
});

console.log('\n✅ Pattern Detection Demo Complete!');
console.log('\nTo test with real market data, run:');
console.log('npm start');
console.log('curl -X POST http://localhost:3000/trigger-scan');

// Helper functions to generate synthetic OHLCV data

function generateAscendingTriangle() {
  const prices = [];
  const ohlcv = [];
  
  // Generate 30 data points forming an ascending triangle
  for (let i = 0; i < 30; i++) {
    const timestamp = Date.now() - (30 - i) * 24 * 60 * 60 * 1000;
    
    // Ascending support line: gradually increasing lows
    const supportPrice = 100 + (i * 0.5);
    
    // Horizontal resistance at 115
    const resistancePrice = 115;
    
    // Generate OHLC around the triangle boundaries
    const low = supportPrice + (Math.random() * 2 - 1);
    const high = Math.min(resistancePrice - 0.5 + (Math.random() * 1), resistancePrice + 0.2);
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = 1000 + Math.random() * 500;
    
    prices.push(close);
    ohlcv.push([timestamp, open, high, low, close, volume]);
  }
  
  return {
    prices,
    ohlcv
  };
}

function generateDescendingTriangle() {
  const prices = [];
  const ohlcv = [];
  
  // Generate 30 data points forming a descending triangle
  for (let i = 0; i < 30; i++) {
    const timestamp = Date.now() - (30 - i) * 24 * 60 * 60 * 1000;
    
    // Horizontal support at 100
    const supportPrice = 100;
    
    // Descending resistance line: gradually decreasing highs
    const resistancePrice = 115 - (i * 0.5);
    
    const low = supportPrice - 0.2 + (Math.random() * 0.4);
    const high = Math.min(resistancePrice - (Math.random() * 1), resistancePrice + 0.5);
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = 1000 + Math.random() * 500;
    
    prices.push(close);
    ohlcv.push([timestamp, open, high, low, close, volume]);
  }
  
  return {
    prices,
    ohlcv
  };
}

function generateSymmetricalTriangle() {
  const prices = [];
  const ohlcv = [];
  
  // Generate 30 data points forming a symmetrical triangle
  for (let i = 0; i < 30; i++) {
    const timestamp = Date.now() - (30 - i) * 24 * 60 * 60 * 1000;
    
    // Ascending support line
    const supportPrice = 100 + (i * 0.3);
    
    // Descending resistance line
    const resistancePrice = 115 - (i * 0.3);
    
    const low = supportPrice + (Math.random() * 1 - 0.5);
    const high = resistancePrice + (Math.random() * 1 - 0.5);
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = 1000 + Math.random() * 500;
    
    prices.push(close);
    ohlcv.push([timestamp, open, high, low, close, volume]);
  }
  
  return {
    prices,
    ohlcv
  };
}