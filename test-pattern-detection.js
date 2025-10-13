#!/usr/bin/env node

/**
 * Triangle Pattern Detection Test & Demo Script
 * 
 * This script demonstrates the triangle pattern detection capabilities
 * integrated into the trading signal system. It generates test data
 * for different triangle patterns and shows how the system detects them.
 */

const SignalCalculator = require('./src/core/SignalCalculator');
const PatternService = require('./src/services/pattern.service');
const IndicatorManager = require('./src/managers/indicator.manager');
const config = require('./src/config');

class PatternDetectionDemo {
  constructor() {
    this.patternService = new PatternService(config.patterns);
    this.indicatorManager = new IndicatorManager({
      enablePatterns: true,
      ...config.patterns
    });
    
    console.log('🔧 Triangle Pattern Detection Demo Initialized');
    console.log('📊 Pattern Configuration:', config.patterns);
  }

  /**
   * Generate synthetic OHLCV data for testing triangle patterns
   */
  generateTriangleData(type = 'ascending', bars = 50) {
    const data = [];
    let basePrice = 100;
    const timestamp = Date.now() - (bars * 24 * 60 * 60 * 1000); // Start from 'bars' days ago
    
    for (let i = 0; i < bars; i++) {
      const progress = i / bars;
      let high, low, open, close;
      
      // Create different triangle patterns
      switch (type) {
        case 'ascending':
          // Horizontal resistance around 110, ascending support
          high = 110 + Math.random() * 2 - 1; // Resistance line with noise
          low = basePrice + (progress * 8) + Math.random() * 2 - 1; // Ascending support
          break;
          
        case 'descending':
          // Descending resistance, horizontal support around 95
          high = basePrice + 15 - (progress * 12) + Math.random() * 2 - 1; // Descending resistance
          low = 95 + Math.random() * 2 - 1; // Support line with noise
          break;
          
        case 'symmetrical':
          // Both lines converging
          const spread = 15 * (1 - progress); // Narrowing spread
          high = basePrice + spread/2 + Math.random() * 2 - 1;
          low = basePrice - spread/2 + Math.random() * 2 - 1;
          break;
          
        default:
          // Random walk for comparison
          high = basePrice + Math.random() * 5;
          low = basePrice - Math.random() * 5;
      }
      
      // Ensure OHLC relationships are maintained
      open = low + Math.random() * (high - low);
      close = low + Math.random() * (high - low);
      
      // Ensure open/close are within high/low bounds
      if (open > high) open = high;
      if (open < low) open = low;
      if (close > high) close = high;
      if (close < low) close = low;
      
      // Generate volume (decreasing over time for realistic triangle pattern)
      const volume = Math.floor(1000000 * (1 - progress * 0.5) * (0.8 + Math.random() * 0.4));
      
      data.push([
        timestamp + (i * 24 * 60 * 60 * 1000), // timestamp
        Math.round(open * 100) / 100,          // open
        Math.round(high * 100) / 100,          // high
        Math.round(low * 100) / 100,           // low
        Math.round(close * 100) / 100,         // close
        volume                                 // volume
      ]);
      
      // Update base price slightly for next candle
      basePrice = close + (Math.random() - 0.5) * 0.5;
    }
    
    return data;
  }

  /**
   * Add breakout to existing triangle data
   */
  addBreakout(ohlcvData, direction = 'up', strength = 5) {
    const lastCandle = ohlcvData[ohlcvData.length - 1];
    const lastClose = lastCandle[4];
    
    // Add breakout candles
    for (let i = 0; i < 3; i++) {
      const timestamp = lastCandle[0] + ((i + 1) * 24 * 60 * 60 * 1000);
      const priceMove = direction === 'up' ? strength * (i + 1) : -strength * (i + 1);
      
      const open = i === 0 ? lastClose : ohlcvData[ohlcvData.length - 1][4];
      const close = open + priceMove + (Math.random() - 0.5);
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 1;
      const volume = Math.floor(2000000 * (1 + Math.random()));
      
      ohlcvData.push([
        timestamp,
        Math.round(open * 100) / 100,
        Math.round(high * 100) / 100,
        Math.round(low * 100) / 100,
        Math.round(close * 100) / 100,
        volume
      ]);
    }
    
    return ohlcvData;
  }

