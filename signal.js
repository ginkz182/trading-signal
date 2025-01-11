const ccxt = require('ccxt');
const axios = require('axios');
const dayjs = require('dayjs');
const config = require('./config')
const technicalindicators = require('technicalindicators');

require('dotenv').config();

class SignalCalculator {
  constructor(config = {}) {
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_SECRET_KEY,
    });
    this.lineToken = process.env.lineToken;
    this.symbols = config.symbols || [];
    this.timeframe = config.timeframe || '1d';
  }

  // Calculate MACD for a series of prices
  calculateMACD(prices) {
    const macd = technicalindicators.MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });

    return macd;
  }

  // Check if MACD crossed zero
  checkZeroCross(macdValues) {
    if (macdValues.length < 2) return 'HOLD';

    const current = macdValues[macdValues.length - 1].MACD;
    const previous = macdValues[macdValues.length - 2].MACD;

    if (previous < 0 && current > 0) return 'BUY';
    if (previous > 0 && current < 0) return 'SELL';
    return 'HOLD';
  }

  // Get historical prices for a symbol
  async getPrices(symbol) {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, this.timeframe);
      return ohlcv.map(candle => candle[4]); // Close prices
    } catch (error) {
      console.error(`Error fetching prices for ${symbol}:`, error);
      return null;
    }
  }

  // Send LINE notification
  async sendLineNotification(message) {
    if (!this.lineToken) {
      console.log('LINE token not configured');
      return;
    }

    try {
      await axios.post(
        'https://notify-api.line.me/api/notify',
        { message },
        {
          headers: {
            'Authorization': `Bearer ${this.lineToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (error) {
      console.error('Error sending LINE notification:', error);
    }
  }

  // Format signals into a message
  formatSignals(signals) {
    const now = dayjs().format('DD MMM YYYY');
    let message = `\n🚨 ${now}\n\n`;

    Object.entries(signals).forEach(([symbol, data]) => {
      const emoji = data.signal === 'BUY' ? '🟢' : '🔴';
      message += `${emoji} ${symbol}: ${data.signal} @ ${data.price}\n`;
      // message += `   MACD: ${data.macd.toFixed(6)}\n`;
    });

    return message;
  }

  // Check signals for all symbols
  async checkSignals() {
    const signals = {};

    for (const symbol of this.symbols) {
      try {
        const prices = await this.getPrices(symbol);
        if (!prices || prices.length < 27) continue;

        const macdValues = this.calculateMACD(prices);
        const signal = this.checkZeroCross(macdValues);

        if (signal !== 'HOLD') {
          signals[symbol] = {
            signal,
            price: prices[prices.length - 1],
            macd: macdValues[macdValues.length - 1].MACD
          };
        }
      } catch (error) {
        console.error(`Error processing ${symbol}:`, error);
      }
    }

    return signals;
  }

  // Run the scanner
  async scan() {
    console.log('Starting scan...');
    const signals = await this.checkSignals();

    if (Object.keys(signals).length > 0) {
      const message = this.formatSignals(signals);
      console.log(message);
      await this.sendLineNotification(message);
    } else {
      console.log('No signals found');
    }
  }
}

const scanner = new SignalCalculator(config);

// Run once
scanner.scan();

// // Or schedule to run daily
// const schedule = require('node-schedule');
// // Run at specific time (e.g., 23:55 every day)
// schedule.scheduleJob('55 23 * * *', () => {
//   scanner.scan();
// });

module.exports = SignalCalculator;
