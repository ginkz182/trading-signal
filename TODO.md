# TODO: Premium Subscriptions & Admin Monitoring (Five Cats Tech)

## Phase 0: Monitoring & Observability
- [x] Add `ADMIN_CHAT_ID` to `.env`.
- [x] Create `src/services/monitor.service.js` (Methods: `notifyNewUser`, `notifySubscriptionChange`).
- [ ] Implement alerts for validation failures (e.g., user tries to subscribe to an unsupported asset).

## Phase 1: Database & Persistence
- [ ] Create `user_assets` table (Many-to-Many: `chat_id` and `asset_symbol`).
- [ ] Update `subscriber.service.js`:
    - `addAsset(chatId, symbol)`: With Tier check.
    - `removeAsset(chatId, symbol)`: With "Inherit from Default" logic.
    - `syncDefaultAssets(chatId)`: Clones `config.js` list to DB on first custom action.

## Phase 2: Bot Interface
- [ ] Add `/subscribe <symbol>` command: Check Tier -> Validate API -> Persist.
- [ ] Add `/unsubscribe <symbol>` command: Remove from `user_assets`.
- [ ] Add `/assetlist` command: Display the user's active monitoring list.

## Phase 3: Scanner Engine Update
- [ ] Update `SignalCalculator.js`: Use a SQL `UNION` to fetch a unique set of all assets needed by all users.
- [ ] Update `NotificationProducer`: Filter results per user based on their specific `user_assets` list.

## Phase 4: Automated Testing (Mandatory)
- [ ] Unit tests for `monitor.service.js`.
- [ ] Unit tests for the "Default-to-Custom" inheritance logic.
- [ ] Integration tests for the `/subscribe` command flow.