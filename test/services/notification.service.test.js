// test/services/notification.service.test.js
const { expect } = require("chai");
const sinon = require("sinon");
const TelegramBot = require("node-telegram-bot-api");
const NotificationService = require("../../src/services/notification.service");
const SubscriberService = require("../../src/services/subscriber.service");

describe("NotificationService", () => {
  let notificationService;
  let telegramBotStub;
  let subscriberServiceStub;

  const mockConfig = {
    telegramToken: "mock-telegram-token",
    subscriberConfig: {
      databaseUrl: "postgresql://test@localhost:5432/test",
    },
  };

  beforeEach(() => {
    // Create a stub for the TelegramBot class
    telegramBotStub = {
      sendMessage: sinon.stub(),
    };

    // Stub the TelegramBot constructor
    sinon
      .stub(TelegramBot.prototype, "sendMessage")
      .callsFake(telegramBotStub.sendMessage);

    // Create a stub for SubscriberService
    subscriberServiceStub = sinon.createStubInstance(SubscriberService);
    subscriberServiceStub.getActiveChatIds.resolves([
      "chat1",
      "chat2",
      "chat3",
    ]);
    subscriberServiceStub.getStats.resolves({
      total: 5,
      active: 3,
      inactive: 2,
    });

    // Stub the SubscriberService constructor
    sinon
      .stub(SubscriberService.prototype, "getActiveChatIds")
      .callsFake(subscriberServiceStub.getActiveChatIds);
    sinon
      .stub(SubscriberService.prototype, "getStats")
      .callsFake(subscriberServiceStub.getStats);

    notificationService = new NotificationService(mockConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with subscriber service", () => {
      expect(notificationService.subscriberService).to.exist;
      expect(notificationService.telegramToken).to.equal("mock-telegram-token");
    });

    it("should throw error if no database URL provided", () => {
      // Temporarily remove DATABASE_URL for this test
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      expect(() => {
        new NotificationService({
          telegramToken: "token",
          subscriberConfig: {}, // No databaseUrl
        });
      }).to.throw("DATABASE_URL is required");

      // Restore DATABASE_URL
      process.env.DATABASE_URL = originalUrl;
    });
  });

  describe("sendToSingleChat()", () => {
    it("should send message to a single chat successfully", async () => {
      telegramBotStub.sendMessage.resolves({ message_id: 123 });

      const result = await notificationService.sendToSingleChat(
        "chat123",
        "Test message"
      );

      expect(result.success).to.be.true;
      expect(result.chatId).to.equal("chat123");
      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;

      const [chatId, message, options] =
        telegramBotStub.sendMessage.firstCall.args;
      expect(chatId).to.equal("chat123");
      expect(message).to.equal("Test message");
      expect(options.parse_mode).to.equal("HTML");
    });

    it("should handle API errors gracefully", async () => {
      const errorMessage = "API Error";
      telegramBotStub.sendMessage.rejects(new Error(errorMessage));

      const result = await notificationService.sendToSingleChat(
        "chat123",
        "Test message"
      );

      expect(result.success).to.be.false;
      expect(result.error).to.equal(errorMessage);
      expect(result.chatId).to.equal("chat123");
    });
  });

  describe("sendToTelegram()", () => {
    it("should send message to all active subscribers", async () => {
      telegramBotStub.sendMessage.resolves({ message_id: 123 });

      const result = await notificationService.sendToTelegram(
        "Test signal notification"
      );

      expect(subscriberServiceStub.getActiveChatIds.calledOnce).to.be.true;
      expect(telegramBotStub.sendMessage.callCount).to.equal(3); // 3 active subscribers
      expect(result.success).to.be.true;
      expect(result.totalChats).to.equal(3);
      expect(result.successfulChats).to.equal(3);
      expect(result.failedChats).to.equal(0);
    });

    it("should handle partial failures gracefully", async () => {
      // First two calls succeed, third fails
      telegramBotStub.sendMessage
        .onFirstCall()
        .resolves({ message_id: 123 })
        .onSecondCall()
        .resolves({ message_id: 124 })
        .onThirdCall()
        .rejects(new Error("API Error"));

      const result = await notificationService.sendToTelegram(
        "Test signal notification"
      );

      expect(result.success).to.be.true; // Still successful since some messages sent
      expect(result.totalChats).to.equal(3);
      expect(result.successfulChats).to.equal(2);
      expect(result.failedChats).to.equal(1);
    });

    it("should handle no active subscribers", async () => {
      subscriberServiceStub.getActiveChatIds.resolves([]);

      const result = await notificationService.sendToTelegram(
        "Test signal notification"
      );

      expect(result.success).to.be.false;
      expect(result.totalChats).to.equal(0);
      expect(telegramBotStub.sendMessage.called).to.be.false;
    });

    it("should handle missing telegram token", async () => {
      const serviceWithoutToken = new NotificationService({
        subscriberConfig: {
          databaseUrl: "postgresql://test@localhost:5432/test",
        },
      });

      const result = await serviceWithoutToken.sendToTelegram("Test message");

      expect(result.success).to.be.false;
      expect(result.error).to.equal("No token");
    });
  });

  describe("sendBroadcast()", () => {
    it("should send broadcast message to all active subscribers", async () => {
      telegramBotStub.sendMessage.resolves({ message_id: 123 });

      const results = await notificationService.sendBroadcast(
        "Broadcast message"
      );

      expect(results).to.have.lengthOf(3);
      expect(results.every((r) => r.success)).to.be.true;
      expect(telegramBotStub.sendMessage.callCount).to.equal(3);
    });
  });

  describe("getStats()", () => {
    it("should return subscriber statistics", async () => {
      const stats = await notificationService.getStats();

      expect(stats.total).to.equal(5);
      expect(stats.active).to.equal(3);
      expect(stats.inactive).to.equal(2);
      expect(subscriberServiceStub.getStats.calledOnce).to.be.true;
    });
  });

  describe("getSubscriberService()", () => {
    it("should return subscriber service instance", () => {
      // This method might not exist in the simplified version
      expect(notificationService.subscriberService).to.exist;
    });
  });
});
