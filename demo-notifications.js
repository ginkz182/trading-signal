#!/usr/bin/env node

/**
 * Demo: How Pattern Detection Appears in Notifications
 */

const { formatSignals } = require('./src/utils/formatters');

console.log('📱 Pattern Detection in Notifications Demo');
console.log('=========================================\n');

// Simulate signals with pattern detection
const mockSignals = {
  crypto: {
    'BTC/USDT': {
      signal: 'HOLD',
      price: 111491.2000,
      pattern: {
        pattern: 'DESCENDING_TRIANGLE',
        confidence: 81,
        direction: 'BEARISH',
        breakout: {
          status: 'APPROACHING_RESISTANCE'
        },
        tradingPlan: {
          alerts: [
            { message: 'DESCENDING_TRIANGLE forming - Bearish bias. Watch for breakdown below 104785.09' },
            { message: 'Price approaching triangle resistance at 113568.06 (1.9% away)' }
          ]
        }
      },
      details: {
        combined: {
          confidence: 60,
          reasoning: 'EMA signal: HOLD, DESCENDING_TRIANGLE detected (81% confidence), Price approaching triangle resistance'
        }
      }
    },
    'ETH/USDT': {
      signal: 'BUY',
      price: 4586.32,
      pattern: {
        pattern: 'ASCENDING_TRIANGLE',
        confidence: 66,
        direction: 'BULLISH',
        breakout: {
          status: 'BREAKOUT_UP'
        },
        tradingPlan: {
          alerts: [
            { message: 'ASCENDING_TRIANGLE forming - Bullish bias. Watch for breakout above 2761.37' }
          ]
        }
      },
      details: {
        combined: {
          confidence: 75,
          reasoning: 'EMA signal: HOLD, ASCENDING_TRIANGLE detected (66% confidence), Bullish breakout confirmed'
        }
      }
    },
    'SOL/USDT': {
      signal: 'HOLD',
      price: 198.72,
      pattern: {
        pattern: 'SYMMETRICAL_TRIANGLE',
        confidence: 66,
        direction: 'NEUTRAL',
        breakout: {
          status: 'FORMING'
        },
        tradingPlan: {
          alerts: [
            { message: 'SYMMETRICAL_TRIANGLE forming - Neutral bias. Breakout direction will determine trend' }
          ]
        }
      },
      details: {
        combined: {
          confidence: 70,
          reasoning: 'EMA signal: HOLD, SYMMETRICAL_TRIANGLE detected (66% confidence), Symmetrical triangle forming - await breakout direction'
        }
      }
    }
  },
  stocks: {}
};

// Format the signals into a notification message
const message = formatSignals(mockSignals);

console.log('📧 Telegram Notification Message:');
console.log('=' .repeat(50));
console.log(message);
console.log('=' .repeat(50));

console.log('\n✨ Key Features Shown:');
console.log('• Pattern type with confidence level and emoji');
console.log('• Breakout status with directional indicators'); 
console.log('• Trading plan alerts and recommendations');
console.log('• Combined confidence scores (EMA + Pattern)');
console.log('• Visual hierarchy with emojis and formatting');

console.log('\n🚀 To see this live with real data:');
console.log('1. Set up DATABASE_URL environment variable');
console.log('2. npm start');
console.log('3. curl -X POST http://localhost:3000/trigger-scan');
console.log('4. Check your Telegram notifications!');