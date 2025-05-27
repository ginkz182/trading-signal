// test/services/telegram-bot-handler.test.js
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

describe("TelegramBotHandler", () => {
  let botHandler;
  let telegramBotStub;
  let subscriberServiceStub;
  let TelegramBotHandler;

  const mockConfig = {
    token: "mock-telegram-token",
    subscriberConfig: {
      databaseUrl: "postgresql://test@localhost:5432/test",
    },
  };

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
    };

    // Mock SubscriberService constructor
    const SubscriberServiceMock = sinon.stub().returns(subscriberServiceStub);

    // Use proxyquire to inject our mocks
    TelegramBotHandler = proxyquire("../../src/services/telegram-bot-handler", {
      "node-telegram-bot-api": TelegramBotMock,
      "./subscriber.service": SubscriberServiceMock,
    });

    // Stub console methods to prevent test output pollution
    sinon.stub(console, "error");
    sinon.stub(console, "log");

    botHandler = new TelegramBotHandler(mockConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize bot and subscriber service", () => {
      expect(botHandler.bot).to.exist;
      expect(botHandler.subscriberService).to.exist;
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
    it("should subscribe user on /start command", async () => {
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
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;

      // Check welcome message content
      const [chatId, message, options] =
        telegramBotStub.sendMessage.firstCall.args;
      expect(chatId.toString()).to.equal("123456");
      expect(message).to.include("Welcome to Trading Signals!");
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
      expect(message).to.include("error subscribing");
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
      expect(message).to.include("unsubscribed");
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
      expect(message).to.include("not subscribed");
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
      expect(message).to.include("Trading Signals Bot Commands");
      expect(options.parse_mode).to.equal("HTML");
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
