/**
 * TelegramBotHandler - Simple version with basic commands
 */
const TelegramBot = require("node-telegram-bot-api");
const dayjs = require("dayjs");
const config = require("../config");

const { requireTier, sendPlanMenu } = require("../middleware/auth.middleware");
const ValidationService = require("./validation.service");
const BacktestService = require("./backtest.service");
const SupportService = require("./support.service");
const messages = require("../config/messages");

class TelegramBotHandler {
  constructor({ token, subscriberService, monitorService, paymentService }) {
    this.bot = new TelegramBot(token, {
        polling: {
          interval: 1000, 
          autoStart: true,
          params: { timeout: 10 },
        },
      });
    this.subscriberService = subscriberService;
    this.monitorService = monitorService;
    this.paymentService = paymentService;
    this.validationService = new ValidationService();
    this.backtestService = new BacktestService({ subscriberService });
    this.supportService = new SupportService({ bot: this.bot, pool: this.subscriberService?.pool });
    
    this.services = {
        subscriberService: this.subscriberService,
        paymentService: this.paymentService,
        bot: this.bot
    };
    
    this.setupCommands();
    this.setupErrorHandling();
  }

  setupCommands() {
    // Clean, readable command registry
    this.bot.onText(/^\/start(?:@[^\s]+)?$/, (msg) => this._handleStart(msg));
    this.bot.onText(/^\/stop(?:@[^\s]+)?$/, (msg) => this._handleStop(msg));
    this.bot.onText(/^\/status(?:@[^\s]+)?$/, (msg) => this._handleStatus(msg));
    this.bot.onText(/^\/help(?:@[^\s]+)?$/, (msg) => this._handleHelp(msg));
    
    // Tier-protected commands
    this.bot.onText(/^\/assetlist(?:@[^\s]+)?/, requireTier('free', (msg) => this._handleAssetList(msg), this.services));
    
    // Payment / Subscription
    this.bot.onText(/^\/plans(?:@[^\s]+)?\s*(.*)?/, (msg, match) => this._handlePlans(msg, match));
    this.bot.onText(/^\/upgrade(?:@[^\s]+)?\s*(.*)?/, (msg, match) => this._handlePlans(msg, match));
    this.bot.onText(/^\/cancel(?:@[^\s]+)?$/, (msg) => this._handleCancel(msg));
    this.bot.on('callback_query', (query) => this._handlePaymentCallback(query));

    // Asset Management
    this.bot.onText(/^\/add(?:@[^\s]+)?\s+(.+)/, requireTier('premium', (msg, match) => this._handleSubscribeAsset(msg, match), this.services));
    this.bot.onText(/^\/remove(?:@[^\s]+)?\s+(.+)/, requireTier('premium', (msg, match) => this._handleUnsubscribeAsset(msg, match), this.services));
    this.bot.onText(/^\/request(?:@[^\s]+)?\s+(.+)/, (msg, match) => this._handleRequestAsset(msg, match));

    // Backtest (Premium with limit)
    this.bot.onText(/^\/backtest(?:@[^\s]+)?(?:\s+(.+))?/, requireTier('premium', (msg, match) => this._handleBacktest(msg, match), this.services));

    // Admin / Test
    this.bot.onText(/\/admin_add_sub (\S+) (\S+) (\d+)/, requireTier('admin', (msg, match) => this._handleAdminAddSub(msg, match), this.services));
    this.bot.onText(/\/test_upgrade (\S+)/, (msg, match) => this._handleTestUpgrade(msg, match));
    this.bot.onText(/\/test_broadcast/, requireTier('admin', (msg) => this._handleTestBroadcast(msg), this.services));

    // Support System
    this.bot.onText(/^\/support(?:@[^\s]+)?(?:\s+(.*))?/su, (msg, match) => this.supportService.handleSupport(msg, match));
    this.bot.onText(/^\/reply(?:@[^\s]+)?(?:\s+(.*))?/su, requireTier('admin', (msg, match) => this.supportService.handleReply(msg, match), this.services));

    console.log("Telegram bot commands set up successfully");
  }

  // --- Command Handlers ---

