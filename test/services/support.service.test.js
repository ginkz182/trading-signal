const { expect } = require("chai");
const sinon = require("sinon");
const SupportService = require("../../src/services/support.service");
const messages = require("../../src/config/messages");
const config = require("../../src/config");

describe("SupportService", () => {
  let supportService;
  let botStub;
  let originalAdminChatId;
  let originalEnvAdminChatId;

  beforeEach(() => {
    botStub = {
      sendMessage: sinon.stub().resolves(),
    };
    supportService = new SupportService({ bot: botStub });
    
    // Save original configs
    originalAdminChatId = config.telegram.adminChatId;
    originalEnvAdminChatId = process.env.ADMIN_CHAT_ID;
    
    // Stub console methods to prevent test output pollution
    sinon.stub(console, "error");
    sinon.stub(console, "warn");
  });

  afterEach(() => {
    sinon.restore();
    config.telegram.adminChatId = originalAdminChatId;
    process.env.ADMIN_CHAT_ID = originalEnvAdminChatId;
  });

  describe("handleSupport", () => {
    it("should reject empty support messages", async () => {
      const msg = { chat: { id: 123 }, from: { first_name: "Test" } };
      const match = ["/support"];
      
      await supportService.handleSupport(msg, match);

      expect(botStub.sendMessage.calledOnce).to.be.true;
      expect(botStub.sendMessage.firstCall.args[1]).to.include("Usage:");
    });

    it("should send confirmation to user and notify admin", async () => {
      config.telegram.adminChatId = "ADMIN_ID";
      const msg = { chat: { id: 123 }, from: { first_name: "TestUser" } };
      const match = ["/support Hello Admin", "Hello Admin"];
      
      await supportService.handleSupport(msg, match);

      expect(botStub.sendMessage.callCount).to.equal(2);
      
      // User confirmation
      expect(botStub.sendMessage.firstCall.args[0]).to.equal("123");
      expect(botStub.sendMessage.firstCall.args[1]).to.equal(messages.supportReceived);

      // Admin notification
      expect(botStub.sendMessage.secondCall.args[0]).to.equal("ADMIN_ID");
      expect(botStub.sendMessage.secondCall.args[1]).to.include("Support Request from TestUser");
      expect(botStub.sendMessage.secondCall.args[1]).to.include("Hello Admin");
    });
  });

  describe("handleReply", () => {
    it("should silently ignore requests from non-admin users", async () => {
      config.telegram.adminChatId = "ADMIN_ID";
      const msg = { chat: { id: 123 } };
      const match = ["/reply target_user Hello"];
      
      await supportService.handleReply(msg, match);

      expect(botStub.sendMessage.called).to.be.false;
    });

    it("should reject requests from admin with missing target or message", async () => {
      config.telegram.adminChatId = "ADMIN_ID";
      const msg = { chat: { id: "ADMIN_ID" } };
      
      // Missing entirely
      await supportService.handleReply(msg, ["/reply"]);
      expect(botStub.sendMessage.lastCall.args[1]).to.include("Usage:");
      
      // Missing message
      await supportService.handleReply(msg, ["/reply 123456", "123456"]);
      expect(botStub.sendMessage.lastCall.args[1]).to.include("Usage:");
    });

    it("should send reply to target user and confirm to admin", async () => {
      config.telegram.adminChatId = "ADMIN_ID";
      const msg = { chat: { id: "ADMIN_ID" } };
      const match = ["/reply 123456 Hello User", "123456 Hello User"];
      
      await supportService.handleReply(msg, match);

      expect(botStub.sendMessage.callCount).to.equal(2);

      // Sent to target user
      expect(botStub.sendMessage.firstCall.args[0]).to.equal("123456");
      expect(botStub.sendMessage.firstCall.args[1]).to.include("Hello User");

      // Confirmation to admin
      expect(botStub.sendMessage.secondCall.args[0]).to.equal("ADMIN_ID");
      expect(botStub.sendMessage.secondCall.args[1]).to.include("Reply successfully sent to 123456");
    });
  });
});
