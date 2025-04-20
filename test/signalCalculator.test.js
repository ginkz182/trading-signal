const { expect } = require("chai");
const sinon = require("sinon");
const SignalCalculator = require("../src/SignalCalculator");
const ExchangeFactory = require("../src/factories/exchange.factory");
const IndicatorManager = require("../src/managers/indicator.manager");

describe("SignalCalculator", () => {
  let calculator;
  let mockKuCoinService;
  let mockYahooService;
  let mockNotificationService;
  let mockIndicatorManager;
  let mockExchangeFactory;

  // Sample price data that would generate specific MACD signals
  const buySignalPrices = [
    100, 102, 104, 104, 105, 107, 108, 109, 110, 112, 115, 118, 120, 123, 125,
    128, 130, 132, 135, 137, 136, 135, 133, 131, 128, 125, 122, 119, 115, 112,
  ];

  const sellSignalPrices = [
    140, 138, 136, 134, 132, 130, 128, 126, 124, 122, 120, 118, 116, 114, 112,
    110, 108, 106, 104, 102, 100, 98, 96, 94, 92, 90, 88, 86, 84, 82,
  ];

  beforeEach(() => {
    // Initialize mock services
    mockKuCoinService = {
      getPrices: sinon.stub().resolves(buySignalPrices),
    };

    mockYahooService = {
      getPrices: sinon.stub().resolves(sellSignalPrices),
    };

    mockNotificationService = {
      sendToLine: sinon.stub().resolves(),
      sendToTelegram: sinon.stub().resolves(),
    };

    // Set default value for analyzePrice to avoid undefined errors during tests
    mockIndicatorManager = {
      analyzePrice: sinon.stub().returns({ signal: "HOLD", macd: 0 }),
    };

    // Mock exchange factory
    mockExchangeFactory = sinon.createStubInstance(ExchangeFactory);
    mockExchangeFactory.createExchange
      .withArgs("kucoin", "1d")
      .returns(mockKuCoinService);
    mockExchangeFactory.createExchange
      .withArgs("yahoo", "1d")
      .returns(mockYahooService);

    // Initialize calculator with test configuration
    calculator = new SignalCalculator({
      symbols: ["BTC/USDT", "ETH/USDT"],
      stockSymbols: ["AAPL", "GOOGL"],
      timeframe: "1d",
    });

    // Replace real services with mocks
    calculator.exchangeServices = {
      crypto: mockKuCoinService,
      stocks: mockYahooService,
    };
    calculator.notificationService = mockNotificationService;
    calculator.indicatorManager = mockIndicatorManager;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("checkSignals()", () => {
    it("should process crypto signals correctly for BUY signal", async () => {
      // Setup indicator manager mock to return BUY signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "BUY",
        macd: 0.5,
      });

      const signals = await calculator.checkSignals();

      expect(mockKuCoinService.getPrices.calledWith("BTC/USDT")).to.be.true;
      expect(mockKuCoinService.getPrices.calledWith("ETH/USDT")).to.be.true;
      expect(signals.crypto["BTC/USDT"].signal).to.equal("BUY");
      expect(signals.crypto["BTC/USDT"].price).to.equal(
        buySignalPrices[buySignalPrices.length - 1]
      );
    });

    it("should use previous day data when option is enabled", async () => {
      // Setup indicator manager mock to return BUY signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "BUY",
        macd: 0.5,
      });

      const signals = await calculator.checkSignals({ usePreviousDay: true });

      // Verify that analyzePrice was called with previous day data (one less item)
      const analysisCall = mockIndicatorManager.analyzePrice.firstCall;
      expect(analysisCall.args[0].length).to.be.lessThan(
        buySignalPrices.length
      );

      // Verify signal still includes current price
      expect(signals.crypto["BTC/USDT"].price).to.equal(
        buySignalPrices[buySignalPrices.length - 1]
      );

      // Verify previous day price is included
      expect(signals.crypto["BTC/USDT"].previousDayPrice).to.equal(
        buySignalPrices[buySignalPrices.length - 2]
      );

      // Verify flag is set correctly
      expect(signals.crypto["BTC/USDT"].usingPreviousDayData).to.be.true;
    });

    it("should process stock signals correctly for SELL signal", async () => {
      // Setup indicator manager mock to return SELL signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "SELL",
        macd: -0.5,
      });

      const signals = await calculator.checkSignals();

      expect(mockYahooService.getPrices.calledWith("AAPL")).to.be.true;
      expect(mockYahooService.getPrices.calledWith("GOOGL")).to.be.true;
      expect(signals.stocks["AAPL"].signal).to.equal("SELL");
      expect(signals.stocks["AAPL"].price).to.equal(
        sellSignalPrices[sellSignalPrices.length - 1]
      );
    });

    it("should skip HOLD signals", async () => {
      // Setup indicator manager mock to return HOLD signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "HOLD",
        macd: 0.1,
      });

      const signals = await calculator.checkSignals();

      expect(signals.crypto).to.be.empty;
      expect(signals.stocks).to.be.empty;
    });

    it("should handle insufficient price data", async () => {
      mockKuCoinService.getPrices.resolves([100, 101]); // Less than required data

      const signals = await calculator.checkSignals();

      expect(signals.crypto).to.be.empty;
    });

    it("should handle API errors gracefully", async () => {
      mockKuCoinService.getPrices.rejects(new Error("API Error"));

      const signals = await calculator.checkSignals();

      expect(signals.crypto).to.be.empty;
    });
  });

  describe("scan()", () => {
    it("should send notifications when signals are found", async () => {
      // Setup indicator manager mock to return BUY signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "BUY",
        macd: 0.5,
      });

      await calculator.scan();

      expect(mockNotificationService.sendToTelegram.calledOnce).to.be.true;

      // Verify notification content
      const telegramMessage =
        mockNotificationService.sendToTelegram.firstCall.args[0];
      expect(telegramMessage).to.include("BUY");
    });

    it("should not send notifications when no signals are found", async () => {
      // Setup indicator manager mock to return HOLD signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "HOLD",
        macd: 0.1,
      });

      await calculator.scan();

      expect(mockNotificationService.sendToLine.called).to.be.false;
      expect(mockNotificationService.sendToTelegram.called).to.be.false;
    });

    it("should handle notification service errors", async () => {
      // Setup indicator manager mock to return BUY signals
      mockIndicatorManager.analyzePrice.returns({
        signal: "BUY",
        macd: 0.5,
      });

      mockNotificationService.sendToTelegram.rejects(
        new Error("Notification Error")
      );

      try {
        await calculator.scan();
        // If we get here, the test should fail
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.equal("Notification Error");
      }
    });

    it("should process multiple symbols and combine signals", async () => {
      // Set up different signals for different symbols
      mockIndicatorManager.analyzePrice
        .onFirstCall()
        .returns({ signal: "BUY", macd: 0.5 }) // BTC-USDT
        .onSecondCall()
        .returns({ signal: "SELL", macd: -0.5 }) // ETH-USDT
        .onThirdCall()
        .returns({ signal: "HOLD", macd: 0.1 }) // AAPL
        .onCall(3)
        .returns({ signal: "BUY", macd: 0.6 }); // GOOGL

      const signals = await calculator.checkSignals();

      // Check crypto signals
      expect(signals.crypto).to.have.property("BTC/USDT");
      expect(signals.crypto["BTC/USDT"].signal).to.equal("BUY");
      expect(signals.crypto).to.have.property("ETH/USDT");
      expect(signals.crypto["ETH/USDT"].signal).to.equal("SELL");

      // Check stock signals
      // AAPL should not be in results because it's HOLD
      expect(signals.stocks).to.not.have.property("AAPL");
      expect(signals.stocks).to.have.property("GOOGL");
      expect(signals.stocks["GOOGL"].signal).to.equal("BUY");
      expect(
        Object.keys(signals.crypto).length + Object.keys(signals.stocks).length
      ).to.be.greaterThan(0);
    });
  });
});
