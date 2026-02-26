/**
 * Verify Backtest Script
 * Usage: node scripts/verify-backtest.js
 * 
 * Runs a backtest using live Binance data without needing the Telegram bot or database.
 */
const BinanceService = require('../src/services/binance.service');
const BacktestService = require('../src/services/backtest.service');

const SYMBOL = process.argv[2] || 'BTC/USDT';
const DAYS = parseInt(process.argv[3]) || 180;

async function main() {
  console.log(`\n🔬 Backtest Verification Script`);
  console.log(`   Symbol: ${SYMBOL}`);
  console.log(`   Days: ${DAYS}`);
  console.log(`   Strategy: CDC Action Zone (EMA 12/26)\n`);

  const binance = new BinanceService('1d');
  const backtester = new BacktestService();

  console.log('📡 Fetching historical data from Binance...');
  const candles = await binance.getHistoricalPrices(SYMBOL, DAYS + 100);

  if (!candles || candles.length === 0) {
    console.error('❌ Failed to fetch data. Check symbol and network.');
    process.exit(1);
  }

  console.log(`✅ Received ${candles.length} candles`);
  console.log(`   From: ${new Date(candles[0].time).toLocaleDateString()}`);
  console.log(`   To:   ${new Date(candles[candles.length - 1].time).toLocaleDateString()}\n`);

  console.log('⚙️  Running backtest...\n');
  const result = backtester.run(candles, DAYS);
  result.symbol = SYMBOL;

  // Print report
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 BACKTEST REPORT: ${result.symbol}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Period: ${result.period.from.toLocaleDateString()} → ${result.period.to.toLocaleDateString()} (${result.days}d)`);
  console.log(`💰 Start:  $${result.initialCapital.toLocaleString()}`);
  console.log(`💵 End:    $${result.finalValue.toLocaleString()} ${result.stillInPosition ? '(Still In Position)' : '(Closed)'}`);
  console.log(`📈 PnL:    ${result.totalPnl >= 0 ? '+' : ''}${result.totalPnl}%`);
  if (result.stillInPosition && result.unrealizedPnl !== null) {
    console.log(`   └ Unrealized: ${result.unrealizedPnl >= 0 ? '+' : ''}${result.unrealizedPnl}%`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔄 Total Trades:  ${result.totalTrades} (${result.completedTrades} completed)`);
  console.log(`✅ Wins:          ${result.wins}`);
  console.log(`❌ Losses:        ${result.losses}`);
  console.log(`🎯 Win Rate:      ${result.winRate}%`);
  console.log(`📉 Max Drawdown:  ${result.maxDrawdown}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (result.trades.length > 0) {
    console.log('📋 Trade Log:');
    result.trades.forEach((t, i) => {
      const date = t.time.toLocaleDateString();
      const pnl = t.pnl ? ` (${t.pnl >= 0 ? '+' : ''}${t.pnl}%)` : '';
      console.log(`   ${i + 1}. ${t.type} @ $${t.price.toFixed(2)} on ${date}${pnl} | Capital: $${t.capital}`);
    });
  }

  console.log('\n✅ Verification complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
