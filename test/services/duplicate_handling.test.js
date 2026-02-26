const chai = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const { expect } = chai;

describe("TelegramBotHandler - Duplicate Handling", () => {
    let botHandler;
    let telegramBotStub;
    let subscriberServiceStub;
    let monitorServiceStub;
    let validationServiceStub;

    beforeEach(() => {
        telegramBotStub = {
            onText: sinon.stub(),
            sendMessage: sinon.stub().resolves(),
            on: sinon.stub(),
            sendChatAction: sinon.stub().resolves(),
        };

        subscriberServiceStub = {
            subscribeAsset: sinon.stub(),
            subscribe: sinon.stub().resolves(),
            initialize: sinon.stub().resolves(),
            getSubscriber: sinon.stub(),
            // other methods...
        };

        validationServiceStub = {
             validate: sinon.stub(),
        };

        const TelegramBotHandlers = proxyquire("../../src/services/telegram-bot-handler", {
            "node-telegram-bot-api": sinon.stub().returns(telegramBotStub),
            "./subscriber.service": sinon.stub().returns(subscriberServiceStub),
            "./validation.service": sinon.stub().returns(validationServiceStub),
        });

        botHandler = new TelegramBotHandlers({ token: "token", subscriberService: subscriberServiceStub });
        // Manually inject validationService because we mocked the class constructor but the handler instantiates it.
        // Actually proxyquire handles the class constructor mock.
        // But `handler.validationService` is set in constructor.
        // Wait, proxyquire returns the Class.
        // `botHandler` instance has `this.validationService = new ValidationService()`.
        // So `validationServiceStub` needs to be the INSTANCE returned by the mocked class.
        // My proxyquire setup: `"./validation.service": sinon.stub().returns(validationServiceStub)`
        // This means `new ValidationService()` returns `validationServiceStub`. Perfect.
    });

    it("should notify user if asset is already subscribed", async () => {
       // Find subscribe command
       // Trigger it
       // Mock validation to return valid
       // Mock addAsset to return undefined
       // Expect "already subscribed" message

       const subscribeHandler = telegramBotStub.onText.getCalls().find(c => c.args[0].toString().includes("add")).args[1];
       
       validationServiceStub.validate.resolves({ isValid: true, type: 'crypto', formattedSymbol: 'BTC' });
       subscriberServiceStub.subscribeAsset.resolves({ status: 'exists' }); // Duplicate
       subscriberServiceStub.getSubscriber.resolves({ tier: 'premium', chat_id: '123', subscribed: true });

       await subscribeHandler({ chat: { id: "123" } }, ["/add BTC", "BTC"]);

       expect(telegramBotStub.sendMessage.calledWith(
           "123", 
           sinon.match.string.and(sinon.match(/already subscribed/)), 
           sinon.match.any
       )).to.be.true;
    });

    it("should notify user if asset is successfully added", async () => {
       const subscribeHandler = telegramBotStub.onText.getCalls().find(c => c.args[0].toString().includes("add")).args[1];
       
       validationServiceStub.validate.resolves({ isValid: true, type: 'crypto', formattedSymbol: 'BTC' });
       subscriberServiceStub.subscribeAsset.resolves({ status: 'added', asset: { symbol: 'BTC', type: 'crypto' } }); // Success
       subscriberServiceStub.getSubscriber.resolves({ tier: 'premium', chat_id: '123', subscribed: true });

       await subscribeHandler({ chat: { id: "123" } }, ["/add BTC", "BTC"]);

       expect(telegramBotStub.sendMessage.calledWith(
           "123", 
           sinon.match.string.and(sinon.match(/added to your crypto list/)), 
           sinon.match.any
       )).to.be.true;
    });
});
