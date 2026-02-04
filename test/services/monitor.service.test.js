const { expect } = require("chai");
const sinon = require("sinon");
const MonitorService = require("../../src/services/monitor.service");

describe("MonitorService", () => {
  let notificationServiceStub;
  let monitorService;
  const ADMIN_CHAT_ID = "admin123";

  beforeEach(() => {
    notificationServiceStub = {
      sendToSingleChat: sinon.stub().resolves(),
    };
  });

  describe("with adminChatId", () => {
    beforeEach(() => {
      monitorService = new MonitorService(notificationServiceStub, ADMIN_CHAT_ID);
    });

    it("should notify on new user", async () => {
      const user = {
        id: "user1",
        first_name: "John",
        last_name: "Doe",
        username: "johndoe",
      };
      await monitorService.notifyNewUser(user);

      expect(notificationServiceStub.sendToSingleChat.calledOnce).to.be.true;
      const [chatId, message] = notificationServiceStub.sendToSingleChat.firstCall.args;
      expect(chatId).to.equal(ADMIN_CHAT_ID);
      expect(message).to.include("New User Alert");
      expect(message).to.include("ID: user1");
      expect(message).to.include("Name: John Doe");
      expect(message).to.include("Username: @johndoe");
    });

    it("should notify on subscription change", async () => {
      await monitorService.notifySubscriptionChange("user123", "premium");

      expect(notificationServiceStub.sendToSingleChat.calledOnce).to.be.true;
      const [chatId, message] = notificationServiceStub.sendToSingleChat.firstCall.args;
      expect(chatId).to.equal(ADMIN_CHAT_ID);
      expect(message).to.include("Subscription Change");
      expect(message).to.include("Chat ID: user123");
      expect(message).to.include("New Tier: premium");
    });

    it("should notify on successful cron run", async () => {
      await monitorService.notifyCronRunStatus(true, "Daily Scan");

      expect(notificationServiceStub.sendToSingleChat.calledOnce).to.be.true;
      const [chatId, message] = notificationServiceStub.sendToSingleChat.firstCall.args;
      expect(chatId).to.equal(ADMIN_CHAT_ID);
      expect(message).to.include("Cron Job Success");
      expect(message).to.include("Job: Daily Scan");
    });

    it("should notify on failed cron run", async () => {
      const error = new Error("Something went wrong");
      error.stack = "stack trace";
      await monitorService.notifyCronRunStatus(false, "Daily Scan", error);

      expect(notificationServiceStub.sendToSingleChat.calledOnce).to.be.true;
      const [chatId, message] = notificationServiceStub.sendToSingleChat.firstCall.args;
      expect(chatId).to.equal(ADMIN_CHAT_ID);
      expect(message).to.include("Cron Job FAILED");
      expect(message).to.include("Job: Daily Scan");
      expect(message).to.include("Error: Something went wrong");
      expect(message).to.include("stack trace");
    });
  });

  describe("without adminChatId", () => {
    beforeEach(() => {
      monitorService = new MonitorService(notificationServiceStub, null);
    });

    it("should not send notification for new user", async () => {
      await monitorService.notifyNewUser({});
      expect(notificationServiceStub.sendToSingleChat.notCalled).to.be.true;
    });

    it("should not send notification for subscription change", async () => {
      await monitorService.notifySubscriptionChange("user123", "premium");
      expect(notificationServiceStub.sendToSingleChat.notCalled).to.be.true;
    });

    it("should not send notification for cron run status", async () => {
      await monitorService.notifyCronRunStatus(true, "Daily Scan");
      expect(notificationServiceStub.sendToSingleChat.notCalled).to.be.true;
    });
  });
});
