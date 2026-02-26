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
   * Send personalized signals to all subscribers
   * @param {Object} signals - The full signals object { crypto: {}, stocks: {} }
   */
  async sendSignalsToSubscribers(signals) {
    if (!this.telegramToken) {
      console.log("Telegram configuration missing");
      return { success: false, error: "No token" };
    }

    const { formatSignals } = require("../utils/formatters");
    const defaultAssets = require("../config").symbols; // fallback/default

    // Get all active subscribers with their tier info
    const activeSubscribers = await this.subscriberService.getActiveSubscribers();
    console.log(`Processing signals for ${activeSubscribers.length} subscribers...`);

    const results = [];

    for (const subscriber of activeSubscribers) {
        // Fetch user's assets
        let userAssets = await this.subscriberService.getActiveAssets(subscriber.chat_id, subscriber.tier);
        
        // Filter signals for this user
        const userSignals = {
            crypto: {},
            stocks: {} // Stocks not fully implemented in user_assets yet, assuming all or none, or we can add stock support later. 
                       // For now, let's assume user_assets contains both crypto and stock symbols if we want.
                       // But the current migration was VARCHAR(20), enough for stocks too.
                       // However, the current system separates them. 
                       // Let's filter both.
        };

        let hasUserSignals = false;

        // Filter Crypto
        for (const [symbol, signalData] of Object.entries(signals.crypto || {})) {
            if (userAssets.includes(symbol)) {
                userSignals.crypto[symbol] = signalData;
                hasUserSignals = true;
            }
        }

        // Filter Stocks (if any)
        for (const [symbol, signalData] of Object.entries(signals.stocks || {})) {
            if (userAssets.includes(symbol)) {
                userSignals.stocks[symbol] = signalData;
                hasUserSignals = true;
            }
        }

        if (hasUserSignals) {
            const message = formatSignals(userSignals, {
                signalSource: "YESTERDAY",
                // You could add user's name here if you want personalization
            });

            const result = await this.sendToSingleChat(subscriber.chat_id, message);
            results.push(result);
        }
    }
    
    // Summarize results
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(
      `Personalized signals sent to ${successful.length} chats`
    );

    return {
      success: successful.length > 0,
      totalSent: results.length,
      successful,
      failed
    };
  }

  /**
   * Send message to all subscribers (Broadcast)
   * @param {string} message - Message to send
   */
  async sendToTelegram(message) {
    // ... existing broadcast logic ...
    if (!this.telegramToken) {
      console.log("Telegram configuration missing");
      return { success: false, error: "No token" };
    }

    const results = [];

    try {
      // Get all active subscribers
      const activeChatIds = await this.subscriberService.getActiveChatIds();
      console.log(`Sending broadcast to ${activeChatIds.length} active subscribers`);

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
    return activeSubscribers.map((s) => s.chat_id); // Note: it's chat_id in DB, ensure accessor is correct
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
