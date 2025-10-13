const { expect } = require("chai");
const {
  formatSignals,
  formatSignalEmoji,
  formatPrice,
} = require("../../src/utils/formatters");

describe("Formatters", () => {
  describe("formatSignals", () => {
    it("should display GOLD instead of GC=F for gold futures", () => {
      const signals = {
        crypto: {},
        stocks: {
          "GC=F": {
            signal: "BUY",
            price: 4094.1,
          },
        },
      };

      const message = formatSignals(signals);

      expect(message).to.include("GOLD");
      expect(message).to.not.include("GC=F");
      expect(message).to.include("BUY");
      expect(message).to.include("$4094.10");
    });

    it("should display regular stock symbols as-is", () => {
      const signals = {
        crypto: {},
        stocks: {
          NVDA: {
            signal: "SELL",
            price: 123.45,
          },
        },
      };

      const message = formatSignals(signals);

      expect(message).to.include("NVDA");
      expect(message).to.include("SELL");
    });

    it("should format both crypto and stocks correctly", () => {
      const signals = {
        crypto: {
          "BTC/USDT": {
            signal: "BUY",
            price: 50000.123,
          },
        },
        stocks: {
          "GC=F": {
            signal: "SELL",
            price: 4000.5,
          },
          NVDA: {
            signal: "BUY",
            price: 150.75,
          },
        },
      };

      const message = formatSignals(signals);

      expect(message).to.include("CRYPTO");
      expect(message).to.include("BTC/USDT");
      expect(message).to.include("STOCKS");
      expect(message).to.include("GOLD");
      expect(message).to.not.include("GC=F");
      expect(message).to.include("NVDA");
    });
  });

  describe("formatSignalEmoji", () => {
    it("should return correct emoji for BUY signal", () => {
      expect(formatSignalEmoji("BUY")).to.equal("🟢");
    });

    it("should return correct emoji for SELL signal", () => {
      expect(formatSignalEmoji("SELL")).to.equal("🔴");
    });

    it("should return white circle for HOLD or unknown", () => {
      expect(formatSignalEmoji("HOLD")).to.equal("⚪");
      expect(formatSignalEmoji("UNKNOWN")).to.equal("⚪");
    });
  });

  describe("formatPrice", () => {
    it("should format gold futures price with 2 decimals", () => {
      const price = formatPrice(4094.1, "stock");
      expect(price).to.equal("$4094.10");
    });

    it("should format high value crypto with 2 decimals", () => {
      const price = formatPrice(50000.123, "crypto");
      expect(price).to.equal("$50,000.12");
    });

    it("should format mid value crypto with 4 decimals", () => {
      const price = formatPrice(123.456789, "crypto");
      expect(price).to.equal("$123.4568");
    });

    it("should format stock prices with 2 decimals", () => {
      const price = formatPrice(123.456, "stock");
      expect(price).to.equal("$123.46");
    });
  });
});
