const { expect } = require("chai");
const sinon = require("sinon");
const TelegramBot = require("node-telegram-bot-api");
const NotificationService = require("../../src/services/notification.service");

describe("NotificationService", () => {
  let notificationService;
  let telegramBotStub;

  const mockConfig = {
    telegramToken: "mock-telegram-token",
    telegramChatId: "mock-chat-id",
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

    notificationService = new NotificationService(mockConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("sendToTelegram()", () => {
    it("should send message to Telegram successfully", async () => {
      // Mock successful send
      telegramBotStub.sendMessage.resolves({ message_id: 123 });

      const message = "Test signal notification";
      await notificationService.sendToTelegram(message);

      expect(telegramBotStub.sendMessage.calledOnce).to.be.true;

      // Verify the chat ID and message
      const chatIdArg = telegramBotStub.sendMessage.firstCall.args[0];
      const messageArg = telegramBotStub.sendMessage.firstCall.args[1];
      const optionsArg = telegramBotStub.sendMessage.firstCall.args[2];

      expect(chatIdArg).to.equal("mock-chat-id");
      expect(messageArg).to.equal(message);
      expect(optionsArg).to.deep.include({
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    });

    it("should handle API errors gracefully", async () => {
      // Mock API error
      const errorMessage = "API Error";
      telegramBotStub.sendMessage.rejects(new Error(errorMessage));

      // Spy on console.error
      const consoleErrorSpy = sinon.spy(console, "error");

      const message = "Test signal notification";

      // Should not throw
      await notificationService.sendToTelegram(message);

      // Should log the error
      expect(consoleErrorSpy.called).to.be.true;
      expect(consoleErrorSpy.firstCall.args[0]).to.include(
        "Error sending Telegram message"
      );
      expect(consoleErrorSpy.firstCall.args[1].message).to.equal(errorMessage);
    });

    it("should handle missing configuration", async () => {
      // Create service with incomplete configuration
      const incompleteService = new NotificationService({
        // Missing telegramToken and telegramChatId
      });

      // Spy on console.log
      const consoleLogSpy = sinon.spy(console, "log");

      const message = "Test signal notification";

      // Should not throw
      const result = await incompleteService.sendToTelegram(message);

      // Should log the message
      expect(consoleLogSpy.called).to.be.true;
      expect(consoleLogSpy.firstCall.args[0]).to.include(
        "Telegram configuration missing"
      );

      // Should not attempt to send message
      expect(telegramBotStub.sendMessage.called).to.be.false;
    });
  });
});
