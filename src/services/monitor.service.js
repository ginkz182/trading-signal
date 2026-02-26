const NotificationService = require("./notification.service");

class MonitorService {
  /**
   * @param {NotificationService} notificationService
   * @param {string} adminChatId
   */
  constructor(notificationService, adminChatId) {
    this.notificationService = notificationService;
    this.adminChatId = adminChatId;
  }

  /**
   * Notifies when a new user starts the bot.
   * @param {object} user - The user object from the Telegram update.
   */
  async notifyNewUser(user) {
    if (!this.adminChatId) return;

    const message = `
      <strong>ADMIN NOTIFY: New User Alert</strong>
      <pre>
      ID: ${user.id}
      Name: ${user.first_name} ${user.last_name || ""}
      Username: @${user.username || "N/A"}
      </pre>
    `;
    await this.notificationService.sendToSingleChat(this.adminChatId, message.trim());
  }

  /**
   * Notifies when a user's subscription tier changes.
   * @param {string} chatId - The user's chat ID.
   * @param {string} newTier - The new subscription tier.
   */
  async notifySubscriptionChange(chatId, newTier) {
    if (!this.adminChatId) return;

    const message = `
      <strong>Subscription Change</strong>
      <pre>
      Chat ID: ${chatId}
      New Tier: ${newTier}
      </pre>
    `;
    await this.notificationService.sendToSingleChat(this.adminChatId, message.trim());
  }

  /**
   * Notifies about the status of a scheduled cron job.
   * @param {boolean} success - Whether the job was successful.
   * @param {string} jobName - The name of the cron job.
   * @param {Error} [error] - The error object if the job failed.
   */
  async notifyCronRunStatus(success, jobName, error = null) {
    if (!this.adminChatId) return;

    let message;
    if (success) {
      message = `
        <strong>Cron Job Success</strong>
        <pre>
        Job: ${jobName}
        Time: ${new Date().toUTCString()}
        </pre>
      `;
    } else {
      message = `
        <strong>Cron Job FAILED</strong>
        <pre>
        Job: ${jobName}
        Time: ${new Date().toUTCString()}
        Error: ${error ? error.message : "Unknown error"}
        </pre>
        ${error && error.stack ? `<pre>${error.stack}</pre>` : ""}
      `;
    }
    await this.notificationService.sendToSingleChat(this.adminChatId, message.trim());
  }

  /**
   * Notifies about a successful payment or renewal.
   */
  async notifyPaymentSuccess(chatId, amount, currency, planType) {
    if (!this.adminChatId) return;
    const message = `
      <strong>ADMIN NOTIFY: Payment Success</strong>
      <pre>
      Chat ID: ${chatId}
      Plan: ${planType}
      Amount: ${amount} ${currency.toUpperCase()}
      </pre>
    `;
    await this.notificationService.sendToSingleChat(this.adminChatId, message.trim());
  }

  /**
   * Notifies when a user cancels their subscription.
   */
  async notifySubscriptionCancelled(chatId, reason) {
    if (!this.adminChatId) return;
    const message = `
      <strong>ADMIN NOTIFY: Subscription Cancelled</strong>
      <pre>
      Chat ID: ${chatId}
      Reason: ${reason}
      </pre>
    `;
    await this.notificationService.sendToSingleChat(this.adminChatId, message.trim());
  }
}

module.exports = MonitorService;
