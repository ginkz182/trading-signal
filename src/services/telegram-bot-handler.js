/**
 * TelegramBotHandler - Simple version with basic commands
 */
const TelegramBot = require("node-telegram-bot-api");
const SubscriberService = require("./subscriber.service");

class TelegramBotHandler {
  constructor(config = {}) {
    this.bot = new TelegramBot(config.token, { polling: true });
    this.subscriberService = new SubscriberService(config.subscriberConfig);
    this.setupCommands();
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

You are now subscribed to receive trading signals.

<b>Available Commands:</b>
/status - Check your subscription status
/stop - Unsubscribe from all signals
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
          "Sorry, there was an error subscribing you. Please try again."
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
          "✅ You have been unsubscribed from trading signals. Use /start to subscribe again."
        );
      } catch (error) {
        console.error("Error in /stop command:", error);
        await this.bot.sendMessage(
          chatId,
          "Sorry, there was an error. Please try again."
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
            "❌ You are not subscribed. Use /start to subscribe."
          );
          return;
        }

        const statusMessage = `
✅ <b>Subscription Status: Active</b>

<b>Subscribed since:</b> ${new Date(
          subscriber.subscribedAt
        ).toLocaleDateString()}
<b>Signals:</b> Receiving ALL trading signals 🌟

Use /stop to unsubscribe at any time.
        `;

        await this.bot.sendMessage(chatId, statusMessage, {
          parse_mode: "HTML",
        });
      } catch (error) {
        console.error("Error in /status command:", error);
        await this.bot.sendMessage(
          chatId,
          "Sorry, there was an error checking your status."
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
/help - Show this help message

<b>About:</b>
This bot sends you real-time trading signals for both cryptocurrency and stock markets. All signals are based on EMA crossover analysis.

Use /start to begin receiving signals! 🚀
      `;

      await this.bot.sendMessage(msg.chat.id, helpMessage, {
        parse_mode: "HTML",
      });
    });

    // Handle errors
    this.bot.on("polling_error", (error) => {
      console.error("Telegram polling error:", error);
    });

    console.log("Telegram bot commands set up successfully");
  }

  /**
   * Send message to specific chat IDs
   * @param {Array} chatIds - Array of chat IDs
   * @param {string} message - Message to send
   */
  async sendToChats(chatIds, message) {
    const results = [];

    for (const chatId of chatIds) {
      try {
        await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
        results.push({ chatId, success: true });
        console.log(`Message sent to ${chatId}`);
      } catch (error) {
        console.error(`Failed to send to ${chatId}:`, error.message);
        results.push({ chatId, success: false, error: error.message });
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
