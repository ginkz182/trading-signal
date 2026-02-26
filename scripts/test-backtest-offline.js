// Quick offline test - run: node scripts/test-backtest-offline.js
const TechnicalService = require('../src/services/technical.service');
const BacktestService = require('../src/services/backtest.service');

// Test 1: TechnicalService EMA calculation  
const tech = new TechnicalService();
const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const ema12 = tech.calculateEMA(prices, 12);
const ema26 = tech.calculateEMA(prices, 26);
console.log('EMA12 length:', ema12.length, '(expected 19)');
console.log('EMA26 length:', ema26.length, '(expected 5)');
console.log('Test 1 (EMA):', ema12.length === 19 && ema26.length === 5 ? '✅ PASS' : '❌ FAIL');

// Test 2: BacktestService with deterministic synthetic data (guaranteed crossovers)
const bt = new BacktestService();
const candles = [];
for (let i = 0; i < 200; i++) {
  let price;
  if (i < 50) price = 100;                       // flat baseline
  else if (i < 80) price = 100 + (i - 50) * 5;   // strong uptrend (crossover -> BUY)
  else if (i < 130) price = 250;                  // flat at top
  else if (i < 160) price = 250 - (i - 130) * 5;  // strong downtrend (crossover -> SELL)
  else price = 100;                               // flat at bottom

  candles.push({
    time: Date.now() - (200 - i) * 86400000,
    open: price, high: price, low: price,
    close: price, volume: 1000
  });
}

const result = bt.run(candles, 150);
result.symbol = 'TEST/USDT';

const checks = [
  ['Has trades', result.totalTrades > 0],
  ['Has initialCapital', result.initialCapital === 10000],
  ['Has finalValue', typeof result.finalValue === 'number'],
  ['Has winRate', typeof result.winRate === 'number'],
  ['Has maxDrawdown', typeof result.maxDrawdown === 'number'],
  ['Has period', result.period.from instanceof Date && result.period.to instanceof Date],
  ['Has days', result.days === 150],
];

let allPass = true;
checks.forEach(([name, pass]) => {
  console.log(`Test 2 (${name}): ${pass ? '✅ PASS' : '❌ FAIL'}`);
  if (!pass) allPass = false;
});

console.log('\nResult summary:');
console.log('  Trades:', result.totalTrades);
console.log('  PnL:', result.totalPnl + '%');
console.log('  Win Rate:', result.winRate + '%');
console.log('  Max DD:', result.maxDrawdown + '%');

console.log('\n' + (allPass ? '✅ All tests passed!' : '❌ Some tests failed'));
process.exit(allPass ? 0 : 1);
