#!/usr/bin/env node

/**
 * Demo: Notification Formats for Separate Signal Types
 * Shows how different signal types create different notification messages
 */

const dayjs = require("dayjs");
const { formatPrice, formatSignalEmoji, getPatternEmoji, formatPatternName, getConfidenceEmoji } = require('./src/utils/formatters');

console.log('📱 Signal Notification Formats Demo');
console.log('==================================\n');

// Mock signals from the unified detection system
const mockSignals = [
  {
    type: "CDC_ACTION_ZONE",
    signal: "BUY",
    symbol: "ETH/USDT",
    marketType: "crypto",
    price: 4586.32,
    confidence: 85,
    details: {
      fastEMA: 4590.12,
      slowEMA: 4580.45,
      isBull: true,
      isBear: false,
    },
    timestamp: new Date(),
  },
  {
    type: "CDC_ACTION_ZONE", 
    signal: "SELL",
    symbol: "NVDA",
    marketType: "stocks",
    price: 125.43,
    confidence: 85,
    details: {
      fastEMA: 124.87,
      slowEMA: 126.12,
      isBull: false,
      isBear: true,
    },
    timestamp: new Date(),
  },
  {
    type: "PATTERN_ALERT",
    signal: "BUY", 
    symbol: "BTC/USDT",
    marketType: "crypto",
    price: 111760.00,
    confidence: 78,
    details: {
      patternType: "ASCENDING_TRIANGLE",
      direction: "BULLISH", 
      breakoutStatus: "BREAKOUT_UP",
    },
    timestamp: new Date(),
  },
  {
    type: "PATTERN_ALERT",
    signal: "WATCH",
    symbol: "SOL/USDT", 
    marketType: "crypto",
    price: 198.72,
    confidence: 66,
    details: {
      patternType: "SYMMETRICAL_TRIANGLE",
      direction: "NEUTRAL",
      breakoutStatus: "APPROACHING_RESISTANCE",
    },
    timestamp: new Date(),
  }
];

// Group signals by type
const signalsByType = mockSignals.reduce((acc, signal) => {
  acc[signal.type] = acc[signal.type] || [];
  acc[signal.type].push(signal);
  return acc;
}, {});

console.log('🎯 Unified Signal Architecture:');
console.log('• Multiple signal types detected independently');
console.log('• Each signal type gets its own notification');
console.log('• Users combine signals based on their strategy\n');

console.log('📊 Detected Signals Summary:');
Object.entries(signalsByType).forEach(([type, signals]) => {
  console.log(`- ${type}: ${signals.length} signals`);
});

// Format notifications for each signal type
console.log('\n📱 SEPARATE NOTIFICATIONS:');
console.log('=' .repeat(60));

// 1. CDC Action Zone Notification
if (signalsByType.CDC_ACTION_ZONE) {
  console.log('\n📧 CDC Action Zone Notification:');
  console.log('-'.repeat(40));
  console.log(formatCDCActionZoneSignals(signalsByType.CDC_ACTION_ZONE));
  console.log('-'.repeat(40));
}

// 2. Pattern Alert Notification  
if (signalsByType.PATTERN_ALERT) {
  console.log('\n📧 Pattern Alert Notification:');
  console.log('-'.repeat(40));
  console.log(formatPatternSignals(signalsByType.PATTERN_ALERT));
  console.log('-'.repeat(40));
}

console.log('\n✨ Key Benefits of Separate Notifications:');
console.log('• Clear signal type identification with appropriate titles');
console.log('• Users can choose which signal types to follow'); 
console.log('• CDC Action Zone = confirmed EMA crossover trend signals');
console.log('• Pattern Alerts = triangle breakout and formation signals');
console.log('• Easy to add new signal types (EMA50, RSI, MACD, etc.)');

console.log('\n🎯 Example User Strategies:');
console.log('Strategy A: "Follow CDC Action Zone BUY/SELL only"');
console.log('Strategy B: "Use CDC for trend + Pattern WATCH for timing"');
console.log('Strategy C: "Buy on CDC BUY + sell when price below EMA50 (future)"');
console.log('Strategy D: "Pattern breakouts for short-term scalping"');

