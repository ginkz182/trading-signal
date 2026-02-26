# Comprehensive Manual Test Scenarios

This document outlines a complete set of manual test cases for verifying the Trading Signal Bot's functionality in a staging/sandbox environment. These scenarios cover integration points (like Stripe and Telegram) that unit tests cannot fully validate.

---

## 1. Onboarding and Basic Commands

### 1.1 First-Time User Registration
- [ x] **Action:** Send `/start` as a new user.
- [ x] **Expected Result:** Bot replies with the welcome message. User is saved in the database under the 'free' tier (`Stray`). Admin is notified of the new user.

### 1.2 Basic Navigation
- [ x] **Action:** Send `/help`.
- [ x] **Expected Result:** Bot displays the help menu matching your tier capabilities.
- [ x] **Action:** Send `/status`.
- [ x] **Expected Result:** Bot displays "Subscription Status: Active", "Tier: free".

### 1.3 Opting Out
- [ x] **Action:** Send `/stop`.
- [ x] **Expected Result:** Bot confirms unsubscription.
- [ x] **Action:** Send `/status`.
- [ x] **Expected Result:** Bot indicates you are not subscribed.
- [ x] **Action:** Send `/start` again.
- [ x] **Expected Result:** Successfully re-subscribes retaining the previous tier history (free).

---

## 2. Stripe Checkout and Webhooks

### 2.1 Initiating Purchase
- [ x] **Action:** Send `/plans` or `/upgrade`.
- [ x] **Expected Result:** Bot provides an inline keyboard with both "Credit Card (Auto-Renew)" and "PromptPay (One-Time)" options.
- [ x] **Action:** Click "Credit Card (Auto-Renew)".
- [ x] **Expected Result:** Bot generates a unique Stripe Checkout URL for a Subscription.
- [ x] **Action:** Click "PromptPay (One-Time)".
- [ x] **Expected Result:** Bot generates a unique Stripe Checkout URL for a One-Time Payment.

### 2.2 Successful Stripe Checkout - Auto-Renew (Sandbox)
- [ x] **Action:** Open the Auto-Renew URL, enter Stripe test card details (e.g., `4242 4242 4242 4242`). Complete payment.
- [ x] **Expected Result:** 
  1. The webhook listener receives `checkout.session.completed`.
  2. The bot automatically sends a "🎉 Payment Successful!" message.
  3. Send `/status`: Tier is now "premium" (`Resident`). Expiry date is 1 month from now.

### 2.3 Successful Stripe Checkout - One-Off (Sandbox)
- [ x] **Action:** Open the One-Time Payment URL. Complete payment using a test PromptPay/Card.
- [ x] **Expected Result:** 
  1. The webhook listener receives `checkout.session.completed` for a one-time charge.
  2. The bot sends a "🎉 Payment Successful!" message.
  3. Send `/status`: Tier is updated. Expiry date is 1 month from now (No auto-renew warnings).

### 2.4 Extending an Active Subscription (One-Off Top Up)
- [ x] **Prerequisite:** User already has an active "premium" tier (e.g., expires in 15 days).
- [ x] **Action:** Send `/upgrade`, choose "PromptPay (One-Time)". Complete checkout.
- [ x] **Expected Result:** 
  1. The bot confirms the payment.
  2. Send `/status`: The expiry date is successfully **extended** by 1 month (now expires in 45 days), rather than overriding the current end date.

### 2.5 Stripe Auto-Renewal (Sandbox)
- [ x] **Action:** Create a local file `my_invoice_fixture.json` (as described in documentation) with your specific `customer` ID `cus_...`.
- [ x] **Action:** In terminal, trigger a successful invoice payment: `stripe fixtures my_invoice_fixture.json`.
- [ x] **Expected Result:** The webhook listener receives `invoice.paid`. The bot sends a "🔄 Subscription Renewed!" message. `/status` shows the expiry date pushed out by another month.

### 2.6 Stripe Cancellation
- [ x] **Action:** Send `/cancel`.
- [ x] **Expected Result:** Bot asks for confirmation.
- [ x] **Action:** Confirm cancellation.
- [ x] **Expected Result:** Bot communicates with Stripe to cancel auto-renewal at the end of the period. Bot sends "✅ Auto-Renewal Cancelled". `/status` still shows "premium", but indicates it will NOT renew after the expiry date.

---

## 3. Tier Management and Access Control

### 3.1 Free Tier Restrictions
- [ x] **Action:** (On a free account) Send `/subscribe AAPL`.
- [ x] **Expected Result:** Bot blocks the action with a message: "Free tier cannot customize assets. Please upgrade."
- [ x] **Action:** Send `/unsubscribe BTC`.
- [ x] **Expected Result:** Bot blocks the action.
- [ x] **Action:** Send `/backtest BTC 100`.
- [ x] **Expected Result:** Bot blocks the action (Free tier backtest limit is 0).

### 3.2 Premium Tier Access
- [ x] **Action:** (On a premium account) Send `/subscribe AAPL`.
- [ x] **Expected Result:** Bot adds the asset successfully.
- [ x] **Action:** Send `/backtest BTC 100`.
- [ x] **Expected Result:** Backtest runs successfully.

### 3.3 Downgrade Simulation (Admin Override)
- [ x] **Action:** Manually update the database (`subscribers` table) to set the premium user's `subscription_end_at` to yesterday.
- [ x] **Action:** Trigger the cron job (or simulate the `checkExpirations` method). `node scripts/trigger-expiration.js`
- [ x] **Expected Result:** The user's tier in the DB updates from 'premium' to 'free'. The user cannot add new assets anymore.

