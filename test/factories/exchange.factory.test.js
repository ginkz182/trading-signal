const { expect } = require("chai");
const sinon = require("sinon");
const ExchangeFactory = require("../../src/factories/exchange.factory");
const BinanceService = require("../../src/services/binance.service");
const KuCoinService = require("../../src/services/kucoin.service");
const YahooFinanceService = require("../../src/services/yahoo.service");

describe("ExchangeFactory", () => {
  let exchangeFactory;

  beforeEach(() => {
    exchangeFactory = new ExchangeFactory();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("createExchange()", () => {
    it("should create a Binance service instance", () => {
      const timeframe = "1d";
      const exchange = exchangeFactory.createExchange("binance", timeframe);

      expect(exchange).to.be.instanceOf(BinanceService);
      expect(exchange.timeframe).to.equal(timeframe);
    });

    it("should create a KuCoin service instance", () => {
      const timeframe = "4h";
      const exchange = exchangeFactory.createExchange("kucoin", timeframe);

      expect(exchange).to.be.instanceOf(KuCoinService);
      expect(exchange.timeframe).to.equal(timeframe);
    });

    it("should create a Yahoo Finance service instance", () => {
      const timeframe = "1w";
      const exchange = exchangeFactory.createExchange("yahoo", timeframe);

      expect(exchange).to.be.instanceOf(YahooFinanceService);
      expect(exchange.timeframe).to.equal(timeframe);
    });

    it("should handle case-insensitive exchange types", () => {
      const binanceExchange = exchangeFactory.createExchange("BINANCE", "1d");
      const kucoinExchange = exchangeFactory.createExchange("KuCoin", "1d");
      const yahooExchange = exchangeFactory.createExchange("Yahoo", "1d");

      expect(binanceExchange).to.be.instanceOf(BinanceService);
      expect(kucoinExchange).to.be.instanceOf(KuCoinService);
      expect(yahooExchange).to.be.instanceOf(YahooFinanceService);
    });

    it("should throw error for unsupported exchange type", () => {
      const unsupportedType = "unsupported";

      expect(() => {
        exchangeFactory.createExchange(unsupportedType, "1d");
      }).to.throw(`Unsupported exchange type: ${unsupportedType}`);
    });
  });
});
