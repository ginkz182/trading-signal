const BinanceService = require("./services/binance.service");
const KuCoinService = require("./services/kucoin.service");
const YahooFinanceService = require("./services/yahoo.service");
const NotificationService = require("./services/notification.service");
const TechnicalService = require("./services/technical.service");
const { formatSignals } = require("./utils/formatters");

class SignalCalculator {
  constructor(config = {}) {
    this.binanceService = new BinanceService(config.timeframe);
    this.kucoinService = new KuCoinService(config.timeframe);
    this.yahooService = new YahooFinanceService(config.timeframe);
    this.notificationService = new NotificationService({
      lineToken: process.env.lineToken,
      telegramToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
    });
    this.technicalService = new TechnicalService();

    this.symbols = config.symbols || [];
    this.stockSymbols = config.stockSymbols || [];
  }

  async checkSignals() {
    const signals = {
      crypto: {},
      stocks: {},
    };

    // Process crypto symbols
    for (const symbol of this.symbols) {
      try {
        const prices = await this.kucoinService.getPrices(symbol);
        // console.log("PRICES = " + JSON.stringify(prices));
        if (!prices || prices.length < 27) continue;

        const macdValues = this.technicalService.calculateMACD(prices);
        const signal = this.technicalService.checkZeroCross(macdValues);

        if (signal !== "HOLD") {
          signals.crypto[symbol] = {
            signal,
            price: prices[prices.length - 1],
            macd: macdValues[macdValues.length - 1].MACD,
          };
        }
      } catch (error) {
        console.error(`Error processing crypto ${symbol}:`, error);
      }
    }

    // Process stock symbols
    for (const symbol of this.stockSymbols) {
      try {
        const prices = await this.yahooService.getPrices(symbol);
        if (!prices || prices.length < 27) continue;

        const macdValues = this.technicalService.calculateMACD(prices);
        const signal = this.technicalService.checkZeroCross(macdValues);

        if (signal !== "HOLD") {
          signals.stocks[symbol] = {
            signal,
            price: prices[prices.length - 1],
            macd: macdValues[macdValues.length - 1].MACD,
          };
        }
      } catch (error) {
        console.error(`Error processing stock ${symbol}:`, error);
      }
    }

    return signals;
  }

  async scan() {
    console.log("Starting scan...");
    const signals = await this.checkSignals();

    if (
      Object.keys(signals.crypto).length > 0 ||
      Object.keys(signals.stocks).length > 0
    ) {
      const message = formatSignals(signals);
      console.log("Formatted message:", message);
      // await this.notificationService.sendToLine(message);
      await this.notificationService.sendToTelegram(message);
    } else {
      console.log("No signals found");
    }
  }
}

module.exports = SignalCalculator;
