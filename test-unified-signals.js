#!/usr/bin/env node

/**
 * Test the new unified signal detection system
 * Shows separate CDC Action Zone and Pattern Alert notifications
 */

const IndicatorManager = require('./src/managers/indicator.manager');
const ExchangeServicePool = require('./src/services/data/ExchangeServicePool');
const MarketDataProcessor = require('./src/core/MarketDataProcessor');

console.log('🎯 Unified Signal Detection System Test');
console.log('=====================================\n');

async function testUnifiedSignalSystem() {
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
    });

    console.log('✅ Components initialized');
    console.log('📊 Testing unified signal architecture\n');

    // Test with a symbol that might have both signal types
    const symbol = 'BTC/USDT';
    const marketType = 'crypto';

    console.log(`🔍 Analyzing ${symbol} for all signal types:`);
    console.log('=' .repeat(50));

    try {
      // Get exchange service and data
      const exchangeService = await servicePool.getService('kucoin', '1d');
      const rawPrices = await exchangeService.getPrices(symbol);
      
      if (!rawPrices) {
        console.log('❌ No data received');
        return;
      }

      const processedData = dataProcessor.prepareForAnalysis(rawPrices, marketType, symbol);
      if (!processedData) {
        console.log('❌ Data processing failed');
        return;
      }

      console.log(`📊 Processed: ${processedData.processedLength} points`);
      console.log(`📈 OHLCV data: ${processedData.hasOhlcv ? 'Available' : 'Not available'}`);
      console.log('');

      // Get analysis
      const analysis = indicatorManager.analyzePrice(processedData, symbol);

      // Simulate the new signal detection logic
      const allSignals = [];

      // 1. CDC Action Zone Signal (EMA Crossover)
      if (analysis.signal && analysis.signal !== "HOLD") {
        const cdcSignal = {
          type: "CDC_ACTION_ZONE",
          signal: analysis.signal,
          symbol,
          marketType,
          price: processedData.latestPrice,
          confidence: 85,
          details: {
            fastEMA: analysis.fastEMA,
            slowEMA: analysis.slowEMA,
            isBull: analysis.isBull,
            isBear: analysis.isBear,
          },
          timestamp: new Date(),
        };
        allSignals.push(cdcSignal);
        
        console.log('🔔 CDC ACTION ZONE SIGNAL DETECTED:');
        console.log(`   Signal: ${cdcSignal.signal}`);
        console.log(`   Price: $${cdcSignal.price?.toFixed(4) || 'N/A'}`);
        console.log(`   Confidence: ${cdcSignal.confidence}%`);
        console.log(`   EMA12: ${analysis.fastEMA?.toFixed(2) || 'N/A'}`);
        console.log(`   EMA26: ${analysis.slowEMA?.toFixed(2) || 'N/A'}`);
        console.log('');
      }

      // 2. Pattern Signal
      if (analysis.pattern && analysis.pattern.pattern) {
        const patternSignal = determinePatternSignal(analysis.pattern);
        if (patternSignal !== "HOLD") {
          const patternAlert = {
            type: "PATTERN_ALERT",
            signal: patternSignal,
            symbol,
            marketType,
            price: processedData.latestPrice,
            confidence: analysis.pattern.confidence,
            details: {
              patternType: analysis.pattern.pattern,
              direction: analysis.pattern.direction,
              breakoutStatus: analysis.pattern.breakout?.status || 'FORMING',
            },
            timestamp: new Date(),
          };
          allSignals.push(patternAlert);
          
          console.log('🔺 PATTERN ALERT DETECTED:');
          console.log(`   Signal: ${patternAlert.signal}`);
          console.log(`   Pattern: ${analysis.pattern.pattern}`);
          console.log(`   Price: $${patternAlert.price?.toFixed(4) || 'N/A'}`);
          console.log(`   Confidence: ${patternAlert.confidence}%`);
          console.log(`   Direction: ${analysis.pattern.direction}`);
          console.log(`   Breakout: ${analysis.pattern.breakout?.status || 'FORMING'}`);
          console.log('');
        }
      }

      if (allSignals.length === 0) {
        console.log('⚪ No actionable signals detected (HOLD conditions)\n');
        
        // Show what was analyzed
        console.log('📊 Analysis Summary:');
        console.log(`   EMA Signal: ${analysis.signal || 'HOLD'}`);
        if (analysis.pattern?.pattern) {
          console.log(`   Pattern Detected: ${analysis.pattern.pattern} (${analysis.pattern.confidence}%)`);
          console.log(`   Pattern Status: ${analysis.pattern.breakout?.status || 'FORMING'}`);
        } else {
          console.log(`   Pattern: None detected`);
        }
        console.log('');
      }

      // Show how notifications would be formatted
      if (allSignals.length > 0) {
        console.log('📱 NOTIFICATION EXAMPLES:');
        console.log('=' .repeat(50));

        // Group by signal type
        const signalsByType = allSignals.reduce((acc, signal) => {
          acc[signal.type] = acc[signal.type] || [];
          acc[signal.type].push(signal);
          return acc;
        }, {});

        Object.entries(signalsByType).forEach(([type, signals]) => {
          console.log(`\n${type} Notification:`);
          console.log('-'.repeat(30));
          console.log(formatNotificationExample(type, signals));
        });
      }

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Cleanup
    await servicePool.cleanup();
    
    console.log('\n✅ Unified Signal System Test Complete!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('• Separate signal types with independent detection');
    console.log('• CDC Action Zone for confirmed EMA crossovers');
    console.log('• Pattern Alerts for triangle breakouts and formations');
    console.log('• Scalable architecture for adding new signal types');
    console.log('• Separate notifications for each signal type');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Helper functions
function determinePatternSignal(patternAnalysis) {
  const { breakout } = patternAnalysis;
  
  if (breakout?.status === 'BREAKOUT_UP') {
    return 'BUY';
  } else if (breakout?.status === 'BREAKOUT_DOWN') {
    return 'SELL';
  } else if (breakout?.status === 'APPROACHING_RESISTANCE' || 
             breakout?.status === 'APPROACHING_SUPPORT') {
    return 'WATCH';
  }
  
  return 'HOLD';
}

function formatNotificationExample(signalType, signals) {
  const dayjs = require("dayjs");
  
  if (signalType === 'CDC_ACTION_ZONE') {
    let message = `🔔 CDC ACTION ZONE ALERT 🔔\n`;
    message += `🗓️ ${dayjs().format("D MMM")}\n`;
    message += `📊 Confirmed EMA12/26 Crossover Signals\n\n`;
    message += `💰 CRYPTO\n`;
    
    signals.forEach(signal => {
      const emoji = signal.signal === 'BUY' ? '🟢' : '🔴';
      message += `${emoji} ${signal.symbol}: ${signal.signal} @ $${signal.price?.toFixed(4) || 'N/A'}\n`;
    });
    
    return message;
  } else if (signalType === 'PATTERN_ALERT') {
    let message = `🔺 PATTERN ALERT 🔺\n`;
    message += `🗓️ ${dayjs().format("D MMM")}\n`;
    message += `📊 Triangle Pattern Breakouts & Formations\n\n`;
    message += `💰 CRYPTO\n`;
    
    signals.forEach(signal => {
      const emoji = signal.signal === 'BUY' ? '🟢' : 
                   signal.signal === 'SELL' ? '🔴' : 
                   signal.signal === 'WATCH' ? '👀' : '⚪';
      
      message += `${emoji} ${signal.symbol}: ${signal.signal} @ $${signal.price?.toFixed(4) || 'N/A'}\n`;
      message += `  🔺 ${signal.details.patternType} (${signal.confidence}%)\n`;
      
      if (signal.details.breakoutStatus === 'BREAKOUT_UP') {
        message += `  🚀 Bullish Breakout Confirmed!\n`;
      } else if (signal.details.breakoutStatus === 'BREAKOUT_DOWN') {
        message += `  💥 Bearish Breakout Confirmed!\n`;
      } else if (signal.signal === 'WATCH') {
        message += `  👀 Approaching breakout level\n`;
      }
    });
    
    return message;
  }
  
  return `🚨 ${signalType} ALERT 🚨\nExample notification format`;
}

testUnifiedSignalSystem();