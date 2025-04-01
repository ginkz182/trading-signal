const { expect } = require("chai");
const sinon = require("sinon");
const SignalCalculator = require("../src/SignalCalculator");

describe("SignalCalculator", () => {
  let calculator;
  let mockBinanceService;
  let mockKuCoinService;
  let mockYahooService;
  let mockNotificationService;
  let mockTechnicalService;

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
    mockBinanceService = {
      getPrices: sinon.stub().resolves(buySignalPrices),
    };

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

    // Create mock MACD values that would correspond to the price data
    mockTechnicalService = {
      calculateMACD: sinon.stub().returns([
        { MACD: -0.5, signal: -0.3, histogram: -0.2 },
        { MACD: 0.5, signal: 0.3, histogram: 0.2 },
      ]),
      checkZeroCross: sinon.stub(),
    };

    // Initialize calculator with test configuration
    calculator = new SignalCalculator({
      symbols: ["BTC/USDT", "ETH/USDT"],
      stockSymbols: ["AAPL", "GOOGL"],
      timeframe: "1d",
    });

    // Replace real services with mocks
    calculator.binanceService = mockBinanceService;
    calculator.kucoinService = mockKuCoinService;
    calculator.yahooService = mockYahooService;
    calculator.notificationService = mockNotificationService;
    calculator.technicalService = mockTechnicalService;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("checkSignals()", () => {
    it("should process crypto signals correctly for BUY signal", async () => {
      mockTechnicalService.checkZeroCross.returns("BUY");

      const signals = await calculator.checkSignals();

      expect(mockKuCoinService.getPrices.calledWith("BTC/USDT")).to.be.true;
      expect(mockKuCoinService.getPrices.calledWith("ETH/USDT")).to.be.true;
      expect(signals.crypto["BTC/USDT"].signal).to.equal("BUY");
      expect(signals.crypto["BTC/USDT"].price).to.equal(
        buySignalPrices[buySignalPrices.length - 1]
      );
    });

    it("should process stock signals correctly for SELL signal", async () => {
      mockTechnicalService.checkZeroCross.returns("SELL");

      const signals = await calculator.checkSignals();

      expect(mockYahooService.getPrices.calledWith("AAPL")).to.be.true;
      expect(mockYahooService.getPrices.calledWith("GOOGL")).to.be.true;
      expect(signals.stocks["AAPL"].signal).to.equal("SELL");
      expect(signals.stocks["AAPL"].price).to.equal(
        sellSignalPrices[sellSignalPrices.length - 1]
      );
    });

    it("should skip HOLD signals", async () => {
      mockTechnicalService.checkZeroCross.returns("HOLD");

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
      mockTechnicalService.checkZeroCross.returns("BUY");

      await calculator.scan();

      // expect(mockNotificationService.sendToLine.calledOnce).to.be.true;
      expect(mockNotificationService.sendToTelegram.calledOnce).to.be.true;

      // Verify notification content
      const telegramMessage =
        mockNotificationService.sendToTelegram.firstCall.args[0];
      expect(telegramMessage).to.include("BUY");
    });

    it("should not send notifications when no signals are found", async () => {
      mockTechnicalService.checkZeroCross.returns("HOLD");

      await calculator.scan();

      expect(mockNotificationService.sendToLine.called).to.be.false;
      expect(mockNotificationService.sendToTelegram.called).to.be.false;
    });

    it("should handle notification service errors", async () => {
      mockTechnicalService.checkZeroCross.returns("BUY");
      mockNotificationService.sendToTelegram.rejects(
        new Error("Notification Error")
      );

      try {
        await calculator.scan();
      } catch (error) {
        expect(error.message).to.equal("Notification Error");
      }
    });

    it("should process multiple symbols and combine signals", async () => {
      // Set up different signals for different symbols
      mockTechnicalService.checkZeroCross
        .onFirstCall()
        .returns("BUY") // BTC-USDT
        .onSecondCall()
        .returns("SELL") // ETH-USDT
        .onThirdCall()
        .returns("HOLD") // AAPL
        .onCall(3)
        .returns("BUY"); //GOOGL

      const signals = await calculator.checkSignals();

      console.log(JSON.stringify(signals));

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
