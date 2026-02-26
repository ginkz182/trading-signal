const chai = require("chai");
const sinon = require("sinon");
const ValidationService = require("../../src/services/validation.service");
const expect = chai.expect;

describe("ValidationService", () => {
    let service;
    let kucoinStub;
    let yahooStub;

    beforeEach(() => {
        service = new ValidationService();
        // Stub the internal services
        kucoinStub = sinon.stub(service.kucoinService, 'validateSymbol');
        yahooStub = sinon.stub(service.yahooService, 'validateSymbol');
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return crypto type if symbol exists in KuCoin", async () => {
        kucoinStub.withArgs("BTC").resolves(true);
        
        const result = await service.validate("BTC");
        
        expect(result.isValid).to.be.true;
        expect(result.type).to.equal("crypto");
        expect(result.formattedSymbol).to.equal("BTC");
        expect(kucoinStub.calledWith("BTC")).to.be.true;
    });

    it("should return crypto type if suffixed symbol exists in KuCoin", async () => {
        kucoinStub.withArgs("ADA").resolves(false);
        kucoinStub.withArgs("ADA/USDT").resolves(true);
        
        const result = await service.validate("ADA");
        
        expect(result.isValid).to.be.true;
        expect(result.type).to.equal("crypto");
        expect(result.formattedSymbol).to.equal("ADA/USDT");
    });

    it("should return stock type if symbol exists in Yahoo", async () => {
        kucoinStub.resolves(false);
        yahooStub.withArgs("AAPL").resolves(true);
        
        const result = await service.validate("AAPL");
        
        expect(result.isValid).to.be.true;
        expect(result.type).to.equal("stock");
        expect(result.formattedSymbol).to.equal("AAPL");
    });

    it("should return invalid if symbol not found anywhere", async () => {
        kucoinStub.resolves(false);
        yahooStub.resolves(false);
        
        const result = await service.validate("INVALID");
        
        expect(result.isValid).to.be.false;
    });
});
