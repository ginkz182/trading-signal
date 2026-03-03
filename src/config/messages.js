/**
 * Telegram Bot Messages Configuration
 * centralized text content for the bot
 */
const config = require('../config');
const dayjs = require('dayjs');

const commandListText = `<b>Basic:</b>
/start - Turn on notifications
/stop - Turn off notifications
/status - Check your subscription status
/assetlist - See your monitored assets
/position - View your active positions and PnL
/plans - View upgrade options
/upgrade - Upgrade to RESIDENT tier
/cancel - Cancel auto-renewal
/support &lt;message&gt; - Contact our support team
/help - Show this help message

<b>Purrfect Resident Tier:</b>
/add &lt;symbol&gt; - Add an asset (e.g. /add SOL)
/remove &lt;symbol&gt; - Remove an asset
/backtest &lt;symbol&gt; &lt;days&gt; - Backtest a strategy. Requires a period in days. Runs with a $10,000 starting balance (e.g. /backtest BTC/USDT 365)

🔗 <b>More Details:</b> <a href="https://withnatsiree.com/purrrfectsignal/">withnatsiree.com/purrrfectsignal</a>`;

const messages = {
    // General / Navigation
    welcome: `🚀 <b>Welcome to Purrrfect Signal!</b>

You are now subscribed to receive trading signals.

<b>Available Commands:</b>

${commandListText}`,
    help: `<b>🤖 Purrrfect Signal Bot Commands</b>

${commandListText}`,
    unsubscribeSuccess: "✅ You have turned off trading signals notifications. Use /start to turn them on again.",
    notSubscribed: "❌ Notifications are turned off. Use /start to turn them on.",
    errorGeneric: "Sorry, there was an error. Please try again.",
    
    // Status
    statusActive: (date, tier, expiry, autoRenew) => `✅ <b>Subscription Status: Active</b>

<b>Subscribed since:</b> ${date}
<b>Tier:</b> ${tier}${expiry}${autoRenew || ''}

Use /cancel to stop auto-renewal or /stop to unsubscribe (temporary pause notification).`,

    paymentSuccess: (tier, expiry) => `🎉 <b>Payment Successful!</b>\n\nThank you for your purchase!\n\n<b>Tier:</b> ${tier}${expiry}\n\nEnjoy your premium features! Use /help to see available commands.`,
    renewalSuccess: (expiry) => `🔄 <b>Subscription Renewed!</b>\n\nYour subscription has been extended.\n\n<b>New Expiry:</b> ${expiry}\n\nThank you for your continued support!`,

    cancelConfirm: `⚠️ <b>Cancel Auto-Renewal?</b>\n\nThis will stop future recurring charges.\nYou'll keep your premium access until the current period ends.\n\nAre you sure?`,
    cancelSuccess: (expiry) => `✅ <b>Auto-Renewal Cancelled</b>\n\nYour subscription will not renew.\nYou still have premium access until <b>${expiry}</b>.\n\nYou can re-subscribe anytime with /plans.`,
    cancelNoSubscription: `ℹ️ You don't have an active recurring subscription to cancel.`,
    cancelNotRecurring: `ℹ️ Your subscription is not on auto-renewal. It will expire naturally.\n\nUse /status to check your expiry date.`,

    // Assets
    assetListHeader: (count) => `<b>📋 Your Monitored Assets</b>\n`,
    assetListDefault: `<i>(Default List)</i>\n`,
    assetListEmpty: "<i>No assets tracking.</i>",
    assetListError: "Failed to retrieve asset list.",
    
    assetAdded: (symbol, type, icon) => `✅ <b>${symbol}</b> added to your ${type} list ${icon}`,
    assetExists: (symbol) => `⚠️ You are already subscribed to <b>${symbol}</b>.`,
    assetNotFound: (symbol) => `❌ <b>Asset Not Found</b>\n\nWe couldn't find "${symbol}" in our supported exchanges.\n\nUse <code>/request ${symbol}</code> to ask the team to add it.`,
    assetRemoveSuccess: (symbol) => `🗑️ <b>${symbol}</b> removed from your monitoring list.`,
    assetRemoveNotFound: (symbol) => `⚠️ <b>Asset Not Found</b>\n\nYou are not subscribed to "${symbol}".\nCheck /assetlist to see your active subscriptions.`,
    invalidSymbol: "❌ Invalid symbol.",
    
    // Requests
    requestReceived: (symbol) => `✅ Request for <b>${symbol}</b> received! We will review it shortly.`,
    requestAdminNotify: (username, symbol) => `📩 <b>ADMIN NOTIFY:New Asset Request</b>\nUser: ${username}\nAsset: ${symbol}`,
    
    // Plans / Payment
    planMenu: (() => {
      const tier = config.tiers.premium;
      const price = (tier.monthlyPrice / 100).toLocaleString();
      return `💎 <b>Upgrade to Purrfect ${tier.displayName}</b>
    
Unlock the full power of the bot:
    
✅ <b>Custom Asset List</b> (Track your favorite coins/stocks)
✅ <b>Manage Portfolio</b> (Add/Remove assets)
    
<b>Pricing: ${price} THB / Month</b>
    
Select your payment method:`;
    })(),

    planMenuAlreadyPremium: (expires) => {
      const tier = config.tiers.premium;
      const price = (tier.monthlyPrice / 100).toLocaleString();
      return `✅ <b>You are a Purrfect ${tier.displayName}!</b>

Your subscription is active${expires ? ` until <b>${expires}</b>` : ''}.

💡 You can <b>extend</b> your plan by purchasing again.

<b>Pricing: ${price} THB / Month</b>

Select your payment method:`;
    },

    planMenuMaxTier: `🏆 <b>You're on the highest tier!</b>

You already have unlimited access to all features. No upgrade needed.`,

    planMenuAutoRenewActive: (expires) => `🔄 <b>Auto-Renewal Active</b>\n\nYour subscription renews automatically — no action needed!${expires ? `\n\n<b>Next renewal:</b> ${expires}` : ''}\n\nUse /cancel to stop auto-renewal.\nUse /status to check your subscription details.`,
    
    paymentLinkLoading: (prefix = "") => `${prefix}🔗 Generating secure payment link...`,
    paymentLinkReady: (url) => `💳 <b>Payment Link Ready</b>\n\nClick below to pay via Stripe:\n<a href="${url}">👉 Proceed to Payment</a>\n\n(Link expires in 60 minutes)`,
    paymentServiceUnavailable: "⚠️ Payment service currently unavailable.",
    paymentLinkFailed: "❌ Failed to generate link. Please try again.",
    
    activeSubscriptionFound: (expires) => `ℹ️ <b>Active Subscription Found</b>\nExpires: ${expires}\n\nProceeding will <b>EXTEND</b> your plan.\n\n`,

    // Access Control
    accessDenied: "⛔️ <b>Access Denied</b>\n\nYou do not have permission to use this command.",
    adminOverride: "🛡️ <b>Admin Override Active</b>: Access granted.",

    // Admin / Test
    adminSubUpdated: (user, tier, expires) => `✅ <b>Subscription Updated</b>\n\nUser: ${user}\nTier: ${tier}\nExpires: ${expires}`,
    userSubUpdated: (tier, days) => `🎉 <b>Subscription Update!</b>\n\nYou have been upgraded to <b>${tier}</b> tier.\nDuration: ${days} days.`,
    testUpgrade: (tier) => `🧪 <b>Test Mode:</b> Upgraded to <b>${tier}</b> for 7 days.`,
    testBroadcastStart: "🧪 <b>Starting Mock Broadcast...</b>\nEnsure you are subscribed to BTC/USDT, ETH/USDT, AAPL, or TSLA to receive alerts.",
    testBroadcastComplete: (count) => `✅ <b>Broadcast Complete</b>\nSent to: ${count} users.`,
    testBroadcastError: "❌ Error: NotificationService not found on MonitorService.",

    // Position Tracker
    positionHeader: `📊 <b>Purrrfect Position</b>\n\n`,
    positionUpItem: (symbol, pnlStr, entryPrice, currentPrice) => `🟢 <b>${symbol}</b> (In Position)\n📈 Unrealized: <b>${pnlStr}</b>\n( ${entryPrice} ➔ ${currentPrice} )\n\n`,
    positionDownItem: (symbol, pnlStr, entryPrice, exitPrice) => `🔴 <b>${symbol}</b> (Exited)\n📉 Prev PnL: <b>${pnlStr}</b>\n( ${entryPrice} ➔ ${exitPrice} )\n\n`,
    positionEmpty: `<i>No position data available yet. Please wait for the next scan or subscribe to new assets.</i>`,
    positionUnavailable: `⚠️ Position tracking is currently unavailable.`,
    positionNoAssets: `You don't have any active assets tracked. Use /add to subscribe to assets.`,
    positionError: `⚠️ An error occurred while fetching positions.`,

    // Backtest
    backtestLoading: (symbol, days) => `⏳ Running backtest for <b>${symbol}</b> over ${days} days...\nThis may take a moment.`,
    backtestLimitReached: (used, limit) => `🚫 <b>Monthly Backtest Limit Reached</b>\n\nYou have used <b>${used}/${limit}</b> backtests this month.\nYour limit resets on the 1st of next month.`,
    backtestUsage: (used, limit) => `📊 Backtest usage: <b>${used}/${limit}</b> this month`,
    backtestInvalidArgs: `❌ <b>Invalid Usage</b>\n\nFormat: <code>/backtest SYMBOL DAYS</code>\nExamples:\n<code>/backtest BTC/USDT 1000</code> (Crypto)\n<code>/backtest AAPL 365</code> (Stock)\n\nDays must be between 30 and 1000.`,
    backtestError: (symbol) => `❌ Failed to run backtest for <b>${symbol}</b>. The asset may not be available or there is insufficient data.`,
    backtestReport: (r) => {
        const status = r.stillInPosition ? '🟡 (Still In Position)' : '🔴 (Closed)';
        let text = `📊 <b>Backtest Report: ${r.symbol}</b>\n`;
        text += `━━━━━━━━━━━━━━━━━━\n`;
        text += `📅 Period: ${dayjs(r.period.from).format('DD MMM YYYY')} → ${dayjs(r.period.to).format('DD MMM YYYY')} (${r.days}d)\n`;
        text += `💰 Start: $${r.initialCapital.toLocaleString()}\n`;
        text += `💵 End: $${r.finalValue.toLocaleString()} ${status}\n`;
        text += `${r.totalPnl >= 0 ? '📈' : '📉'} PnL: <b>${r.totalPnl >= 0 ? '+' : ''}${r.totalPnl}%</b>\n`;
        if (r.stillInPosition && r.unrealizedPnl !== null) {
            text += `   └ Unrealized: ${r.unrealizedPnl >= 0 ? '+' : ''}${r.unrealizedPnl}%\n`;
        }
        text += `━━━━━━━━━━━━━━━━━━\n`;
        text += `🔄 Total Trades: ${r.totalTrades} (${r.completedTrades} completed)\n`;
        text += `✅ Wins: ${r.wins} | ❌ Losses: ${r.losses}\n`;
        text += `🎯 Win Rate: <b>${r.winRate}%</b>\n`;
        text += `📉 Max Drawdown: <b>${r.maxDrawdown}%</b>\n`;
        text += `━━━━━━━━━━━━━━━━━━\n`;
        text += `<i>Strategy: CDC Action Zone (EMA 12/26)</i>`;
        return text;
    },

    // Customer Support System
    supportReceived: `Your message has been received! I will check it and get back to you as soon as possible (usually within 24 hours). 🐈⬛`,
    supportAdminNotify: (name, chatId, message) => `🚨 <b>Admin Notify: Support Request from ${name}</b> (ID: <code>${chatId}</code>):\n\n${message}`,
    replyUserMessage: (message) => `💬 <b>Reply from Purrrfect Signal Admin:</b>\n\n${message}`,
    replyAdminConfirm: (chatId) => `✅ <b>Reply successfully sent to ${chatId}.</b>`,
    replySyntaxError: `❌ <b>Usage:</b> <code>/reply &lt;chat_id&gt; &lt;message&gt;</code>`,
};

module.exports = messages;
