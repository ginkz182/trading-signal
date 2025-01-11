const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

class NotificationService {
  constructor(config) {
    this.lineToken = config.lineToken;
    this.telegramToken = config.telegramToken;
    this.telegramChatId = config.telegramChatId;

    if (this.telegramToken && this.telegramChatId) {
      this.telegramBot = new TelegramBot(this.telegramToken, { polling: false });
    }
  }

  async sendToTelegram(message) {
    if (!this.telegramToken || !this.telegramChatId) {
      console.log('Telegram configuration missing');
      return;
    }

    try {
      await this.telegramBot.sendMessage(this.telegramChatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
  }

  async sendToLine(message) {
    if (!this.lineToken) {
      console.log('LINE token not configured');
      return;
    }

    try {
      await axios.post(
        'https://notify-api.line.me/api/notify',
        { message },
        {
          headers: {
            'Authorization': `Bearer ${this.lineToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (error) {
      console.error('Error sending LINE notification:', error);
    }
  }
}

module.exports = NotificationService;
