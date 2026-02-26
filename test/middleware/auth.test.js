const { expect } = require("chai");
const sinon = require("sinon");
const { requireTier } = require("../../src/middleware/auth.middleware");
const config = require("../../src/config");

describe("Auth Middleware", () => {
    let mockServices, mockBot, mockSubscriberService;
    let mockMsg;

    beforeEach(() => {
        process.env.ADMIN_CHAT_ID = undefined;
        mockBot = {
            sendMessage: sinon.spy()
        };
        mockSubscriberService = {
            getSubscriber: sinon.stub()
        };
        mockServices = {
            bot: mockBot,
            subscriberService: mockSubscriberService
        };
        mockMsg = {
            chat: { id: "123456" }
        };
    });

    it("should allow access if user tier meets requirement", async () => {
        // User is 'premium' (level 10)
        mockSubscriberService.getSubscriber.resolves({ tier: "premium", subscribed: true });

        // Req is 'premium' (level 10)
        const handler = sinon.spy();
        const middleware = requireTier("premium", handler, mockServices);

        await middleware(mockMsg);

        expect(handler.calledOnce).to.be.true;
        expect(mockBot.sendMessage.called).to.be.false;
    });

    it("should deny access if user tier is too low", async () => {
        // User is 'free' (level 0)
        mockSubscriberService.getSubscriber.resolves({ tier: "free", subscribed: true });

        // Req is 'premium' (level 10)
        const handler = sinon.spy();
        const middleware = requireTier("premium", handler, mockServices);

        await middleware(mockMsg);

        expect(handler.called).to.be.false;
        expect(mockBot.sendMessage.calledOnce).to.be.true;
        expect(mockBot.sendMessage.firstCall.args[1]).to.include("Upgrade");
    });

    it("should allow ADMIN_CHAT_ID even if tier is low", async () => {
        // Setup env override
        process.env.ADMIN_CHAT_ID = "999999";
        mockMsg.chat.id = "999999";

        // User is 'free' in DB
        mockSubscriberService.getSubscriber.resolves({ tier: "free", subscribed: true });

        // Req is 'admin' (level 100)
        const handler = sinon.spy();
        const middleware = requireTier("admin", handler, mockServices);

        await middleware(mockMsg);

        expect(handler.calledOnce).to.be.true;
    });

    it("should reject if user is not subscribed at all", async () => {
        mockSubscriberService.getSubscriber.resolves(null);

        const handler = sinon.spy();
        const middleware = requireTier("free", handler, mockServices);

        await middleware(mockMsg);

        expect(handler.called).to.be.false;
        expect(mockBot.sendMessage.calledWith(sinon.match.any, sinon.match("turned off"))).to.be.true;
    });
});
