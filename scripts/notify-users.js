require("dotenv").config();
const { Client } = require("pg");
const TelegramBot = require("node-telegram-bot-api");

const aDayInMilliseconds = 24 * 60 * 60 * 1000;

// --- Configuration ---
const MESSAGE_TEXT = `
Hello! We've moved to a new and improved bot! 🚀

Please start a conversation with our new bot to continue receiving signals: @PurrrfectSignal_bot

This old bot will be discontinued soon.
`;

// const aWeekAgo = () => new Date(Date.now() - 7 * aDayInMilliseconds);

// --- Main Function ---
const notifyUsers = async () => {
  // 1. Validate environment variables
  if (!process.env.DATABASE_URL || !process.env.TELEGRAM_BOT_TOKEN) {
    console.error(
      "❌ Error: DATABASE_URL and TELEGRAM_BOT_TOKEN must be set in your .env file.",
    );
    process.exit(1);
  }

  // 2. Initialize Database and Telegram Bot
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

  try {
    // 3. Connect to the database
    await dbClient.connect();
    console.log("✅ Connected to the database.");

    // 4. Fetch subscribers
    const BATCH_SIZE = 100;
    let offset = 0;
    let subscribers = [];

    while (true) {
      const result = await dbClient.query(
        "SELECT chat_id FROM subscribers LIMIT $1 OFFSET $2",
        [BATCH_SIZE, offset],
      );

      if (result.rows.length === 0) break;

      subscribers = subscribers.concat(result.rows);
      offset += BATCH_SIZE;
    }

    console.log(`📢 Found ${subscribers.length} active subscribers to notify.`);

    // 5. Send notifications
    const notificationPromises = subscribers.map(({ chat_id }) =>
      bot
        .sendMessage(chat_id, MESSAGE_TEXT, { parse_mode: "HTML" })
        .then(() => ({ chat_id, status: "fulfilled" }))
        .catch((error) => ({
          chat_id,
          status: "rejected",
          reason: error.message,
        })),
    );

    const results = await Promise.all(notificationPromises);

    // 6. Log results
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.length - successCount;

    console.log(`\n--- Notification Complete ---`);
    console.log(`✅ Successfully sent: ${successCount}`);
    console.log(`❌ Failed or blocked: ${failedCount}`);
    console.log(`--------------------------\n`);
  } catch (error) {
    console.error("❌ An unexpected error occurred:", error);
  } finally {
    // 7. Close the database connection
    await dbClient.end();
    console.log("🚪 Database connection closed.");
  }
};

// --- Execute Script ---
notifyUsers();
