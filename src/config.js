const config = {
  symbols: [
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "AVAX/USDT",
    "LINK/USDT",
    "BNB/USDT",
    "ARB/USDT",
    "INJ/USDT",
    "ONDO/USDT",
    "STX/USDT",
  ],
  stockSymbols: [
    "NVDA",
    "TSLA",
    "BKNG",
    "META",
    "PLTR",
    "AMZN",
    "GOOG",
    "LLY",
    "COST",
    "CCJ",
    "RTX",
    "GEV",
    "GC=F",
  ],
  timeframe: "1d",
  tiers: {
    free: {
      assets: 5,
      timeframes: ["1d"],
    },
    premium: {
      assets: "all",
      timeframes: ["1d", "4h"],
    },
    pro: {
      assets: "all",
      timeframes: ["1d", "4h", "1h"],
    },
  },
};

module.exports = config;
