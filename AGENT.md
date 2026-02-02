# Project: Crypto & Stock Trading Signal Bot
**Brand:** Five Cats Tech (Utility Apps & Tools)
**Target Audience:** Busy investors / Swing traders.
**Strategy:** Trend-following (e.g., CDC Action Zone).

## Technical Context
- **Stack:** Node.js, VS Code, PostgreSQL (`pg` library).
- **Core Files:** `app.js`, `src/config.js`, `src/services/subscriber.service.js`, `src/services/monitor.service.js`.
- **Architecture:** 
    - **Override Model:** Premium users inherit `config.js` defaults until their first customization, which then persists a unique list to `user_assets`.
    - **Monitoring:** Admin alerts via `ADMIN_CHAT_ID` for all user lifecycle events.

## Engineering Standards (Mandatory)
- **Clean & Testable:** Maintain strict separation of concerns. Use Dependency Injection for DB and Bot instances.
- **TDD Mentality:** Always write a test whenever adding a new feature or updating logic. No PR is complete without corresponding test updates.
- **Error Handling:** Use a "Request Support" flow when assets are not found in external APIs.

## Tier Definitions
1. **Free:** 1D timeframe, default assets.
2. **Premium:** 1D timeframe, custom asset selection (`/subscribe`), real-time (0:05).
3. **Super Premium:** Custom timeframes (1h, 4h, etc.), API access.