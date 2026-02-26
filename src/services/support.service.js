const messages = require("../config/messages");
const config = require("../config");

class SupportService {
  constructor({ bot, pool }) {
    this.bot = bot;
    this.pool = pool;
  }

  /**
   * Handles user support requests.
   * Format: /support <message>
   */
  async handleSupport(msg, match) {
    const chatId = msg.chat.id.toString();
    const supportMessage = match[1] ? match[1].trim() : null;

    if (!supportMessage) {
      return this.bot.sendMessage(
        chatId,
        "❌ <b>Usage:</b> <code>/support &lt;your message&gt;</code>",
        { parse_mode: "HTML" }
      );
    }

    try {
      // 1. Insert request into the database
      if (this.pool) {
          await this.pool.query(
              `INSERT INTO support_requests (chat_id, message, status) VALUES ($1, $2, 'open')`,
              [chatId, supportMessage]
          );
      } else {
          console.warn("SupportService: No database pool provided, skipping DB insertion.");
      }

      // 2. Notify the user that message was received
      await this.bot.sendMessage(chatId, messages.supportReceived, {
        parse_mode: "HTML",
      });

      // 3. Notify the Admin
      const adminChatId = config.telegram.adminChatId || process.env.ADMIN_CHAT_ID;
      if (adminChatId) {
        const name = msg.from.first_name || msg.from.username || "User";
        const adminMsg = messages.supportAdminNotify(name, chatId, supportMessage);
        
        await this.bot.sendMessage(adminChatId, adminMsg, {
          parse_mode: "HTML",
        });
      } else {
        console.warn("ADMIN_CHAT_ID is not configured. Support message not delivered to admin.");
      }
    } catch (e) {
      console.error("/support error:", e);
      await this.bot.sendMessage(chatId, messages.errorGeneric);
    }
  }

  /**
   * Handles admin replies to specific users.
   * Format: /reply <chat_id> <message>
   */
  async handleReply(msg, match) {
    const senderChatId = msg.chat.id.toString();
    const adminChatId = config.telegram.adminChatId || process.env.ADMIN_CHAT_ID;

    // Security Check: Only the designated admin can use this command
    if (!adminChatId || senderChatId !== adminChatId) {
      return; // Silently ignore or return 
    }

    const payload = match[1] ? match[1].trim() : null;

    if (!payload) {
      return this.bot.sendMessage(senderChatId, messages.replySyntaxError, {
        parse_mode: "HTML",
      });
    }

    // Attempt to split the payload by the first space to get the target chat ID and the message
    const firstSpaceIndex = payload.indexOf(" ");
    if (firstSpaceIndex === -1) {
      // Means there is a target ID but no message provided
      return this.bot.sendMessage(senderChatId, messages.replySyntaxError, {
        parse_mode: "HTML",
      });
    }

    const targetChatId = payload.substring(0, firstSpaceIndex).trim();
    const replyMessage = payload.substring(firstSpaceIndex + 1).trim();

    if (!targetChatId || !replyMessage) {
      return this.bot.sendMessage(senderChatId, messages.replySyntaxError, {
        parse_mode: "HTML",
      });
    }

    try {
      // 1. Send the message to the target user
      const userMsg = messages.replyUserMessage(replyMessage);
      await this.bot.sendMessage(targetChatId, userMsg, {
        parse_mode: "HTML",
      });

      // 2. Confirm to the admin that the message was sent
      await this.bot.sendMessage(senderChatId, messages.replyAdminConfirm(targetChatId), {
        parse_mode: "HTML",
      });
    } catch (e) {
        console.error("/reply error:", e);
        // Let the admin know it failed
        let errorMsg = `❌ <b>Failed to send reply to ${targetChatId}</b>\n\n`;
        // Check if the error is from telegram api (e.g. user blocked bot)
        if (e.response && e.response.body && e.response.body.description) {
            errorMsg += e.response.body.description;
        } else {
            errorMsg += e.message;
        }
        await this.bot.sendMessage(senderChatId, errorMsg, { parse_mode: "HTML" });
    }
  }
}

module.exports = SupportService;
