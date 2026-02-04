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
- **SubscriberService** (`src/services/subscriber.service.js`): Manages user tiers, custom asset overrides, and DB persistence.

---

## 🏗 Architecture: The Override Model
- **Override Logic:** - **Free Users:** Inherit `config.js` default assets only.
    - **Premium/Ultimate Users:** Inherit `config.js` defaults initially. Upon using `/subscribe` or `/unsubscribe`, a unique list is persisted to the `user_assets` table. Once custom assets exist, the global config defaults are ignored for that specific user.
- **Monitoring:** `monitor.service.js` sends real-time alerts to `ADMIN_CHAT_ID` for registration, tier changes, and validation failures.
- **Data Flow:** Cron (00:05) -> ExchangeServicePool (Fetch) -> MarketDataProcessor (Window) -> IndicatorManager (Analyze) -> NotificationService (Dispatch).

---

## 💎 Tier Definitions (The Feline Hierarchy)
1. **Purrrfect Stray (Free):** 1D timeframe, default assets. Just roaming the market.
2. **Purrrfect Resident (Premium):** 1D timeframe, custom asset selection. Your own territory.
3. **The Alpha Purr (Pro):** Custom timeframes, etc (this will be for later phase)

---

## 🚥 Engineering Standards (Mandatory)
- **Clean & Testable:** Maintain strict separation of concerns. Use Dependency Injection for DB and Bot instances to allow easy mocking.
- **TDD Mentality:** Always write a test whenever adding a new feature or updating logic. No PR is complete without corresponding test updates.
- **Context Hygiene:** Exclude `node_modules`, `dist`, and `.env` from AI assistant context to ensure precise code generation.
- **Error Handling:** Use a "Request Support" flow when assets are not found in external APIs; notify admin of missing asset requests.

---

## 💻 Development Commands

### Testing
- `npm test` - Run all tests (Mocha, 10s timeout).
- `npm run test:unit` - Run unit tests only (services/managers).
- `npm run test:coverage` - Run tests with coverage reporting via `nyc`.

### Execution
- `npm start` - Start production server (`app.js`).
- `npm run dev` - Start development server with `nodemon`.
- **Default Port:** 3000 (or `PORT` env var).

### Internal API Endpoints (Express)
- `GET /` - Health check and status.
- `GET /stats` - Subscriber and system statistics.
- `POST /trigger-scan` - Manual signal scan trigger.
- `GET /memory` - Memory usage analytics.
- `GET /performance` - Performance and processing summary.

---

## 📝 Ongoing TODOs
- [ ] Implement `user_assets` table migration (id, chat_id, asset_symbol).
- [ ] Add `/subscribe <symbol>` and `/unsubscribe <symbol>` command handlers.
- [ ] Implement `syncDefaultAssets` logic for first-time premium customization.
- [ ] Add `monitor.service.js` to track user growth and custom asset requests.