  /**
   * Test pattern detection on generated data
   */
  async testPattern(patternType, includeBreakout = false, breakoutDirection = 'up') {
    console.log(`\n🔍 Testing ${patternType.toUpperCase()} Triangle Pattern ${includeBreakout ? `with ${breakoutDirection.toUpperCase()} breakout` : ''}`);
    console.log('━'.repeat(80));
    
    // Generate test data
    let ohlcvData = this.generateTriangleData(patternType, 45);
    
    if (includeBreakout) {
      ohlcvData = this.addBreakout(ohlcvData, breakoutDirection, 5);
    }
    
    // Test with PatternService directly
    console.log('📊 Pattern Service Analysis:');
    try {
      const patternResult = this.patternService.detectTriangles(ohlcvData, `TEST_${patternType.toUpperCase()}`);
      
      if (patternResult.pattern) {
        console.log(`✅ Pattern Detected: ${patternResult.pattern}`);
        console.log(`📈 Confidence: ${patternResult.confidence}%`);
        console.log(`🎯 Direction: ${patternResult.direction}`);
        console.log(`📊 Reliability: ${patternResult.reliability}`);
        
        if (patternResult.breakout) {
          console.log(`🚀 Breakout Status: ${patternResult.breakout.status}`);
          if (patternResult.breakout.direction) {
            console.log(`📍 Breakout Direction: ${patternResult.breakout.direction}`);
          }
          console.log(`💰 Current Price: ${patternResult.breakout.currentPrice}`);
          console.log(`⬆️ Upper Breakout Level: ${patternResult.breakout.upperBreakout.toFixed(4)}`);
          console.log(`⬇️ Lower Breakout Level: ${patternResult.breakout.lowerBreakout.toFixed(4)}`);
        }
        
        if (patternResult.tradingPlan && patternResult.tradingPlan.alerts) {
          console.log(`📢 Trading Alerts:`);
          patternResult.tradingPlan.alerts.forEach((alert, idx) => {
            console.log(`  ${idx + 1}. ${alert.message}`);
          });
        }
      } else {
        console.log(`❌ No pattern detected. Reason: ${patternResult.reason}`);
      }
    } catch (error) {
      console.error(`❌ Pattern detection error: ${error.message}`);
    }
    
    // Test with IndicatorManager (integrated EMA + Pattern analysis)
    console.log('\n🧠 Integrated Analysis (EMA + Patterns):');
    try {
      const prices = ohlcvData.map(candle => candle[4]); // Extract close prices
      const marketData = {
        prices: prices,
        ohlcv: ohlcvData
      };
      
      const result = this.indicatorManager.analyzePrice(marketData, `TEST_${patternType.toUpperCase()}`);
      
      console.log(`🎯 Combined Signal: ${result.signal}`);
      console.log(`📊 Fast EMA: ${result.fastEMA?.toFixed(4)}`);
      console.log(`📊 Slow EMA: ${result.slowEMA?.toFixed(4)}`);
      console.log(`🐂 Is Bull: ${result.isBull}`);
      console.log(`🐻 Is Bear: ${result.isBear}`);
      
      if (result.details && result.details.combined) {
        console.log(`🎯 Combined Confidence: ${result.details.combined.confidence}%`);
        console.log(`💭 Reasoning: ${result.details.combined.reasoning}`);
      }
      
    } catch (error) {
      console.error(`❌ Integrated analysis error: ${error.message}`);
    }
  }

  /**
   * Run comprehensive pattern detection tests
   */
  async runAllTests() {
    console.log('🚀 Triangle Pattern Detection Comprehensive Test Suite');
    console.log('='.repeat(80));
    
    // Test different triangle types
    await this.testPattern('ascending');
    await this.testPattern('descending');
    await this.testPattern('symmetrical');
    
    // Test patterns with breakouts
    await this.testPattern('ascending', true, 'up');
    await this.testPattern('descending', true, 'down');
    await this.testPattern('symmetrical', true, 'up');
    await this.testPattern('symmetrical', true, 'down');
    
    // Test with insufficient data
    console.log(`\n🔍 Testing with INSUFFICIENT DATA`);
    console.log('━'.repeat(80));
    const shortData = this.generateTriangleData('ascending', 10); // Too few bars
    const shortResult = this.patternService.detectTriangles(shortData, 'TEST_SHORT');
    console.log(`❌ Result: ${shortResult.reason || 'No pattern detected'}`);
    
    console.log('\n✅ All Pattern Detection Tests Completed!');
  }

  /**
   * Test the full SignalCalculator with custom data
   */
  async testFullSystem() {
    console.log('\n🔧 Testing Full Signal Calculator System');
    console.log('='.repeat(80));
    
    // This would require mocking the data services, which is complex
    // Instead, let's show how the system would work with real API calls
    
    console.log('📡 The full system can be tested by:');
    console.log('1. Running: npm start (starts the web server)');
    console.log('2. Making a POST request to: http://localhost:3000/trigger-scan');
    console.log('3. Checking the logs for pattern detection results');
    console.log('4. Viewing analytics at: http://localhost:3000/analytics');
    
    console.log('\n📊 Available API endpoints for monitoring:');
    console.log('• GET  /analytics     - Full system analytics including pattern detection');
    console.log('• GET  /performance   - Performance summary with pattern analysis stats');
    console.log('• POST /trigger-scan  - Manually trigger pattern detection scan');
    console.log('• GET  /memory        - Memory analysis including pattern service usage');
  }
}

// Main execution
async function main() {
  try {
    const demo = new PatternDetectionDemo();
    
    // Check command line arguments for specific tests
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log('Triangle Pattern Detection Test Script');
      console.log('Usage: node test-pattern-detection.js [options]');
      console.log('');
      console.log('Options:');
      console.log('  --all           Run all pattern detection tests (default)');
      console.log('  --ascending     Test ascending triangle only');
      console.log('  --descending    Test descending triangle only');
      console.log('  --symmetrical   Test symmetrical triangle only');
      console.log('  --breakouts     Test patterns with breakouts');
      console.log('  --system        Show full system integration info');
      console.log('  --help, -h      Show this help message');
      return;
    }
    
    if (args.includes('--ascending')) {
      await demo.testPattern('ascending');
      await demo.testPattern('ascending', true, 'up');
    } else if (args.includes('--descending')) {
      await demo.testPattern('descending');
      await demo.testPattern('descending', true, 'down');
    } else if (args.includes('--symmetrical')) {
      await demo.testPattern('symmetrical');
      await demo.testPattern('symmetrical', true, 'up');
      await demo.testPattern('symmetrical', true, 'down');
    } else if (args.includes('--breakouts')) {
      await demo.testPattern('ascending', true, 'up');
      await demo.testPattern('descending', true, 'down');
      await demo.testPattern('symmetrical', true, 'up');
      await demo.testPattern('symmetrical', true, 'down');
    } else if (args.includes('--system')) {
      await demo.testFullSystem();
    } else {
      // Default: run all tests
      await demo.runAllTests();
    }
    
    if (args.includes('--system') || args.length === 0) {
      await demo.testFullSystem();
    }
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = PatternDetectionDemo;