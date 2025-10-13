#!/usr/bin/env node

/**
 * Demo: Separate Signal Notifications
 * Shows how CDC Action Zone and Pattern Alerts are sent as separate notifications
 */

const SignalCalculator = require('./src/core/SignalCalculator');

console.log('📱 Separate Signal Notifications Demo');
console.log('===================================\n');

async function demoSeparateNotifications() {
  try {
    // Create signal calculator with the new unified architecture
    const calculator = new SignalCalculator();
    
    console.log('🎯 New Unified Signal Architecture:');
    console.log('• CDC Action Zone: EMA12/26 crossover confirmed signals');
    console.log('• Pattern Alerts: Triangle breakouts and formations');
    console.log('• Each signal type gets separate notification');
    console.log('• Users can combine signals for their strategy\n');

    // Mock some signals to demonstrate notifications
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

    // Group signals by type (like the real system does)
    const signalsByType = mockSignals.reduce((acc, signal) => {
      acc[signal.type] = acc[signal.type] || [];
      acc[signal.type].push(signal);
      return acc;
    }, {});

    console.log('📊 Detected Signals Summary:');
    Object.entries(signalsByType).forEach(([type, signals]) => {
      console.log(`- ${type}: ${signals.length} signals`);
    });
    console.log('');

    // Generate separate notifications for each signal type
    console.log('📱 SEPARATE NOTIFICATIONS:');
    console.log('=' .repeat(60));

    for (const [signalType, signals] of Object.entries(signalsByType)) {
      const message = calculator._formatSignalsByType(signalType, signals);
      
      console.log(`\n📧 ${signalType} Notification:`);
      console.log('-'.repeat(40));
      console.log(message);
      console.log('-'.repeat(40));
    }

    console.log('\n✨ Key Benefits of Separate Notifications:');
    console.log('• Clear signal type identification');
    console.log('• Users can choose which signals to follow'); 
    console.log('• CDC Action Zone = confirmed trend changes');
    console.log('• Pattern Alerts = breakout opportunities');
    console.log('• Easy to add new signal types (EMA50, RSI, etc.)');
    
    console.log('\n🎯 Example User Strategies:');
    console.log('Strategy A: Follow CDC Action Zone BUY/SELL only');
    console.log('Strategy B: Use CDC for trend + Pattern WATCH for timing');
    console.log('Strategy C: Buy on CDC BUY + sell when price below EMA50');
    console.log('Strategy D: Pattern breakouts for short-term trades');

  } catch (error) {
    console.error('Demo failed:', error);
  }
}

demoSeparateNotifications();