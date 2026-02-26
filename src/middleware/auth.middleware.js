/**
 * Authorization Middleware for Telegram Bot
 */

const messages = require("../config/messages");
const config = require("../config");

// Helper to send the plan menu (reused by handler and middleware)
const sendPlanMenu = async (bot, chatId) => {
    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [ { text: '💳 Credit Card (Auto-Renew)', callback_data: 'pay_card' } ],
                [ { text: '🏦 Thai QR / PromptPay (1 Month)', callback_data: 'pay_qr' } ]
            ]
        }
    };
    await bot.sendMessage(chatId, messages.planMenu, options);
};

/**
 * Creates a middleware wrapper that checks if a user has a required tier.
 * @param {string} requiredTier - The minimum required tier (e.g., 'free', 'purrfect_resident', 'admin')
 * @param {Function} handler - The command handler function (msg, match) => Promise<void>
 * @param {Object} services - Object containing subscriberService
 * @param {Function} [onFailure] - Optional callback (msg) => Promise<void> for auth failure.
 * @returns {Function} Wrapped handler
 */
const requireTier = (requiredTier, handler, services, onFailure = null) => {
    return async (msg, match) => {
        const chatId = msg.chat.id.toString();
        const { subscriberService, bot } = services;

        const tierLevels = config.tierLevels;
        const requiredLevel = tierLevels[requiredTier] || 0;

        try {
            const subscriber = await subscriberService.getSubscriber(chatId);
            
            if (!subscriber || !subscriber.subscribed) {
                await bot.sendMessage(chatId, messages.notSubscribed || "❌ You are not subscribed. Please use /start to subscribe first.");
                return;
            }

            const userTier = subscriber.tier || 'free';
            const userLevel = tierLevels[userTier] || 0;

            // Check if user is the hardcoded admin from .env
            console.log(process.env.ADMIN_CHAT_ID);
            console.log(chatId);
            const isAdminOverride = process.env.ADMIN_CHAT_ID && chatId === process.env.ADMIN_CHAT_ID;

            if (isAdminOverride || userLevel >= requiredLevel) {
                // Authorized
                
                // Notify if access is granted SOLELY due to Admin Override
                if (isAdminOverride && userLevel < requiredLevel) {
                    await bot.sendMessage(chatId, messages.adminOverride || "🛡️ <b>Admin Override Active</b>: Access granted.", { parse_mode: 'HTML' });
                }

                await handler(msg, match);
            } else {
                // Unauthorized
                if (onFailure) {
                    await onFailure(msg);
                } else if (requiredTier === 'admin') {
                    // General unauthorized message for admin commands
                    await bot.sendMessage(
                        chatId,
                        messages.accessDenied,
                        { parse_mode: 'HTML' }
                    );
                } else {
                    // Default for user tiers: Send Plan Menu (Upgrade Prompt)
                    await sendPlanMenu(bot, chatId);
                }
            }
        } catch (error) {
            console.error(`Auth middleware error for ${chatId}:`, error);
            await bot.sendMessage(chatId, messages.errorGeneric || "⚠️ An error occurred while checking permissions.");
        }
    };
};

module.exports = { requireTier, sendPlanMenu };
