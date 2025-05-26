const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const SubscriberService = require("./subscriber.service");

class NotificationService {
  constructor(config) {
    this.telegramToken = config.telegramToken;

    // Initialize subscriber service
    this.subscriberService = new SubscriberService(config.subscriberConfig);

    if (this.telegramToken) {
      this.telegramBot = new TelegramBot(this.telegramToken, {
        polling: false,
      });
    }

    console.log("NotificationService initialized with subscriber support");
  }

  /**
   * Send message to a single chat ID
   * @param {string} chatId - Chat ID to send to
   * @param {string} message - Message to send
   */
  async sendToSingleChat(chatId, message) {
    if (!this.telegramToken) {
      console.log("Telegram token missing");
      return { success: false, error: "No token" };
    }

    try {
      await this.telegramBot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });

      console.log(`Message sent successfully to chat ${chatId}`);
      return { success: true, chatId };
    } catch (error) {
      console.error(`Error sending to chat ${chatId}:`, error.message);
      return { success: false, error: error.message, chatId };
    }
  }

  /**
   * Send message to all subscribers
   * @param {string} message - Message to send
   */
  async sendToTelegram(message) {
    if (!this.telegramToken) {
      console.log("Telegram configuration missing");
      return { success: false, error: "No token" };
    }

    const results = [];

    try {
      // Get all active subscribers
      const activeChatIds = await this.subscriberService.getActiveChatIds();
      console.log(`Sending to ${activeChatIds.length} active subscribers`);

      // Send to all active subscribers
      for (const chatId of activeChatIds) {
        const result = await this.sendToSingleChat(chatId, message);
        results.push(result);
      }
    } catch (error) {
      console.error("Error in sendToTelegram:", error);
      return { success: false, error: error.message };
    }

    // Summarize results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(
      `Sent to ${successful.length}/${results.length} chats successfully`
    );

    if (failed.length > 0) {
      console.error(
        "Failed chats:",
        failed.map((f) => f.chatId)
      );
    }

    return {
      success: successful.length > 0,
      totalChats: results.length,
      successfulChats: successful.length,
      failedChats: failed.length,
      results,
    };
  }

  /**
   * Get all active subscriber chat IDs
   */
  async getActiveChatIds() {
    const activeSubscribers =
      await this.subscriberService.getActiveSubscribers();
    return activeSubscribers.map((s) => s.chatId);
  }

  /**
   * Send broadcast message to all subscribers
   * @param {string} message - Broadcast message
   */
  async sendBroadcast(message) {
    const activeChatIds = await this.subscriberService.getActiveChatIds();
    const results = [];

    console.log(`Broadcasting to ${activeChatIds.length} subscribers`);

    for (const chatId of activeChatIds) {
      const result = await this.sendToSingleChat(chatId, message);
      results.push(result);
    }

    return results;
  }

  /**
   * Get statistics about subscribers
   */
  async getStats() {
    return await this.subscriberService.getStats();
  }
}

module.exports = NotificationService;
