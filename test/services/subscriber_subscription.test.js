const { expect } = require("chai");
const sinon = require("sinon");
const SubscriberService = require("../../src/services/subscriber.service");

describe("SubscriberService - Subscription Management", () => {
    let service;
    let poolStub, clientStub;

    beforeEach(() => {
        service = new SubscriberService({ databaseUrl: "postgres://mock:mock@localhost:5432/mock" });
        clientStub = {
            query: sinon.stub(),
            release: sinon.spy()
        };
        poolStub = {
            connect: sinon.stub().resolves(clientStub),
            query: sinon.stub(), // Keep this for direct pool queries if any
            end: sinon.stub()
        };
        service.pool = poolStub;
        service.initialized = true;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("updateSubscription", () => {
        it("should upgrade a user and calculate expiration correctly (New Sub)", async () => {
            const chatId = "12345";
            const duration = 30;

            // Mock finding existing user (Free user)
            clientStub.query.withArgs("SELECT tier, subscription_end_at FROM subscribers WHERE chat_id = $1", [chatId])
                .resolves({ rows: [{ tier: "free", subscription_end_at: null }] });

            await service.updateSubscription(chatId, "premium", duration, "test");

            // Verify update query
            const updateCall = clientStub.query.getCall(2); // BEGIN, SELECT, UPDATE
            const updateQuery = updateCall.args[0];
            const updateParams = updateCall.args[1];

            expect(updateQuery).to.include("UPDATE subscribers");
            expect(updateParams[0]).to.equal("premium");
            
            // Expected: NOW + 30 days
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() + 30);
            
            expect(updateParams[1]).to.be.instanceOf(Date);
            // Allow 1 second difference
            expect(updateParams[1].getTime()).to.be.closeTo(expectedDate.getTime(), 1000);
        });

        it("should extend subscription if renewing same tier", async () => {
            const chatId = "12345";
            const duration = 30;
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 10); // Expires in 10 days

             clientStub.query.withArgs("SELECT tier, subscription_end_at FROM subscribers WHERE chat_id = $1", [chatId])
                .resolves({ rows: [{ tier: "premium", subscription_end_at: futureDate }] });

            await service.updateSubscription(chatId, "premium", duration, "renew");

            const updateCall = clientStub.query.getCall(2);
            const updateParams = updateCall.args[1];

            // Expected: FutureDate + 30 days
            const expectedDate = new Date(futureDate);
            expectedDate.setDate(expectedDate.getDate() + 30);
            
            expect(updateParams[1].getTime()).to.be.closeTo(expectedDate.getTime(), 1000);
        });

        it("should prorate remaining value when upgrading tiers", async () => {
            const chatId = "12345";
            const duration = 30; // Buying 1 month of Pro
            
            // Mock Config prices (Premium 100, Pro 200)
            const config = require("../../src/config");
            const originalPremium = config.tiers.premium.monthlyPrice;
            const originalPro = config.tiers.pro.monthlyPrice;
            config.tiers.premium.monthlyPrice = 100;
            config.tiers.pro.monthlyPrice = 200;

            // Mock user with 60 days of Premium left (Value = 200)
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 60);

            clientStub.query.withArgs("SELECT tier, subscription_end_at FROM subscribers WHERE chat_id = $1", [chatId])
                .resolves({ rows: [{ tier: "premium", subscription_end_at: futureDate }] });

            await service.updateSubscription(chatId, "pro", duration, "upgrade");

            const updateCall = clientStub.query.getCall(2);
            const updateParams = updateCall.args[1];

            // Calculation:
            // Remaining Value = 60 days * (100/30) = 200
            // Converted Days = 200 / (200/30) = 30 days
            // New Total = 30 (bought) + 30 (converted) = 60 days from NOW
            
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() + 60);

            expect(updateParams[0]).to.equal("pro");
            // Allow 1.1 day variance due to JS floating numbers
            expect(updateParams[1].getTime()).to.be.closeTo(expectedDate.getTime(), 95040000); // 1.1 days in ms
            
            // Restore config
            config.tiers.premium.monthlyPrice = originalPremium;
            config.tiers.pro.monthlyPrice = originalPro;
        });

        it("should handle lifetime subscription (duration = null)", async () => {
            const chatId = "12345";

             clientStub.query.withArgs("SELECT tier, subscription_end_at FROM subscribers WHERE chat_id = $1", [chatId])
                .resolves({ rows: [{ tier: "free", subscription_end_at: null }] });

            await service.updateSubscription(chatId, "vip", null, "limitless");

            const updateCall = clientStub.query.getCall(2);
            const updateParams = updateCall.args[1];

            expect(updateParams[1]).to.be.null; // subscription_end_at should be null
        });

        it("should reset is_auto_renewal to false when downgrading to free tier", async () => {
            const chatId = "12345";

            clientStub.query.withArgs("SELECT tier, subscription_end_at FROM subscribers WHERE chat_id = $1", [chatId])
                .resolves({ rows: [{ tier: "premium", subscription_end_at: new Date() }] });

            await service.updateSubscription(chatId, "free", null, "downgrade");

            const updateCall = clientStub.query.getCall(2);
            const updateQuery = updateCall.args[0];

            expect(updateQuery).to.include("is_auto_renewal = false");
        });
    });

    describe("checkExpirations", () => {
        it("should downgrade users with expired subscriptions", async () => {
            // Mock finding expired users
            const expiredUsers = [
                { chat_id: "user1", tier: "resident" },
                { chat_id: "user2", tier: "vip" }
            ];
            
            clientStub.query.withArgs(sinon.match((query) => query.includes("SELECT chat_id, tier")))
                .resolves({ rows: expiredUsers });

            const result = await service.checkExpirations();

            expect(result.downgraded).to.equal(2);
            expect(result.distinctUsers).to.include("user1");
            expect(result.distinctUsers).to.include("user2");

            // Verify update call for each user
            // Calls include: BEGIN, SELECT, UPDATE(subscribers), DELETE(user_assets), INSERT(history) ... COMMIT
            const updateCalls = clientStub.query.getCalls().filter(call => call.args[0].includes("UPDATE subscribers"));
            expect(updateCalls.length).to.equal(2);
            expect(updateCalls[0].args[0]).to.include("SET tier = 'free'");
            expect(updateCalls[0].args[0]).to.include("is_auto_renewal = false");
        });
    });
});
