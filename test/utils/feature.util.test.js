const { expect } = require("chai");
const { hasFeature } = require("../../src/utils/feature.util");

describe("Feature Util", () => {
  describe("hasFeature", () => {
    // Test cases for 'assets' feature
    it("should return true for free tier with allowed number of assets", () => {
      expect(hasFeature("free", "assets", 0)).to.be.true;
    });

    it("should return false for free tier with more than allowed assets", () => {
      expect(hasFeature("free", "assets", 6)).to.be.false;
    });

    it("should return true for premium tier with any number of assets", () => {
      expect(hasFeature("premium", "assets", 100)).to.be.true;
    });

    it("should return true for pro tier with any number of assets", () => {
      expect(hasFeature("pro", "assets", 100)).to.be.true;
    });

    // Test cases for 'timeframes' feature
    it("should return true for free tier with allowed timeframe", () => {
      expect(hasFeature("free", "timeframes", "1d")).to.be.true;
    });

    it("should return false for free tier with disallowed timeframe", () => {
      expect(hasFeature("free", "timeframes", "4h")).to.be.false;
    });

    it("should return true for premium tier with allowed timeframes", () => {
      expect(hasFeature("premium", "timeframes", "1d")).to.be.true;
    });

    it("should return false for premium tier with disallowed timeframe", () => {
      expect(hasFeature("premium", "timeframes", "4h")).to.be.false;
      expect(hasFeature("premium", "timeframes", "1h")).to.be.false;
    });

    it("should return true for pro tier with all timeframes", () => {
      expect(hasFeature("pro", "timeframes", "1d")).to.be.true;
      expect(hasFeature("pro", "timeframes", "4h")).to.be.false;
      expect(hasFeature("pro", "timeframes", "1h")).to.be.false;
    });

    // Test cases for invalid inputs
    it("should return false for invalid tier", () => {
      expect(hasFeature("invalid_tier", "assets", 1)).to.be.false;
    });

    it("should return false for invalid feature", () => {
      expect(hasFeature("free", "invalid_feature", "value")).to.be.false;
    });

    it("should return false for null or undefined tier", () => {
      expect(hasFeature(null, "assets", 1)).to.be.false;
      expect(hasFeature(undefined, "assets", 1)).to.be.false;
    });
  });
});
