# Backtest Command Implementation Plan

## Goal Description
Add a new `/backtest` command to the Telegram Bot. This command allows users to backtest the "CDC Action Zone" strategy (EMA 12/26 crossover) on a specific asset for a specified duration.
Since we are launching with Free and Premium tiers first, this feature will be available to **Premium** users with a limitation of **3 times per month**. (Future "Pro" tier could have unlimited access).

## User Review Required
> [!IMPORTANT]
> - The backtest will be performed on the DAILY timeframe by default to allow for 365 days of data easily.
> - **Premium tier limit**: We will track usage in the database (`backtest_usage` table) to enforce the 3 times/month limit for Premium users.
> - Do you want the limit to be exactly 3 per calendar month, or a rolling 30-day window? The current plan assumes **calendar month** for simplicity.

## Proposed Changes

### Database & Services

#### [MODIFY] [src/services/subscriber.service.js](file:///Users/gink/Documents/Apps-Projects/Crypto/trading-signal/src/services/subscriber.service.js)
- Create `backtest_usage` table in the `initialize()` method to track `chat_id` and `used_at`.
- Add `getBacktestUsageCount(chatId)` method to query how many backtests the user has run in the current calendar month.
- Add `recordBacktestUsage(chatId)` method to insert a new row when a backtest is successfully executed.

#### [NEW] [src/services/backtest.service.js](file:///Users/gink/Documents/Apps-Projects/Crypto/trading-signal/src/services/backtest.service.js)
- Create `BacktestService` class.
- Implement `backtest(symbol, days, initialCapital)` method.
- Logic: Fetch historical data, calculate EMA 12/26, find crossovers, simulate trades, and calculate PnL/Win Rate/Max Drawdown.

#### [MODIFY] [src/services/binance.service.js](file:///Users/gink/Documents/Apps-Projects/Crypto/trading-signal/src/services/binance.service.js)
- Update or add method to fetch historical daily price data for the requested duration.

#### [MODIFY] [src/services/telegram-bot-handler.js](file:///Users/gink/Documents/Apps-Projects/Crypto/trading-signal/src/services/telegram-bot-handler.js)
- Import `BacktestService`.
- Register new command: `/backtest <symbol> <days>`.
- Use `requireTier('premium')` middleware.
- Inside the handler, check the user's tier. If `premium`, check if their usage count is < 3. If they hit the limit, send a limit-reached message.
- Execute backtest, send results, and record usage in the database.

## Verification Plan

### Automated Tests
- Create a new script `scripts/verify-backtest.js` to run the core backtest logic without Telegram.
- Run: `node scripts/verify-backtest.js`

### Manual Verification
- **Telegram Bot**:
    1. User (Free) tries `/backtest BTC 365` -> Should receive "Upgrade to Premium" menu.
    2. User (Premium) tries `/backtest BTC 365` -> First 3 times should succeed and return the report.
    3. User (Premium) tries 4th time -> Should receive "Monthly limit reached (3/3)" message.
    4. Test invalid symbol -> Error message.
