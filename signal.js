const ccxt = require('ccxt');
const axios = require('axios');
const dayjs = require('dayjs');
const TelegramBot = require('node-telegram-bot-api');
const yahooFinance = require('yahoo-finance2').default;
const technicalindicators = require('technicalindicators');

const config = require('./config')
require('dotenv').config();

class SignalCalculator {
  constructor(config = {}) {
    this.binanceClient = new ccxt.binance();
    // this.yahooClient = new YahooFinance();

    this.lineToken = process.env.lineToken;
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID;
    this.telegramBot = new TelegramBot(this.telegramToken, { polling: false });

    this.symbols = config.symbols || [];
    this.stockSymbols = config.stockSymbols || [];
    this.timeframe = config.timeframe || '1d';

    this.requestDelay = 1000;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateMACD(prices) {
    return technicalindicators.MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false
    });
  }

  checkZeroCross(macdValues) {
    if (macdValues.length < 2) return 'HOLD';

    const current = macdValues[macdValues.length - 1].MACD;
    const previous = macdValues[macdValues.length - 2].MACD;

    if (previous < 0 && current > 0) return 'BUY';
    if (previous > 0 && current < 0) return 'SELL';
    return 'HOLD';
  }

  async getPrices(symbol, isStock = false) {
    try {
      if (isStock) {
        const endDate = new Date();
        const startDate = dayjs().subtract(100, 'day').toDate();

        // Use yahooFinance directly instead of this.yahooClient
        const result = await yahooFinance.historical(symbol, {
          period1: startDate,
          period2: endDate,
          interval: this.timeframe
        });

        if (!result || !result.length) {
          throw new Error(`No data found for ${symbol}`);
        }

        return result.map(quote => quote.close);
      } else {
        const ohlcv = await this.binanceClient.fetchOHLCV(symbol, this.timeframe);
        await this.sleep(this.requestDelay);
        return ohlcv.map(candle => candle[4]);
      }
    } catch (error) {
      console.error(`Failed to fetch prices for ${symbol}:`, error);
      return null;
    }
  }

  async sendTelegramMessage(message) {
    if (!this.telegramToken || !this.telegramChatId) {
      console.log('Telegram configuration missing');
      return;
    }

    try {
      await this.telegramBot.sendMessage(this.telegramChatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
  }

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

  formatSignals(signals) {
    const now = dayjs().format('DD MMM YYYY');
    let message = `\n🎯 Trading Signals - ${now}\n\n`;

    // Handle crypto signals
    if (Object.keys(signals.crypto).length > 0) {
      message += '💰 Crypto Signals:\n';
      Object.entries(signals.crypto).forEach(([symbol, data]) => {
        const emoji = data.signal === 'BUY' ? '🟢' : '🔴';
        const formattedPrice = typeof data.price === 'number' ?
          data.price.toFixed(data.price < 1 ? 6 : 2) : 'N/A';
        message += `${emoji} ${symbol}: ${data.signal} @ ${formattedPrice}\n`;
      });
      message += '\n';
    }

    // Handle stock signals
    if (Object.keys(signals.stocks).length > 0) {
      message += '📈 Stock Signals:\n';
      Object.entries(signals.stocks).forEach(([symbol, data]) => {
        const emoji = data.signal === 'BUY' ? '🟢' : '🔴';
        const formattedPrice = typeof data.price === 'number' ?
          data.price.toFixed(2) : 'N/A';
        message += `${emoji} ${symbol}: ${data.signal} @ ${formattedPrice}\n`;
      });
    }

    return message;
  }

  async checkSignals() {
    const signals = {
      crypto: {},
      stocks: {}
    };

    // Process crypto symbols
    console.log('Checking crypto signals...');
    for (const symbol of this.symbols) {
      try {
        const prices = await this.getPrices(symbol, false);
        if (!prices || prices.length < 27) {
          console.log(`Skipping ${symbol} - insufficient data`);
          continue;
        }

        const macdValues = this.calculateMACD(prices);
        const signal = this.checkZeroCross(macdValues);

        if (signal !== 'HOLD') {
          signals.crypto[symbol] = {
            signal,
            price: prices[prices.length - 1],
            macd: macdValues[macdValues.length - 1].MACD
          };
          console.log(`Signal found for ${symbol}: ${signal} @ ${prices[prices.length - 1]}`);
        }
      } catch (error) {
        console.error(`Error processing crypto ${symbol}:`, error);
      }
    }

    // Process stock symbols
    console.log('Checking stock signals...');
    for (const symbol of this.stockSymbols) {
      try {
        const prices = await this.getPrices(symbol, true);
        if (!prices || prices.length < 27) {
          console.log(`Skipping ${symbol} - insufficient data`);
          continue;
        }

        const macdValues = this.calculateMACD(prices);
        const signal = this.checkZeroCross(macdValues);

        if (signal !== 'HOLD') {
          signals.stocks[symbol] = {
            signal,
            price: prices[prices.length - 1],
            macd: macdValues[macdValues.length - 1].MACD
          };
          console.log(`Signal found for ${symbol}: ${signal} @ ${prices[prices.length - 1]}`);
        }
      } catch (error) {
        console.error(`Error processing stock ${symbol}:`, error);
      }
    }

    return signals;
  }

  async scan() {
    console.log('Starting scan...');
    const signals = await this.checkSignals();

    if (Object.keys(signals.crypto).length > 0 || Object.keys(signals.stocks).length > 0) {
      const message = this.formatSignals(signals);
      console.log('Formatted message:', message);
      await this.sendLineNotification(message);
      // await this.sendTelegramMessage(message);
    } else {
      console.log('No signals found');
    }
  }
}

module.exports = SignalCalculator;

const scanner = new SignalCalculator(config);

// Run once
scanner.scan();

// Or schedule to run daily
const schedule = require('node-schedule');
// Run at specific time (e.g., 23:55 every day)
schedule.scheduleJob('55 23 * * *', () => {
  scanner.scan();
});
