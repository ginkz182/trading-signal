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
    "GOLD",
  ],
  timeframe: "1d",
  tiers: {
    free: {
      displayName: "Stray",
      assets: 0,
      timeframes: ["1d"],
      backtestLimit: 0,
    },
    premium: {
      displayName: "Resident",
      assets: "all",
      timeframes: ["1d"],
      monthlyPrice: 19900, // 199 THB
      backtestLimit: 3, // 3 times per calendar month
    },
    pro: {
      displayName: "The Alpha",
      assets: "all",
      timeframes: ["1d"],
      monthlyPrice: 59900, // 599 THB
      backtestLimit: null, // unlimited
    },
  },
  tierLevels: {
    free: 0,
    premium: 10,
    pro: 20,
    admin: 100,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    // Define price IDs for different tiers/recurrence
    prices: {
        premium_monthly: process.env.STRIPE_PRICE_ID_PREMIUM,
    },
    // Amount in smallest currency unit (e.g., Satang for THB) for one-time payments
    amounts: {
        premium_monthly: 19900, // 199.00 THB
    }
  },
  telegram: {
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'pginkSignalTest_bot',
      adminChatId: process.env.ADMIN_CHAT_ID
  },
  payment: {
      starsPrice: 250, // Stars
  },
};

module.exports = config;
