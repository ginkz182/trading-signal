const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai").default;
const proxyquire = require("proxyquire");
const dayjs = require("dayjs");

const { expect } = chai;
chai.use(sinonChai);

describe("TelegramBotHandler", () => {
  let TelegramBotHandler;
  let botMock;
  let subscriberServiceMock;
  let monitorServiceMock;
  let handler;

  beforeEach(() => {
    botMock = {
      onText: sinon.spy(),
      sendMessage: sinon.stub(),
      on: sinon.spy(),
    };

    subscriberServiceMock = {
      getSubscriber: sinon.stub(),
    };

    monitorServiceMock = {
        notifyNewUser: sinon.stub(),
    };

    const TelegramBot = sinon.stub().returns(botMock);

    // Use proxyquire to inject mocks
    TelegramBotHandler = proxyquire("../../src/services/telegram-bot-handler", {
      "node-telegram-bot-api": TelegramBot,
      "./subscriber.service": function () {
        return subscriberServiceMock;
      },
    });

    handler = new TelegramBotHandler({
      token: "fake-token",
      subscriberService: subscriberServiceMock,
      monitorService: monitorServiceMock,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("/status command", () => {
    it("should show free tier status for free user", async () => {
      const mockSubscriber = {
        subscribed: true,
        subscribed_at: new Date(),
        tier: "free",
      };
      subscriberServiceMock.getSubscriber.resolves(mockSubscriber);

      const statusCallback = botMock.onText.getCall(2).args[1];
      await statusCallback({ chat: { id: "123" } });

      const tierConfig = require("../../src/config").tiers[mockSubscriber.tier];
      const tierDisplayName = tierConfig?.displayName.toUpperCase() || mockSubscriber.tier.toUpperCase();

      const expectedMessage = `✅ <b>Subscription Status: Active</b>

<b>Subscribed since:</b> ${dayjs(mockSubscriber.subscribed_at).format('DD MMM YYYY')}
<b>Tier:</b> ${tierDisplayName}

Use /cancel to stop auto-renewal or /stop to unsubscribe (temporary pause notification).`;

      expect(botMock.sendMessage).to.have.been.calledWith(
        "123",
        expectedMessage,
        { parse_mode: "HTML" },
      );

    });

    it("should show premium tier status for premium user", async () => {
      const mockSubscriber = {
        subscribed: true,
        subscribed_at: new Date(),
        tier: "premium",
      };
      subscriberServiceMock.getSubscriber.resolves(mockSubscriber);

      const statusCallback = botMock.onText.getCall(2).args[1];
      await statusCallback({ chat: { id: "123" } });
      
      const tierConfig = require("../../src/config").tiers[mockSubscriber.tier];
      const tierDisplayName = tierConfig?.displayName.toUpperCase() || mockSubscriber.tier.toUpperCase();

      const expectedMessage = `✅ <b>Subscription Status: Active</b>

<b>Subscribed since:</b> ${dayjs(mockSubscriber.subscribed_at).format('DD MMM YYYY')}
<b>Tier:</b> ${tierDisplayName}
<b>Expires:</b> Lifetime/Indefinite
<b>Auto-Renew:</b> ❌ Manual (One-time/PromptPay)

Use /cancel to stop auto-renewal or /stop to unsubscribe (temporary pause notification).`;

      expect(botMock.sendMessage).to.have.been.calledWith(
        "123",
        expectedMessage,
        { parse_mode: "HTML" },
      );
    });

    it("should show pro tier status for pro user", async () => {
      const mockSubscriber = {
        subscribed: true,
        subscribed_at: new Date(),
        tier: "pro",
      };
      subscriberServiceMock.getSubscriber.resolves(mockSubscriber);

      const statusCallback = botMock.onText.getCall(2).args[1];
      await statusCallback({ chat: { id: "123" } });

      const tierConfig = require("../../src/config").tiers[mockSubscriber.tier];
      const tierDisplayName = tierConfig?.displayName.toUpperCase() || mockSubscriber.tier.toUpperCase();

      const expectedMessage = `✅ <b>Subscription Status: Active</b>

<b>Subscribed since:</b> ${dayjs(mockSubscriber.subscribed_at).format('DD MMM YYYY')}
<b>Tier:</b> ${tierDisplayName}
<b>Expires:</b> Lifetime/Indefinite
<b>Auto-Renew:</b> ❌ Manual (One-time/PromptPay)

Use /cancel to stop auto-renewal or /stop to unsubscribe (temporary pause notification).`;

      expect(botMock.sendMessage).to.have.been.calledWith(
        "123",
        expectedMessage,
        { parse_mode: "HTML" },
      );
    });
  });
});
