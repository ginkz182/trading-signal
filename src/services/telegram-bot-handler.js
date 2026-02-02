/**
 * TelegramBotHandler - Simple version with basic commands
 */
const TelegramBot = require("node-telegram-bot-api");
const SubscriberService = require("./subscriber.service");
const config = require("../config");

class TelegramBotHandler {
  constructor(config = {}) {
    this.bot = new TelegramBot(config.token, {
      polling: {
        interval: 1000, // Poll every 1 second (default is 300ms)
        autoStart: true,
        params: {
          timeout: 10, // Long polling timeout in seconds
        },
      },
    });
    this.subscriberService = new SubscriberService(config.subscriberConfig);
    this.setupCommands();
    this.setupErrorHandling();
  }

  setupCommands() {
    // Start command - subscribe user
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const userInfo = msg.from;

      try {
        await this.subscriberService.subscribe(chatId, userInfo);

        const welcomeMessage = `
🚀 <b>Welcome to Trading Signals!</b>

You are now subscribed to receive FREE trading signals.

<b>Available Commands:</b>
/status - Check your subscription status
/stop - Unsubscribe from all signals
/assetlist - See the full list of assets we're tracking
/help - Show help message

You will receive all trading signals as they become available! 📊
        `;

        await this.bot.sendMessage(chatId, welcomeMessage, {
          parse_mode: "HTML",
        });
      } catch (error) {
        console.error("Error in /start command:", error);
        await this.bot.sendMessage(
          chatId,
          "Sorry, there was an error subscribing you. Please try again.",
        );
      }
    });

    // Stop command - unsubscribe user
    this.bot.onText(/\/stop/, async (msg) => {
      const chatId = msg.chat.id.toString();

      try {
        await this.subscriberService.unsubscribe(chatId);
        await this.bot.sendMessage(
          chatId,
          "✅ You have been unsubscribed from trading signals. Use /start to subscribe again.",
        );
      } catch (error) {
        console.error("Error in /stop command:", error);
        await this.bot.sendMessage(
          chatId,
          "Sorry, there was an error. Please try again.",
        );
      }
    });

    // Status command - show user's subscription status
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id.toString();

      try {
        const subscriber = await this.subscriberService.getSubscriber(chatId);

        if (!subscriber || !subscriber.subscribed) {
          await this.bot.sendMessage(
            chatId,
            "❌ You are not subscribed. Use /start to subscribe.",
          );
          return;
        }

        const tierName = subscriber.tier || "free";
        const tierConfig = config.tiers[tierName] ? tierName : "free";
        const capitalizedTier =
          tierConfig.charAt(0).toUpperCase() + tierConfig.slice(1);

        const tierMessage = `Signals: Receiving ${tierConfig.toUpperCase()} trading signals ${
          tierConfig === "free" ? "🚀" : "🌟"
        }`;

        const subscribedDate = subscriber.subscribed_at
          ? subscriber.subscribed_at.toLocaleDateString()
          : "Not available";

        const statusMessage = `
✅ <b>Subscription Status: Active</b>

<b>Subscribed since:</b> ${subscribedDate}
<b>Tier:</b> ${capitalizedTier} Tier
<b>${tierMessage}</b>
Use /stop to unsubscribe at any time.
        `;

        await this.bot.sendMessage(chatId, statusMessage, {
          parse_mode: "HTML",
        });
      } catch (error) {
        console.error("Error in /status command:", error);
        await this.bot.sendMessage(
          chatId,
          "Sorry, there was an error checking your status.",
        );
      }
    });

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      const helpMessage = `
<b>🤖 Trading Signals Bot Commands</b>

<b>Subscription:</b>
/start - Subscribe to trading signals
/stop - Unsubscribe from all signals
/status - Check your subscription status
/assetlist - See the full list of assets we're tracking
/help - Show this help message

<b>About:</b>
This bot sends you real-time trading signals for both cryptocurrency and stock markets. All signals are based on EMA crossover analysis.

Use /start to begin receiving signals! 🚀
      `;

      await this.bot.sendMessage(msg.chat.id, helpMessage, {
        parse_mode: "HTML",
      });
    });

    // Asset list command
    this.bot.onText(/\/assetlist/, async (msg) => {
      const cryptoAssets = config.symbols.join("\n");
      const stockAssets = config.stockSymbols.join("\n");

      const assetListMessage = `
<b>Current Asset List</b>

<b>Crypto Assets:</b>
${cryptoAssets}

<b>Stock Assets:</b>
${stockAssets}
      `;

      await this.bot.sendMessage(msg.chat.id, assetListMessage, {
        parse_mode: "HTML",
      });
    });

    console.log("Telegram bot commands set up successfully");
  }

  setupErrorHandling() {
    let retryCount = 0;
    let retryTimeout = null;

    this.bot.on("polling_error", (error) => {
      console.error("Telegram polling error:", error);

      // Handle rate limiting (429)
      if (error.response && error.response.statusCode === 429) {
        const retryAfter = error.response.body?.parameters?.retry_after || 5;
        retryCount++;

        console.log(
          `[TELEGRAM] Rate limited. Retrying after ${retryAfter}s (attempt ${retryCount})`,
        );

        // Stop polling temporarily
        this.bot.stopPolling();

        // Clear any existing retry timeout
        if (retryTimeout) clearTimeout(retryTimeout);

        // Restart polling after the specified delay
        retryTimeout = setTimeout(() => {
          console.log("[TELEGRAM] Resuming polling...");
          this.bot.startPolling();
          retryCount = 0;
        }, retryAfter * 1000);
      }
      // Handle connection errors (ECONNRESET, etc.)
      else if (error.code === "EFATAL" || error.code === "ECONNRESET") {
        retryCount++;
        const backoffDelay = Math.min(
          1000 * Math.pow(2, retryCount - 1),
          30000,
        ); // Max 30s

        console.log(
          `[TELEGRAM] Connection error. Retrying in ${backoffDelay / 1000}s (attempt ${retryCount})`,
        );

        this.bot.stopPolling();

        if (retryTimeout) clearTimeout(retryTimeout);

        retryTimeout = setTimeout(() => {
          console.log("[TELEGRAM] Resuming polling...");
          this.bot.startPolling();
          if (retryCount > 3) retryCount = 0; // Reset after successful reconnect attempts
        }, backoffDelay);
      }
    });

    // Reset retry count on successful polling
    this.bot.on("message", () => {
      if (retryCount > 0) {
        console.log("[TELEGRAM] Connection restored");
        retryCount = 0;
      }
    });
  }

  /**
   * Send message to specific chat IDs
   * @param {Array} chatIds - Array of chat IDs
   * @param {string} message - Message to send
   */
  async sendToChats(chatIds, message) {
    const results = [];
    const BATCH_DELAY = 100; // 100ms delay between messages to avoid rate limits

    for (const chatId of chatIds) {
      try {
        await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
        results.push({ chatId, success: true });
        console.log(`Message sent to ${chatId}`);

        // Add delay between messages to respect Telegram rate limits
        if (chatIds.indexOf(chatId) < chatIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
        }
      } catch (error) {
        console.error(`Failed to send to ${chatId}:`, error.message);
        results.push({ chatId, success: false, error: error.message });

        // If rate limited, wait longer before next message
        if (error.response && error.response.statusCode === 429) {
          const retryAfter = error.response.body?.parameters?.retry_after || 5;
          console.log(`[TELEGRAM] Rate limited, waiting ${retryAfter}s...`);
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
        }
      }
    }

    return results;
  }

  /**
   * Get subscriber service for external use
   */
  getSubscriberService() {
    return this.subscriberService;
  }
}

module.exports = TelegramBotHandler;