console.log('\n🚀 Future Signal Types (Easy to Add):');
console.log('• EMA50_TREND: Price above/below EMA50 line');
console.log('• RSI_ALERT: Overbought/oversold conditions');
console.log('• MACD_SIGNAL: MACD line crossovers');  
console.log('• VOLUME_SPIKE: Unusual volume activity');
console.log('• SUPPORT_RESISTANCE: Key level breaks');

// Helper functions for formatting notifications

function formatCDCActionZoneSignals(signals) {
  let message = `🔔<b> CDC ACTION ZONE ALERT</b> 🔔\n🗓️ ${dayjs().format("D MMM")}\n`;
  message += `📊 Confirmed EMA12/26 Crossover Signals\n\n`;

  // Group by market type
  const cryptoSignals = signals.filter(s => s.marketType === 'crypto');
  const stockSignals = signals.filter(s => s.marketType === 'stocks');

  if (cryptoSignals.length > 0) {
    message += "💰<b> CRYPTO</b>\n";
    cryptoSignals.forEach(signal => {
      const price = formatPrice(signal.price, "crypto");
      message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${signal.signal} @ ${price}\n`;
    });
    message += "\n";
  }

  if (stockSignals.length > 0) {
    message += "📈<b> STOCKS</b>\n";
    stockSignals.forEach(signal => {
      const price = formatPrice(signal.price, "stock");
      message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${signal.signal} @ ${price}\n`;
    });
  }

  return message;
}

function formatPatternSignals(signals) {
  let message = `🔺<b> PATTERN ALERT</b> 🔺\n🗓️ ${dayjs().format("D MMM")}\n`;
  message += `📊 Triangle Pattern Breakouts & Formations\n\n`;

  // Group by market type
  const cryptoSignals = signals.filter(s => s.marketType === 'crypto');
  const stockSignals = signals.filter(s => s.marketType === 'stocks');

  if (cryptoSignals.length > 0) {
    message += "💰<b> CRYPTO</b>\n";
    cryptoSignals.forEach(signal => {
      const price = formatPrice(signal.price, "crypto");
      const patternEmoji = getPatternEmoji(signal.details.patternType);
      const confidenceEmoji = getConfidenceEmoji(signal.confidence);
      const patternName = formatPatternName(signal.details.patternType);
      
      message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${signal.signal} @ ${price}\n`;
      message += `  ${patternEmoji} ${patternName} (${signal.confidence}%${confidenceEmoji})\n`;
      
      if (signal.details.breakoutStatus === 'BREAKOUT_UP') {
        message += `  🚀 Bullish Breakout Confirmed!\n`;
      } else if (signal.details.breakoutStatus === 'BREAKOUT_DOWN') {
        message += `  💥 Bearish Breakout Confirmed!\n`;
      } else if (signal.signal === 'WATCH') {
        message += `  👀 Approaching breakout level\n`;
      }
      
      message += `\n`;
    });
  }

  if (stockSignals.length > 0) {
    message += "📈<b> STOCKS</b>\n";
    stockSignals.forEach(signal => {
      const price = formatPrice(signal.price, "stock");
      const patternEmoji = getPatternEmoji(signal.details.patternType);
      const confidenceEmoji = getConfidenceEmoji(signal.confidence);
      const patternName = formatPatternName(signal.details.patternType);
      
      message += `${formatSignalEmoji(signal.signal)} ${signal.symbol}: ${signal.signal} @ ${price}\n`;
      message += `  ${patternEmoji} ${patternName} (${signal.confidence}%${confidenceEmoji})\n`;
      
      if (signal.details.breakoutStatus === 'BREAKOUT_UP') {
        message += `  🚀 Bullish Breakout Confirmed!\n`;
      } else if (signal.details.breakoutStatus === 'BREAKOUT_DOWN') {
        message += `  💥 Bearish Breakout Confirmed!\n`;
      } else if (signal.signal === 'WATCH') {
        message += `  👀 Approaching breakout level\n`;
      }
      
      message += `\n`;
    });
  }

  return message;
}