  async _handleStart(msg) {
    const chatId = msg.chat.id.toString();
    try {
      await this.subscriberService.subscribe(chatId, msg.from);
      if (this.monitorService) await this.monitorService.notifyNewUser(msg.from);
      await this.bot.sendMessage(chatId, messages.welcome, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Error in /start:", error);
      await this.bot.sendMessage(chatId, messages.errorGeneric);
    }
  }

  async _handleStop(msg) {
    const chatId = msg.chat.id.toString();
    try {
      await this.subscriberService.unsubscribe(chatId);
      await this.bot.sendMessage(chatId, messages.unsubscribeSuccess);
    } catch (error) {
      console.error("Error in /stop:", error);
      await this.bot.sendMessage(chatId, messages.errorGeneric);
    }
  }

  async _handleStatus(msg) {
    const chatId = msg.chat.id.toString();
    try {
      const subscriber = await this.subscriberService.getSubscriber(chatId);
      if (!subscriber || !subscriber.subscribed) {
        return this.bot.sendMessage(chatId, messages.notSubscribed);
      }

      const tierName = subscriber.tier || "free";
      const tierConfig = config.tiers[tierName];
      const tierDisplay = tierConfig ? tierConfig.displayName.toUpperCase() : tierName.toUpperCase();
      
      const date = subscriber.subscribed_at ? dayjs(subscriber.subscribed_at).format('DD MMM YYYY') : "N/A";
      let expiry = "";
      
      if (subscriber.subscription_end_at) {
          expiry = `\n<b>Expires:</b> ${dayjs(subscriber.subscription_end_at).format('DD MMM YYYY')}`;
      } else if (tierName !== 'free') {
          expiry = `\n<b>Expires:</b> Lifetime/Indefinite`;
      }

      const autoRenew = tierName !== 'free'
          ? (subscriber.is_auto_renewal ? '\n<b>Auto-Renew:</b> ✅ Active (Credit Card)' : '\n<b>Auto-Renew:</b> ❌ Manual (One-time/PromptPay)')
          : '';

      await this.bot.sendMessage(chatId, messages.statusActive(date, tierDisplay, expiry, autoRenew), { parse_mode: "HTML" });
    } catch (error) {
       console.error("Error in /status:", error);
       await this.bot.sendMessage(chatId, messages.errorGeneric);
    }
  }

  async _handleHelp(msg) {
      await this.bot.sendMessage(msg.chat.id, messages.help, { parse_mode: "HTML" });
  }

  async _handleAssetList(msg) {
    const chatId = msg.chat.id.toString();
    try {
      const subscriber = await this.subscriberService.getSubscriber(chatId);
      let tier = subscriber ? subscriber.tier : 'free';
      if (msg.isAdminOverride) tier = 'admin';
      const assets = await this.subscriberService.getActiveAssetsWithTypes(chatId, tier);
      let text = messages.assetListHeader(0); // Count not used in header template currently
      
      if (!assets.isCustom) text += messages.assetListDefault;
      text += `\n`;

      if (assets.crypto.length > 0) {
          assets.crypto.sort((a, b) => a.localeCompare(b));
          text += `<b>🪙 Crypto (${assets.crypto.length})</b>\n<code>${assets.crypto.join('\n')}</code>\n\n`;
      }
      if (assets.stocks.length > 0) {
          assets.stocks.sort((a, b) => a.localeCompare(b));
          text += `<b>📈 Stocks (${assets.stocks.length})</b>\n<code>${assets.stocks.join('\n')}</code>\n\n`;
      }
      if (assets.crypto.length === 0 && assets.stocks.length === 0) {
          text += messages.assetListEmpty;
      }
      
      await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error("/assetlist error:", e);
      await this.bot.sendMessage(chatId, messages.assetListError);
    }
  }

  async _handleSubscribeAsset(msg, match) {
      const chatId = msg.chat.id.toString();
      const rawSymbol = match[1].trim();

      if (rawSymbol.length > 20) return this.bot.sendMessage(chatId, messages.invalidSymbol);

      try {
          await this.bot.sendChatAction(chatId, 'typing');
          const validation = await this.validationService.validate(rawSymbol);

          if (!validation.isValid) {
              return this.bot.sendMessage(chatId, messages.assetNotFound(rawSymbol), { parse_mode: 'HTML' });
          }

          const subscriber = await this.subscriberService.getSubscriber(chatId);
          let tier = subscriber ? subscriber.tier : 'free';
          if (msg.isAdminOverride) tier = 'admin';

          const result = await this.subscriberService.subscribeAsset(chatId, validation.formattedSymbol, validation.type, tier);
          
          if (result.status === 'exists') {
              return this.bot.sendMessage(chatId, messages.assetExists(validation.formattedSymbol), { parse_mode: 'HTML' });
          }

          const icon = validation.type === 'stock' ? '📈' : '🪙';
          await this.bot.sendMessage(chatId, messages.assetAdded(validation.formattedSymbol, validation.type, icon), { parse_mode: 'HTML' });
      } catch (e) {
          console.error("/subscribe error:", e);
          await this.bot.sendMessage(chatId, messages.errorGeneric);
      }
  }

  async _handleUnsubscribeAsset(msg, match) {
    const chatId = msg.chat.id.toString();
    const rawSymbol = match[1].trim();
    const upperSymbol = rawSymbol.toUpperCase();

    try {
        const subscriber = await this.subscriberService.getSubscriber(chatId);
        let tier = subscriber ? subscriber.tier : 'free';
        if (msg.isAdminOverride) tier = 'admin';
        const userAssets = await this.subscriberService.getActiveAssets(chatId, tier);
        let targetSymbol = null;

        if (userAssets.includes(rawSymbol)) targetSymbol = rawSymbol;
        else if (userAssets.includes(upperSymbol)) targetSymbol = upperSymbol;

        if (!targetSymbol && !upperSymbol.includes('/')) {
            const cryptoSymbol = `${upperSymbol}/USDT`;
            if (userAssets.includes(cryptoSymbol)) targetSymbol = cryptoSymbol;
        }

        if (!targetSymbol) {
            return this.bot.sendMessage(chatId, messages.assetRemoveNotFound(rawSymbol), { parse_mode: 'HTML' });
        }

        await this.subscriberService.unsubscribeAsset(chatId, targetSymbol, tier);
        await this.bot.sendMessage(chatId, messages.assetRemoveSuccess(targetSymbol), { parse_mode: 'HTML' });
    } catch (e) {
        console.error("/unsubscribe error:", e);
        await this.bot.sendMessage(chatId, messages.errorGeneric);
    }
  }

  async _handleRequestAsset(msg, match) {
      const chatId = msg.chat.id.toString();
      const symbol = match[1].trim().toUpperCase();
      try {
          await this.bot.sendChatAction(chatId, 'typing');
          await this.subscriberService.pool.query(
              `INSERT INTO requested_assets (chat_id, symbol, status) VALUES ($1, $2, 'pending')`,
              [chatId, symbol]
          );
          
          if (process.env.ADMIN_CHAT_ID) {
              const username = msg.from.username ? `@${msg.from.username}` : `ID: ${chatId}`;
              await this.bot.sendMessage(process.env.ADMIN_CHAT_ID, messages.requestAdminNotify(username, symbol), { parse_mode: 'HTML' });
          }
          await this.bot.sendMessage(chatId, messages.requestReceived(symbol), { parse_mode: 'HTML' });
      } catch (e) {
          console.error("/request error:", e);
          await this.bot.sendMessage(chatId, messages.errorGeneric);
      }
  }

  async _handlePaymentCallback(callbackQuery) {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      await this.bot.answerCallbackQuery(callbackQuery.id);

      if (data === 'pay_card' || data === 'pay_qr' || data === 'pay_card_promo' || data === 'pay_qr_promo') {
          if (!this.services.paymentService) return this.bot.sendMessage(chatId, messages.paymentServiceUnavailable);

          const isPromo = data.includes('_promo');
          const mode = data.startsWith('pay_card') ? 'subscription' : 'payment';
          const planType = isPromo ? 'premium_monthly_promo' : 'premium_monthly';
          const subscriber = await this.subscriberService.getSubscriber(chatId);
          const isResident = subscriber && subscriber.tier === 'premium';
          const hasActiveSub = subscriber && subscriber.subscription_end_at && new Date(subscriber.subscription_end_at) > new Date();

          let msgPrefix = "";
          if (isResident && hasActiveSub) {
              msgPrefix = messages.activeSubscriptionFound(dayjs(subscriber.subscription_end_at).format('DD MMM YYYY'));
          }

          const loadingMsg = await this.bot.sendMessage(chatId, messages.paymentLinkLoading(msgPrefix), { parse_mode: 'HTML' });

          // Remove buttons from the original plan menu message
          try {
              await this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                  chat_id: chatId,
                  message_id: callbackQuery.message.message_id,
              });
          } catch (_) { /* ignore if already edited */ }

          try {
              const url = await this.services.paymentService.createCheckoutSession(chatId, planType, mode);
              await this.bot.editMessageText(messages.paymentLinkReady(url), {
                  chat_id: chatId,
                  message_id: loadingMsg.message_id,
                  parse_mode: 'HTML',
                  disable_web_page_preview: true
              });
          } catch (err) {
              console.error("Payment Link Error:", err);
              await this.bot.editMessageText(messages.paymentLinkFailed, {
                  chat_id: chatId,
                  message_id: loadingMsg.message_id
              });
          }
      } else if (data === 'cancel_confirm') {
          if (!this.services.paymentService) return this.bot.sendMessage(chatId, messages.paymentServiceUnavailable);
          try {
              const result = await this.services.paymentService.cancelSubscription(chatId.toString());
              if (result.cancelled) {
                  await this.bot.editMessageText(messages.cancelSuccess(result.expiryDate), {
                      chat_id: chatId,
                      message_id: callbackQuery.message.message_id,
                      parse_mode: 'HTML',
                  });
              } else {
                  const cancelMsg = result.reason === 'not_recurring' ? messages.cancelNotRecurring : messages.cancelNoSubscription;
                  await this.bot.editMessageText(cancelMsg, {
                      chat_id: chatId,
                      message_id: callbackQuery.message.message_id,
                      parse_mode: 'HTML',
                  });
              }
          } catch (err) {
              console.error('Cancel error:', err);
              await this.bot.sendMessage(chatId, '⚠️ Failed to cancel. Please try again.');
          }
      } else if (data === 'cancel_abort') {
          await this.bot.editMessageText('👍 Cancellation aborted. Your subscription remains active.', {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id,
              parse_mode: 'HTML',
          });
      }
  }


  async _handleCancel(msg) {
    const chatId = msg.chat.id.toString();
    await this.bot.sendMessage(chatId, messages.cancelConfirm, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Yes, cancel auto-renewal', callback_data: 'cancel_confirm' }],
          [{ text: '✅ No, keep my subscription', callback_data: 'cancel_abort' }],
        ],
      },
    });
  }

  async _handleAdminAddSub(msg, match) {
      const adminChatId = msg.chat.id.toString();
      const targetChatId = match[1];
      const tier = match[2].toLowerCase();
      const days = parseInt(match[3]);

      try {
          const result = await this.subscriberService.updateSubscription(targetChatId, tier, days, `admin_${adminChatId}`);
          const dateStr = result.expiresAt ? result.expiresAt.toLocaleDateString() : 'Never';
          await this.bot.sendMessage(adminChatId, messages.adminSubUpdated(targetChatId, result.newTier, dateStr), { parse_mode: 'HTML' });

          try {
              await this.bot.sendMessage(targetChatId, messages.userSubUpdated(tier.toUpperCase(), days), { parse_mode: 'HTML' });
          } catch (notifyError) {
              console.warn(`Notify failed for ${targetChatId}`);
              await this.bot.sendMessage(adminChatId, "⚠️ User updated, but notification failed.");
          }
      } catch (e) {
          await this.bot.sendMessage(adminChatId, `❌ Failed: ${e.message}`);
      }
  }

  async _handleTestUpgrade(msg, match) {
      if (process.env.NODE_ENV === 'production') return;
      const chatId = msg.chat.id.toString();
      const tier = match[1].toLowerCase();
      try {
          await this.subscriberService.updateSubscription(chatId, tier, 7, 'test_command');
          await this.bot.sendMessage(chatId, messages.testUpgrade(tier.toUpperCase()), { parse_mode: 'HTML' });
      } catch (e) {
          await this.bot.sendMessage(chatId, `Error: ${e.message}`);
      }
  }

  async _handleTestBroadcast(msg) {
      const chatId = msg.chat.id.toString();
      const mockSignals = {
          crypto: {
              'BTC/USDT': { signal: 'BUY', price: 95000.50, previousDayPrice: 92000.00, isBull: true, isBear: false, details: 'Strong breakout', dataSource: 'MOCK' },
              'ETH/USDT': { signal: 'SELL', price: 2800.00, previousDayPrice: 2950.00, isBull: false, isBear: true, details: 'Divergence', dataSource: 'MOCK' }
          },
          stocks: {
              'AAPL': { signal: 'BUY', price: 185.50, previousDayPrice: 180.00, isBull: true, isBear: false, details: 'Golden Cross', dataSource: 'MOCK' },
              'TSLA': { signal: 'SELL', price: 170.20, previousDayPrice: 175.00, isBull: false, isBear: true, details: 'Support break', dataSource: 'MOCK' }
          }
      };

      try {
          await this.bot.sendMessage(chatId, messages.testBroadcastStart, { parse_mode: 'HTML' });
          if (this.monitorService && this.monitorService.notificationService) {
               const result = await this.monitorService.notificationService.sendSignalsToSubscribers(mockSignals);
               await this.bot.sendMessage(chatId, messages.testBroadcastComplete(result.totalSent), { parse_mode: 'HTML' });
          } else {
               await this.bot.sendMessage(chatId, messages.testBroadcastError);
          }
      } catch (e) {
          console.error("Mock Broadcast Error:", e);
          await this.bot.sendMessage(chatId, `❌ Error: ${e.message}`);
      }
  }

  async _handlePlans(msg, match) {
    const chatId = msg.chat.id.toString();

    try {
      const subscriber = await this.subscriberService.getSubscriber(chatId);
      const userTier = subscriber?.tier || 'free';

      if (userTier === 'pro') {
        return this.bot.sendMessage(chatId, messages.planMenuMaxTier, { parse_mode: 'HTML' });
      }

      // Block if already on auto-renewal to prevent duplicate subscriptions
      if (userTier !== 'free' && subscriber?.is_auto_renewal) {
        const expires = subscriber?.subscription_end_at
          ? dayjs(subscriber.subscription_end_at).format('DD MMM YYYY')
          : null;
        return this.bot.sendMessage(chatId, messages.planMenuAutoRenewActive(expires), { parse_mode: 'HTML' });
      }

      const paymentButtons = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Credit Card (Auto-Renew)', callback_data: 'pay_card' }],
            [{ text: '🏦 Thai QR / PromptPay (1 Month)', callback_data: 'pay_qr' }],
          ],
        },
      };

      if (userTier === 'premium') {
        // Premium users: show "already subscribed" with extend option
        const expires = subscriber?.subscription_end_at
          ? dayjs(subscriber.subscription_end_at).format('DD MMM YYYY')
          : null;
        return this.bot.sendMessage(chatId, messages.planMenuAlreadyPremium(expires), paymentButtons);
      }

      // Free users: show upgrade prompt
      await this.bot.sendMessage(chatId, messages.planMenu, paymentButtons);
    } catch (error) {
      console.error(`/plans error for ${chatId}:`, error);
      await this.bot.sendMessage(chatId, '⚠️ An error occurred. Please try again.');
    }
  }

  async sendPlanMenu(chatId) {
    await sendPlanMenu(this.bot, chatId);
  }

  async _handleBacktest(msg, match) {
    const chatId = msg.chat.id.toString();

    // 1. Parse & validate args (delegated to service)
    console.log("BACKTEST MATCH:", match);
    const parsed = this.backtestService.parseArgs(match[1]);
    console.log("BACKTEST PARSED:", parsed);

    if (!parsed.valid) {
      return this.bot.sendMessage(chatId, messages.backtestInvalidArgs, { parse_mode: 'HTML' });
    }

    const { symbol, days } = parsed;

    try {
      // 2. Send loading message
      const loadingMsg = await this.bot.sendMessage(chatId, messages.backtestLoading(symbol, days), { parse_mode: 'HTML' });

      // 3. Execute backtest (limit check, fetch, run, record — all in service)
      const { result, usage } = await this.backtestService.execute(chatId, symbol, days, msg.isAdminOverride);

      // 4. Build report
      let report = messages.backtestReport(result);
      if (usage.limit !== null) {
        report += `\n\n` + messages.backtestUsage(usage.used, usage.limit);
      }

      // 5. Update loading message with results
      await this.bot.editMessageText(report, {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        parse_mode: 'HTML',
      });

    } catch (error) {
      if (error.code === 'LIMIT_EXCEEDED') {
        return this.bot.sendMessage(chatId, messages.backtestLimitReached(error.used, error.limit), { parse_mode: 'HTML' });
      }
      console.error(`/backtest error for ${chatId}:`, error);
      await this.bot.sendMessage(chatId, messages.backtestError(symbol), { parse_mode: 'HTML' });
    }
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
