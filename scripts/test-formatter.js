require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { formatSignals } = require("../src/utils/formatters");

// --- Configuration ---
// Get your token and chat ID from environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

// Sample data to test the formatter
const sampleSignals = {
  crypto: {
    "BTC/USDT": {
      signal: "BUY",
      price: 68000.123,
    },
    "ETH/USDT": {
        signal: "SELL",
        price: 3500.45,
    }
  },
  stocks: {
    "GC=F": {
      signal: "SELL",
      price: 2300.5,
    },
    NVDA: {
      signal: "BUY",
      price: 950.75,
    },
  },
};

// --- Main Function ---
async function testFormat() {
  if (!token || !chatId) {
    console.error(
      "❌ Error: Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your .env file."
    );
    process.exit(1);
  }

  console.log("🤖 Initializing Telegram Bot...");
  const bot = new TelegramBot(token);

  console.log("🎨 Formatting message...");
  const message = formatSignals(sampleSignals);

  console.log(`\n--- Generated Message ---`);
  console.log(message);
  console.log(`-------------------------\n`);


  try {
    console.log(`🚀 Sending message to Chat ID: ${chatId}...`);
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    console.log("✅ Message sent successfully!");
  } catch (error) {
    console.error("❌ Error sending message:", error.response.body.description);
  }
}

testFormat();
