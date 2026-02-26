# Project: Purrrfect Signal (by Five Cats Tech)

**Brand:** Five Cats Tech (Utility Apps & Tools)
**Target Audience:** Busy investors / Swing traders (Not day traders).
**Strategy:** Trend-following (CDC Action Zone / EMA 12, 26 Crossover).
**Tone:** Witty, feline-inspired, professional, and helpful.

---

## 🛠 Technical Stack & Context
- **Runtime:** Node.js >=18.0.0 (npm >=8.0.0).
- **Database:** PostgreSQL (`pg` library) for subscriber and asset management.
- **APIs:** `ccxt` (Crypto), `yahoo-finance2` (Stocks), `node-telegram-bot-api`.
- **Logic:** `technicalindicators` (EMA calculations), `node-cron` (Scheduling).

### Core Components
- **SignalCalculator** (`src/core/SignalCalculator.js`): Main orchestrator that coordinates all services and scheduled scans.
- **MarketDataProcessor** (`src/core/MarketDataProcessor.js`): Handles data validation, windowing (150-point), and prep for analysis.
- **ExchangeServicePool** (`src/services/data/ExchangeServicePool.js`): Manages service pooling (KuCoin, Yahoo Finance) for memory efficiency.
- **IndicatorManager** (`src/managers/indicator.manager.js`): Specifically calculates the 12/26 EMA strategy signals.
- **SubscriberService** (`src/services/subscriber.service.js`): Manages user tiers, custom asset overrides, backtest usage tracking, and DB persistence.
- **BacktestService** (`src/services/backtest.service.js`): Owns all backtest business logic: argument parsing, usage limit checking, data fetching, EMA 12/26 crossover simulation, and usage recording.

---

## 🏗 Architecture: The Override Model
- **Override Logic:** - **Free Users:** Inherit `config.js` default assets only.
    - **Premium/Ultimate Users:** Inherit `config.js` defaults initially. Upon using `/subscribe` or `/unsubscribe`, a unique list is persisted to the `user_assets` table. Once custom assets exist, the global config defaults are ignored for that specific user.
    - **Smart Validation:** The system prevents duplicate subscriptions (checking both default and custom lists) and validates assets against exchanges before adding.
- **Monitoring:** `monitor.service.js` sends real-time alerts to `ADMIN_CHAT_ID` for registration, tier changes, and validation failures.
- **Data Flow:** Cron (00:05) -> ExchangeServicePool (Fetch) -> MarketDataProcessor (Window) -> IndicatorManager (Analyze) -> NotificationService (Dispatch).

---

## 💎 Tier Definitions (The Feline Hierarchy)
1. **Purrrfect Stray (Free):** 1D timeframe, default assets. Just roaming the market.
2. **Purrrfect Resident (Premium):** 1D timeframe, custom asset selection. Your own territory.
3. **The Alpha Purr (Pro):** Custom timeframes, etc (this will be for later phase)

---

## �️ Subscription Management & Authorization
- **Database:** `subscribers` table (with `subscription_end_at`) and `subscription_history` table.
- **Expiration:** Daily cron job (01:00 UTC) automatically downgrades expired users to 'free'.
- **Authorization:** `requireTier` middleware protects commands.
  - **Admin Override:** `process.env.ADMIN_CHAT_ID` bypasses tier checks.

---

## 🤖 Bot Commands

### Standard (All Users)
- `/start` - Subscribe to signals (preserves existing tier on re-subscribe).
- `/stop` - Unsubscribe (pauses notifications, keeps tier).
- `/status` - Check tier and expiration date.
- `/plans` - View upgrade options (tier-aware messaging).
- `/plans <CODE>` - Apply a promo code for discounted pricing.
- `/upgrade` - Alias for `/plans`.
- `/help` - Show command list.

### Purrfect Resident (Premium)
- `/assetlist` - View monitored assets.
- `/subscribe <SYMBOL>` - Add asset (Smart duplicate detection & default checking).
- `/unsubscribe <SYMBOL>` - Remove asset.
- `/request <SYMBOL>` - Request a new asset to be added to the system.
- `/backtest <SYMBOL> <DAYS>` - Run a backtest simulation (Strategies: CDC Action Zone). Limited based on `config.tiers.premium.backtestLimit` (e.g. 3 times/month).

### Admin Only
- `/admin_add_sub <chatId> <tier> <days>` - Manually upgrade/renew a user.

### The Alpha Purr (Pro)
- `/backtest <SYMBOL> <DAYS>` - Unlimited backtesting (Future capability).


---

## 💻 Development Commands

### Testing
- `npm test` - Run all tests (Integration + Unit).
- `test/services/subscriber_subscription.test.js` - Subscription logic tests.
- `test/middleware/auth.test.js` - Authorization tests.

### API Endpoints (Express)
- `POST /api/subscription/update` - Programmatically upgrade users (requires `x-api-key`).
- `GET /stats` - Subscriber and system statistics.
- `POST /trigger-scan` - Manual signal scan trigger.

---

## 📜 Coding Standards
Refer to **[AI_GUIDELINES.md](./AI_GUIDELINES.md)** for detailed instructions on:
- Clean Architecture (Separation of Concerns).
- Mandatory Testing (Unit & Integration).
- Dependency Injection.
- Usage of `config.js` for tier definitions.