---

## 4. Smart Delta Asset Architecture

*(Prerequisite: User must be on the Premium tier)*

### 4.1 Adding Custom Assets (Delta: Added)
- [ ] **Action:** Send `/subscribe NVDA` (assuming NVDA is a default).
- [ ] **Expected Result:** Bot replies: "⚠️ You are already subscribed to NVDA."
- [ ] **Action:** Send `/subscribe DOGE`.
- [ ] **Expected Result:** Bot confirms DOGE added. DB `user_assets` shows DOGE with action `added`.

### 4.2 Removing Default Assets (Delta: Removed)
- [ ] **Action:** Send `/unsubscribe BTC/USDT` (or BTC).
- [ ] **Expected Result:** Bot confirms removal. DB shows BTC with action `removed`.

### 4.3 Re-adding a Removed Default
- [ x] **Action:** Send `/subscribe BTC`.
- [ x] **Expected Result:** Bot confirms addition. DB updates that row to `added` due to the UPSERT logic.

### 4.4 Verifying the Combined List
- [ x] **Action:** Send `/assetlist`.
- [ x] **Expected Result:** 
  1. The list DOES NOT contain BTC (if removed previously).
  2. The list DOES contain DOGE (the custom addition).
  3. The list still contains the rest of the defaults (ETH, SOL, AAPL, etc.).

### 4.5 Asset Visibility Post-Downgrade
- [ x] **Action:** Downgrade the user to 'free' (via DB update).
- [ x] **Action:** Send `/assetlist`.
- [ x] **Expected Result:** The list perfectly matches the `config.defaultAssets`. DOGE is gone, BTC is back. (The DB rows still exist under the hood, but the service ignores them).

---

## 5. Backtest Command Limits and Behavior

### 5.1 Invalid Commands
- [ x] **Action:** Send `/backtest`.
- [ x] **Expected Result:** Bot fails gracefully, detailing the command format.
- [ x] **Action:** Send `/backtest BTC 10`.
- [ x] **Expected Result:** Bot fails gracefully (Days must be >= 30).
- [ x] **Action:** Send `/backtest FICTITIOUS_COIN 100`.
- [ x] **Expected Result:** Bot fails gracefully (Asset not found / No data).

### 5.2 Premium Rate Limits
- [ x] **Prerequisite:** Account is 'premium' (Limit: 3/month).
- [ x] **Action:** Run a valid backtest 3 times (e.g., `/backtest BTC 365`).
- [ x] **Expected Result:** All 3 succeed, returning the full report and stating usage `3/3`.
- [ x] **Action:** Run a 4th valid backtest.
- [ x] **Expected Result:** Bot blocks the action: "🚫 Monthly Backtest Limit Reached".

### 5.3 Pro Tier Unlimited Access
- [ x] **Action:** Upgrade the account to 'pro' (via DB update manually for testing).
- [ x] **Action:** Run a 4th and 5th valid backtest.
- [ x] **Expected Result:** Both succeed, ignoring the previous 3-limit restriction.

---

## 6. Scanner and Broadcast Logic

### 6.1 Scanner Execution Limits
- [ x] **Action:** Trigger the daily scanner cron job (`node scripts/test-backtest-offline.js` or via the main app if configured to run).
- [ x] **Expected Result:** The global scan list only contains `config.defaultAssets` + any `added` custom assets from `user_assets` (e.g., it shouldn't redundantly scan removed assets or scan defaults multiple times).

### 6.2 Filtered Broadcasts
- [ x] **Prerequisite:** 
  - User A (Free): Gets defaults.
  - User B (Premium): Unsubscribed from BTC, Subscribed to DOGE.
- [ x] **Action:** Simulate a `BUY` signal for BTC and a `BUY` signal for DOGE.
- [ x] **Expected Result:** 
  - User A receives the broadcast for BTC, but not DOGE.
  - User B receives the broadcast for DOGE, but not BTC.

---

## Conclusion
A successful run of all these scenarios guarantees that your Stripe webhooks, database state management, telegram integrations, and Smart Delta architectural logic are fully robust for production launch!

---

## 7. Customer Support System (2-Way Communication)

### 7.1 User Initiates Support Request
- [ ] **Action:** Send `/support I need help with my subscription` from a standard user account.
- [ ] **Expected Result:**
  1. User receives an auto-reply: "Your message has been received! I will check it and get back to you as soon as possible (usually within 24 hours). 🐈⬛"
  2. Admin account receives a formatted alert: `🚨 Support Request from {Name} (ID: {chat_id}):\n\nI need help with my subscription`

### 7.2 Admin Replies to User
- [ x] **Action:** Send `/reply {user_chat_id} Let me look into that for you!` from the **Admin** account.
- [ x] **Expected Result:**
  1. The user receives: `💬 Reply from Purrrfect Signal Admin:\n\nLet me look into that for you!`
  2. The Admin receives a confirmation: `✅ Reply successfully sent to {user_chat_id}.`

### 7.3 Unauthorized Reply Attempt (Security Check)
- [ x] **Action:** Send `/reply {admin_chat_id} Testing bypass` from a **Standard User** account.
- [ x] **Expected Result:** The bot either silently ignores the command or returns `⛔️ Access Denied`. The message is NOT forwarded to the target chat ID.

### 7.4 Invalid Admin Reply Syntax
- [ x] **Action:** Send `/reply Let me look into that for you!` (missing chat ID) or just `/reply` from the **Admin** account.
- [ x] **Expected Result:** The bot returns a syntax guide: "Usage: /reply <chat_id> <message>"
