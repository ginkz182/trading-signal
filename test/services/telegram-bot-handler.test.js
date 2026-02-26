// test/services/telegram-bot-handler.test.js
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

describe("TelegramBotHandler", () => {
  let botHandler;
  let telegramBotStub;
  let subscriberServiceStub;
  let monitorServiceStub;
  let TelegramBotHandler;

  beforeEach(() => {
    // Create a mock bot instance with all required methods
    telegramBotStub = {
      onText: sinon.stub(),
      sendMessage: sinon.stub().resolves(),
      on: sinon.stub(),
    };

    // Mock TelegramBot constructor
    const TelegramBotMock = sinon.stub().returns(telegramBotStub);

    // Create SubscriberService stub
    subscriberServiceStub = {
      subscribe: sinon.stub().resolves(),
      unsubscribe: sinon.stub().resolves(),
      getSubscriber: sinon.stub().resolves(),
      initialize: sinon.stub().resolves(),
      getActiveAssets: sinon.stub().resolves(['BTC/USDT', 'ETH/USDT', 'NVDA', 'TSLA']),
      getActiveAssetsWithTypes: sinon.stub().resolves(),
      subscribeAsset: sinon.stub().resolves(),
      unsubscribeAsset: sinon.stub().resolves(),
      requestAsset: sinon.stub().resolves(),
      updateSubscription: sinon.stub().resolves({ newTier: 'resident', expiresAt: new Date() }),
    };
    
    monitorServiceStub = {
      notifyNewUser: sinon.stub().resolves(),
    };

    // Use proxyquire to inject our mocks
    TelegramBotHandler = proxyquire("../../src/services/telegram-bot-handler", {
      "node-telegram-bot-api": TelegramBotMock,
      "./subscriber.service": sinon.stub().returns(subscriberServiceStub),
      "../config": {
        symbols: ["BTC/USDT", "ETH/USDT"],
        stockSymbols: ["NVDA", "TSLA"],
      },
    });

    // Stub console methods to prevent test output pollution
    sinon.stub(console, "error");
    sinon.stub(console, "log");

    botHandler = new TelegramBotHandler({
      token: "mock-telegram-token",
      subscriberService: subscriberServiceStub,
      monitorService: monitorServiceStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize bot, subscriber service and monitor service", () => {
      expect(botHandler.bot).to.exist;
      expect(botHandler.subscriberService).to.exist;
      expect(botHandler.monitorService).to.exist;
    });

    it("should set up command handlers", () => {
      // Should have set up multiple command handlers
      expect(telegramBotStub.onText.callCount).to.be.at.least(4);

      // Check for specific command patterns
      const calls = telegramBotStub.onText.getCalls();
      const patterns = calls.map((call) => call.args[0].toString());

      expect(patterns.some((p) => p.includes("start"))).to.be.true;
      expect(patterns.some((p) => p.includes("stop"))).to.be.true;
      expect(patterns.some((p) => p.includes("status"))).to.be.true;
      expect(patterns.some((p) => p.includes("help"))).to.be.true;
    });

    it("should set up error handlers", () => {
      expect(telegramBotStub.on.calledWith("polling_error")).to.be.true;
    });
  });

  describe("start command", () => {
    it("should subscribe user on /start command and notify admin", async () => {
      // Find the start command handler
      const startCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("start"));
      const startHandler = startCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
        from: {
          username: "testuser",
          first_name: "Test",
          last_name: "User",
        },
      };

      subscriberServiceStub.subscribe.resolves({
        chatId: "123456",
        subscribed: true,
      });

      await startHandler(mockMsg);

      expect(subscriberServiceStub.subscribe.calledOnce).to.be.true;
      expect(subscriberServiceStub.subscribe.calledWith("123456", mockMsg.from))
        .to.be.true;
      expect(monitorServiceStub.notifyNewUser.calledOnce).to.be.true;
      expect(monitorServiceStub.notifyNewUser.calledWith(mockMsg.from)).to.be.true;
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;

      // Check welcome message content
      const [chatId, message, options] =
        telegramBotStub.sendMessage.firstCall.args;
      expect(chatId.toString()).to.equal("123456");
      expect(message).to.include("Welcome to Purrrfect Signal");
      expect(options.parse_mode).to.equal("HTML");
    });

    it("should handle subscription errors", async () => {
      // Find the start command handler
      const startCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("start"));
      const startHandler = startCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
        from: { username: "testuser" },
      };

      subscriberServiceStub.subscribe.rejects(new Error("Database error"));

      await startHandler(mockMsg);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      expect(message).to.include("Sorry, there was an error");
    });
  });

  describe("stop command", () => {
    it("should unsubscribe user on /stop command", async () => {
      // Find the stop command handler
      const stopCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("stop"));
      const stopHandler = stopCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      subscriberServiceStub.unsubscribe.resolves({
        chatId: "123456",
        subscribed: false,
      });

      await stopHandler(mockMsg);

      expect(subscriberServiceStub.unsubscribe.calledOnce).to.be.true;
      expect(subscriberServiceStub.unsubscribe.calledWith("123456")).to.be.true;
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;

      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      expect(message).to.include("turned off");
    });

    it("should handle unsubscription errors", async () => {
      // Find the stop command handler
      const stopCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("stop"));
      const stopHandler = stopCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      subscriberServiceStub.unsubscribe.rejects(new Error("Database error"));

      await stopHandler(mockMsg);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      expect(message).to.include("error");
    });
  });

  describe("status command", () => {
    it("should show subscription status for subscribed user", async () => {
      // Find the status command handler
      const statusCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("status"));
      const statusHandler = statusCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      subscriberServiceStub.getSubscriber.resolves({
        chat_id: "123456",
        subscribed: true,
        subscribedAt: new Date().toISOString(),
      });

      await statusHandler(mockMsg);

      expect(subscriberServiceStub.getSubscriber.calledWith("123456")).to.be
        .true;
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;

      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      expect(message).to.include("Subscription Status: Active");
    });

    it("should show not subscribed message for unsubscribed user", async () => {
      // Find the status command handler
      const statusCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("status"));
      const statusHandler = statusCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      subscriberServiceStub.getSubscriber.resolves(null);

      await statusHandler(mockMsg);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      expect(message).to.include("Notifications are turned off");
    });

    it("should handle status check errors", async () => {
      // Find the status command handler
      const statusCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("status"));
      const statusHandler = statusCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      subscriberServiceStub.getSubscriber.rejects(new Error("Database error"));

      await statusHandler(mockMsg);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      expect(message).to.include("error");
    });
  });

  describe("help command", () => {
    it("should send help message", async () => {
      // Find the help command handler
      const helpCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("help"));
      const helpHandler = helpCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      await helpHandler(mockMsg);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [chatId, message, options] =
        telegramBotStub.sendMessage.firstCall.args;
      expect(chatId).to.equal(123456);
      expect(message).to.include("Purrrfect Signal Bot Commands");
      expect(options.parse_mode).to.equal("HTML");
    });
  });

  describe("assetlist command", () => {
    it("should send the list of crypto and stock assets", async () => {
      // Find the assetlist command handler from the stub
      const assetlistCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("assetlist"));
      const assetlistHandler = assetlistCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      // Execute the handler
      subscriberServiceStub.getSubscriber.resolves({ tier: 'free', chat_id: '123456', subscribed: true });
      subscriberServiceStub.getActiveAssetsWithTypes.resolves({ crypto: ["BTC/USDT", "ETH/USDT"], stocks: ["NVDA", "TSLA"], isCustom: true });
      await assetlistHandler(mockMsg);

      // Assertions
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [chatId, message, options] =
        telegramBotStub.sendMessage.firstCall.args;

      expect(chatId).to.equal("123456");
      if (options) {
        expect(options.parse_mode).to.equal("HTML");
      }
      expect(message).to.include("Your Monitored Assets");
      // Simplified list validation
      expect(message).to.include("BTC/USDT");
      expect(message).to.include("ETH/USDT");
      expect(message).to.include("NVDA");
      expect(message).to.include("TSLA");
    });
  });

  describe("plans command", () => {
    it("should display plan menu if user has tier 'free' but is_auto_renewal is true", async () => {
      // Find the plans command handler from the stub
      const plansCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("plans"));
      const plansHandler = plansCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      // Mock free user with lingering is_auto_renewal=true (bug before fix)
      subscriberServiceStub.getSubscriber.resolves({ 
        chat_id: '123456', 
        tier: 'free', 
        is_auto_renewal: true, 
        subscribed: true 
      });
      
      await plansHandler(mockMsg, []);

      // Ensure that we do not mistakenly block and tell them they have auto-renewal active
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [chatId, message] = telegramBotStub.sendMessage.firstCall.args;
      
      expect(chatId).to.equal("123456");
      expect(message).to.not.include("Auto-Renewal Active");
      // It should display the plan menu
      expect(message).to.include("💎"); // Part of plans menu typically
    });
    
    it("should block if tier is not free and is_auto_renewal is true", async () => {
      const plansCall = telegramBotStub.onText
        .getCalls()
        .find((call) => call.args[0].toString().includes("plans"));
      const plansHandler = plansCall.args[1];

      const mockMsg = {
        chat: { id: 123456 },
      };

      subscriberServiceStub.getSubscriber.resolves({ 
        chat_id: '123456', 
        tier: 'premium', 
        is_auto_renewal: true, 
        subscribed: true 
      });
      
      await plansHandler(mockMsg, []);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;
      const [, message] = telegramBotStub.sendMessage.firstCall.args;
      
      expect(message).to.include("Auto-Renewal Active");
    });
  });

  describe("sendToChats()", () => {
    it("should send message to multiple chats", async () => {
      const chatIds = ["chat1", "chat2", "chat3"];
      const message = "Test broadcast message";

      telegramBotStub.sendMessage.resolves({ message_id: 123 });

      const results = await botHandler.sendToChats(chatIds, message);

      expect(telegramBotStub.sendMessage.callCount).to.equal(3);
      expect(results).to.have.lengthOf(3);
      expect(results.every((r) => r.success)).to.be.true;

      // Check each call
      chatIds.forEach((chatId, index) => {
        const call = telegramBotStub.sendMessage.getCall(index);
        expect(call.args[0]).to.equal(chatId);
        expect(call.args[1]).to.equal(message);
        expect(call.args[2].parse_mode).to.equal("HTML");
      });
    });

    it("should handle partial failures when sending to multiple chats", async () => {
      const chatIds = ["chat1", "chat2", "chat3"];
      const message = "Test broadcast message";

      telegramBotStub.sendMessage
        .onFirstCall()
        .resolves({ message_id: 123 })
        .onSecondCall()
        .rejects(new Error("API Error"))
        .onThirdCall()
        .resolves({ message_id: 125 });

      const results = await botHandler.sendToChats(chatIds, message);

      expect(results).to.have.lengthOf(3);
      expect(results[0].success).to.be.true;
      expect(results[1].success).to.be.false;
      expect(results[1].error).to.equal("API Error");
      expect(results[2].success).to.be.true;
    });

    it("should handle empty chat list", async () => {
      const results = await botHandler.sendToChats([], "Test message");

      expect(results).to.have.lengthOf(0);
      expect(telegramBotStub.sendMessage.called).to.be.false;
    });
  });

  describe("getSubscriberService()", () => {
    it("should return subscriber service instance", () => {
      const service = botHandler.getSubscriberService();
      expect(service).to.equal(botHandler.subscriberService);
    });
  });
});
