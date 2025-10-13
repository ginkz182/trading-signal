#!/usr/bin/env node

/**
 * Interactive Pattern Detection Demo Runner
 * 
 * This script demonstrates how to test the triangle pattern detection system
 * in various ways including:
 * 1. Unit testing individual pattern detection
 * 2. Running the full application with pattern detection
 * 3. Making API calls to test the system integration
 */

const readline = require('readline');
const { spawn, exec } = require('child_process');
const axios = require('axios').default;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class PatternDemoRunner {
  constructor() {
    this.serverProcess = null;
    this.serverUrl = 'http://localhost:3000';
  }

  async showMainMenu() {
    console.clear();
    console.log('🔺 Triangle Pattern Detection System Demo');
    console.log('═'.repeat(50));
    console.log('');
    console.log('Choose an option:');
    console.log('');
    console.log('1️⃣  Run Pattern Detection Unit Tests');
    console.log('2️⃣  Start Full Application Server');
    console.log('3️⃣  Test Live Pattern Detection API');
    console.log('4️⃣  Run Pattern Detection Demo (Synthetic Data)');
    console.log('5️⃣  View System Configuration');
    console.log('6️⃣  Run All Tests (Mocha Test Suite)');
    console.log('7️⃣  Monitor Real-time Pattern Detection');
    console.log('0️⃣  Exit');
    console.log('');
    
    const choice = await this.askQuestion('Enter your choice (0-7): ');
    return choice.trim();
  }

  async runPatternTests() {
    console.log('\n🧪 Running Pattern Detection Unit Tests');
    console.log('━'.repeat(50));
    
    try {
      // Run the pattern detection demo script
      await this.runCommand('node', ['test-pattern-detection.js', '--all']);
    } catch (error) {
      console.error('❌ Error running pattern tests:', error.message);
    }
    
    await this.pauseForUser();
  }

  async startServer() {
    console.log('\n🚀 Starting Trading Signal Application Server');
    console.log('━'.repeat(50));
    console.log('This will start the full application with pattern detection enabled.');
    console.log('Press Ctrl+C to stop the server when done.');
    console.log('');
    
    const confirm = await this.askQuestion('Start server? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      return;
    }
    
    try {
      // Start the main application
      console.log('Starting server...');
      const serverProcess = spawn('node', ['app.js'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'development' }
      });

      console.log('📡 Server should be starting...');
      console.log('🌐 Once running, you can access:');
      console.log(`   • Health Check: ${this.serverUrl}/`);
      console.log(`   • Analytics: ${this.serverUrl}/analytics`);
      console.log(`   • Performance: ${this.serverUrl}/performance`);
      console.log(`   • Manual Scan: POST ${this.serverUrl}/trigger-scan`);
      console.log('');
      console.log('Press Enter to return to menu...');
      
      await this.askQuestion('');
      serverProcess.kill('SIGTERM');
      
    } catch (error) {
      console.error('❌ Error starting server:', error.message);
      await this.pauseForUser();
    }
  }

  async testLiveAPI() {
    console.log('\n🌐 Testing Live Pattern Detection API');
    console.log('━'.repeat(50));
    console.log('This will attempt to connect to the running server and test pattern detection.');
    console.log('Make sure the server is running first (option 2).');
    console.log('');
    
    const confirm = await this.askQuestion('Test live API? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      return;
    }

    try {
      console.log('🔍 Checking server health...');
      const healthResponse = await axios.get(`${this.serverUrl}/health`, { timeout: 5000 });
      console.log('✅ Server is running:', healthResponse.data);

      console.log('\n📊 Getting current analytics...');
      const analyticsResponse = await axios.get(`${this.serverUrl}/analytics`, { timeout: 10000 });
      console.log('📈 Current System State:');
      console.log(`   • Uptime: ${Math.floor(analyticsResponse.data.uptime / 60)} minutes`);
      console.log(`   • Scan Count: ${analyticsResponse.data.scanCount}`);
      console.log(`   • Crypto Pairs: ${analyticsResponse.data.config?.cryptoPairs || 'N/A'}`);
      console.log(`   • Stock Pairs: ${analyticsResponse.data.config?.stockPairs || 'N/A'}`);
      
      if (analyticsResponse.data.dataProcessing) {
        console.log(`   • Processed Symbols: ${analyticsResponse.data.dataProcessing.processedSymbols}`);
        console.log(`   • Average Data Points: ${analyticsResponse.data.dataProcessing.averageDataPointsPerSymbol}`);
      }

      console.log('\n🎯 Triggering manual pattern detection scan...');
      const scanResponse = await axios.post(`${this.serverUrl}/trigger-scan`, {}, { timeout: 30000 });
      
      if (scanResponse.data.success) {
        console.log('✅ Scan completed successfully!');
        console.log(`   • Crypto Signals Found: ${scanResponse.data.signalCount.crypto}`);
        console.log(`   • Stock Signals Found: ${scanResponse.data.signalCount.stocks}`);
        console.log(`   • Has Signals: ${scanResponse.data.hasSignals}`);
        console.log(`   • Timestamp: ${scanResponse.data.timestamp}`);
      } else {
        console.log('❌ Scan failed:', scanResponse.data.error);
      }

      console.log('\n📈 Getting performance metrics...');
      const perfResponse = await axios.get(`${this.serverUrl}/performance`, { timeout: 5000 });
      console.log('⚡ Performance Summary:');
      console.log(`   • Status: ${perfResponse.data.status}`);
      console.log(`   • Memory Usage: ${perfResponse.data.memory.current} MB`);
      console.log(`   • Active Services: ${perfResponse.data.services.activeServices}`);
      console.log(`   • Total Requests: ${perfResponse.data.services.totalRequests}`);
      
      if (perfResponse.data.dataProcessing) {
        console.log(`   • Symbols Processed: ${perfResponse.data.dataProcessing.symbolsProcessed}`);
        console.log(`   • Data Limiting Rate: ${perfResponse.data.dataProcessing.limitingRate}`);
        console.log(`   • Data Rejection Rate: ${perfResponse.data.dataProcessing.rejectionRate}`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('❌ Cannot connect to server. Make sure to start the server first (option 2).');
      } else if (error.response) {
        console.log(`❌ API Error: ${error.response.status} - ${error.response.data?.error || error.message}`);
      } else {
        console.log('❌ Network error:', error.message);
      }
    }

    await this.pauseForUser();
  }

  async runPatternDemo() {
    console.log('\n🎨 Running Interactive Pattern Detection Demo');
    console.log('━'.repeat(50));
    
    const options = [
      'All patterns (comprehensive test)',
      'Ascending triangles only',
      'Descending triangles only', 
      'Symmetrical triangles only',
      'Breakout patterns only',
      'Custom pattern test'
    ];
    
    console.log('Choose demo type:');
    options.forEach((option, index) => {
      console.log(`${index + 1}. ${option}`);
    });
    
    const choice = await this.askQuestion('Enter choice (1-6): ');
    const choiceIndex = parseInt(choice) - 1;
    
    if (choiceIndex >= 0 && choiceIndex < options.length) {
      const args = [
        '--all',
        '--ascending',
        '--descending',
        '--symmetrical', 
        '--breakouts',
        '--help'
      ];
      
      try {
        if (choiceIndex === 5) {
          // Custom test - show help
          await this.runCommand('node', ['test-pattern-detection.js', '--help']);
        } else {
          await this.runCommand('node', ['test-pattern-detection.js', args[choiceIndex]]);
        }
      } catch (error) {
        console.error('❌ Error running demo:', error.message);
      }
    } else {
      console.log('❌ Invalid choice');
    }
    
    await this.pauseForUser();
  }

  async viewConfiguration() {
    console.log('\n⚙️  System Configuration');
    console.log('━'.repeat(50));
    
    try {
      const config = require('./src/config');
      
      console.log('📊 Trading Symbols:');
      console.log(`   • Crypto pairs: ${config.symbols.length}`);
      config.symbols.forEach((symbol, i) => {
        if (i < 5) console.log(`     - ${symbol}`);
        else if (i === 5) console.log(`     ... and ${config.symbols.length - 5} more`);
      });
      
      console.log(`   • Stock symbols: ${config.stockSymbols.length}`);
      config.stockSymbols.forEach((symbol, i) => {
        if (i < 5) console.log(`     - ${symbol}`);
        else if (i === 5) console.log(`     ... and ${config.stockSymbols.length - 5} more`);
      });
      
      console.log(`\n📈 Analysis Configuration:`);
      console.log(`   • Timeframe: ${config.timeframe}`);
      
      if (config.patterns) {
        console.log(`\n🔺 Pattern Detection Settings:`);
        console.log(`   • Enabled: ${config.patterns.enabled}`);
        console.log(`   • Minimum bars: ${config.patterns.minBars}`);
        console.log(`   • Maximum bars: ${config.patterns.maxBars}`);
        console.log(`   • Tolerance: ${config.patterns.tolerance * 100}%`);
        console.log(`   • Min touch points: ${config.patterns.minTouchPoints}`);
        console.log(`   • Volume confirmation: ${config.patterns.volumeConfirmation}`);
        console.log(`   • Breakout threshold: ${config.patterns.breakoutThreshold * 100}%`);
        console.log(`   • Volume breakout multiplier: ${config.patterns.volumeBreakoutMultiplier}x`);
      }
      
    } catch (error) {
      console.error('❌ Error reading configuration:', error.message);
    }
    
    await this.pauseForUser();
  }

  async runAllTests() {
    console.log('\n🧪 Running Complete Test Suite');
    console.log('━'.repeat(50));
    console.log('This will run all unit tests including pattern detection tests.');
    console.log('');
    
    const confirm = await this.askQuestion('Run all tests? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      return;
    }
    
    try {
      await this.runCommand('npm', ['test']);
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    }
    
    await this.pauseForUser();
  }

  async monitorRealTime() {
    console.log('\n📡 Real-time Pattern Detection Monitor');
    console.log('━'.repeat(50));
    console.log('This will show you how to monitor the pattern detection system in real-time.');
    console.log('');
    
    console.log('🔧 To monitor pattern detection in real-time:');
    console.log('');
    console.log('1. Start the server (option 2)');
    console.log('2. Open multiple terminal windows/tabs:');
    console.log('');
    console.log('📊 Terminal 1 - System logs:');
    console.log('   tail -f logs/app.log  # (if logging to file)');
    console.log('   # or watch the console output from the server');
    console.log('');
    console.log('📈 Terminal 2 - API monitoring:');
    console.log('   watch -n 10 "curl -s http://localhost:3000/analytics | jq ."');
    console.log('');
    console.log('🎯 Terminal 3 - Manual triggers:');
    console.log('   curl -X POST http://localhost:3000/trigger-scan');
    console.log('');
    console.log('📱 Terminal 4 - Performance monitoring:');
    console.log('   watch -n 5 "curl -s http://localhost:3000/performance | jq ."');
    console.log('');
    console.log('🔍 Look for these log entries indicating pattern detection:');
    console.log('   • "[PATTERN] <SYMBOL>: <TRIANGLE_TYPE> triangle detected"');
    console.log('   • "Pattern supports/conflicts with EMA signal"');
    console.log('   • "Breakout confirmed" or "Approaching resistance/support"');
    console.log('');
    console.log('📧 If Telegram is configured, pattern detection results will be sent to subscribers.');
    
    await this.pauseForUser();
  }

  async runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      console.log(`Running: ${command} ${args.join(' ')}`);
      console.log('');
      
      const process = spawn(command, args, { stdio: 'inherit' });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  async pauseForUser() {
    console.log('');
    await this.askQuestion('Press Enter to continue...');
  }

  async run() {
    try {
      while (true) {
        const choice = await this.showMainMenu();
        
        switch (choice) {
          case '1':
            await this.runPatternTests();
            break;
          case '2':
            await this.startServer();
            break;
          case '3':
            await this.testLiveAPI();
            break;
          case '4':
            await this.runPatternDemo();
            break;
          case '5':
            await this.viewConfiguration();
            break;
          case '6':
            await this.runAllTests();
            break;
          case '7':
            await this.monitorRealTime();
            break;
          case '0':
            console.log('\n👋 Goodbye!');
            process.exit(0);
            break;
          default:
            console.log('❌ Invalid choice. Please try again.');
            await this.pauseForUser();
        }
      }
    } catch (error) {
      console.error('❌ Demo runner error:', error);
      process.exit(1);
    } finally {
      rl.close();
    }
  }
}

// Check for command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Triangle Pattern Detection Demo Runner');
  console.log('Usage: node run-pattern-demo.js [--help]');
  console.log('');
  console.log('This interactive script helps you test and demonstrate');
  console.log('the triangle pattern detection system in various ways.');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h    Show this help message');
  console.log('');
  console.log('Run without arguments to start the interactive menu.');
  process.exit(0);
}

// Start the interactive demo
const demo = new PatternDemoRunner();
demo.run().catch(console.error);