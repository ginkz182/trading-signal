/**
 * Verify ONDO BUY signal detection for Apr 25 crossover.
 * Simulates what the bot would have seen at 00:05 UTC on Apr 26
 * when the new-day candle may not yet exist.
 *
 * Usage: node scripts/verify-ondo-signal.js
 */
const ccxt = require('ccxt');
const TechnicalService = require('../src/services/technical.service');

const SYMBOL = 'ONDO/USDT';
const TARGET_DATE = '2026-04-25'; // The crossover candle

async function main() {
  console.log(`\nVerifying ONDO BUY signal for ${TARGET_DATE} crossover\n`);

  const client = new ccxt.kucoin({ enableRateLimit: true, timeout: 30000 });
  await client.loadMarkets();

  console.log('Fetching ONDO/USDT 1d candles from KuCoin...');
  const ohlcv = await client.fetchOHLCV(SYMBOL, '1d', undefined, 300);
  console.log(`Received ${ohlcv.length} candles`);

  const lastCandle = ohlcv[ohlcv.length - 1];
  const lastDate = new Date(lastCandle[0]).toISOString().slice(0, 10);
  console.log(`Last candle date: ${lastDate}  close: ${lastCandle[4]}\n`);

  // --- Scenario A: OLD behaviour (always strip last candle) ---
  const pricesOld = ohlcv.map(c => c[4]);
  pricesOld.pop(); // always strip
  const lastOld = new Date(ohlcv[ohlcv.length - 2][0]).toISOString().slice(0, 10);

  // --- Scenario B: NEW behaviour (strip only if last candle is today) ---
  const now = new Date();
  const isTodayCandle =
    new Date(lastCandle[0]).getUTCFullYear() === now.getUTCFullYear() &&
    new Date(lastCandle[0]).getUTCMonth() === now.getUTCMonth() &&
    new Date(lastCandle[0]).getUTCDate() === now.getUTCDate();

  const ohlcvNew = [...ohlcv];
  if (isTodayCandle) {
    ohlcvNew.pop();
    console.log(`NEW: Today's candle (${lastDate}) stripped`);
  } else {
    console.log(`NEW: Last candle (${lastDate}) is complete, keeping it`);
  }
  const pricesNew = ohlcvNew.map(c => c[4]);
  const lastNew = new Date(ohlcvNew[ohlcvNew.length - 1][0]).toISOString().slice(0, 10);

  // Run signal detection
  const technical = new TechnicalService({ fastPeriod: 12, slowPeriod: 26 });

  const signalOld = technical.calculateEmaCrossoverSignal(pricesOld);
  const signalNew = technical.calculateEmaCrossoverSignal(pricesNew);

  console.log('--- OLD behaviour (always strip last) ---');
  console.log(`  Last candle used: ${lastOld}`);
  console.log(`  Signal: ${signalOld.signal}  fastEMA: ${signalOld.fastEMA?.toFixed(6)}  slowEMA: ${signalOld.slowEMA?.toFixed(6)}`);

  console.log('\n--- NEW behaviour (strip only if today) ---');
  console.log(`  Last candle used: ${lastNew}`);
  console.log(`  Signal: ${signalNew.signal}  fastEMA: ${signalNew.fastEMA?.toFixed(6)}  slowEMA: ${signalNew.slowEMA?.toFixed(6)}`);

  // Find the Apr 25 candle and show EMA values around it
  console.log(`\n--- EMA values around ${TARGET_DATE} ---`);
  const closes = ohlcv.map(c => c[4]);
  const fastAll = technical.calculateEMA(closes, 12);
  const slowAll = technical.calculateEMA(closes, 26);
  // EMA arrays start from index (period-1) of closes
  for (let i = ohlcv.length - 5; i < ohlcv.length; i++) {
    const date = new Date(ohlcv[i][0]).toISOString().slice(0, 10);
    const fi = i - (12 - 1); // fast EMA index offset
    const si = i - (26 - 1); // slow EMA index offset
    const fast = fi >= 0 ? fastAll[fi]?.toFixed(6) : 'n/a';
    const slow = si >= 0 ? slowAll[si]?.toFixed(6) : 'n/a';
    const cross = fi > 0 && si > 0
      ? (fastAll[fi - 1] < slowAll[si - 1] && fastAll[fi] > slowAll[si] ? ' <-- BUY crossover'
        : fastAll[fi - 1] > slowAll[si - 1] && fastAll[fi] < slowAll[si] ? ' <-- SELL crossover'
        : '')
      : '';
    console.log(`  ${date}  close: ${ohlcv[i][4].toFixed(6)}  EMA12: ${fast}  EMA26: ${slow}${cross}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
