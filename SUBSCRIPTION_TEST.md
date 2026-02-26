# Subscription Test Scenarios

## 1. New Subscription (Access)
- [ ] **Scenario 1.1**: User buys Premium (1 Month).
    - **Expected**: `tier` = 'premium', `subscription_end_at` = NOW + 30 days.
- [ ] **Scenario 1.2**: User buys Pro (1 Month).
    - **Expected**: `tier` = 'pro', `subscription_end_at` = NOW + 30 days.

## 2. Renewal / Extension (Same Tier)
- [ ] **Scenario 2.1**: User has Premium (Expires in 10 days) -> Buys 1 Month Premium.
    - **Expected**: `tier` = 'premium', `subscription_end_at` = NOW + 10d + 30d (Total 40 days from now).
- [ ] **Scenario 2.2**: User has Pro (Expired 2 days ago) -> Buys 1 Month Pro.
    - **Expected**: `tier` = 'pro', `subscription_end_at` = NOW + 30 days. (Gap is ignored, new start date).

## 3. Upgrades (Proration Logic)
- [ ] **Scenario 3.1**: User has Premium (60 days left, Value ~$20) -> Buys Pro (Price $20/mo).
    - **Calculation**:
        - Old Value = 60 days * ($10/30) = $20.
        - Converted Pro Days = $20 / ($20/30) = 30 days.
    - **Expected**: `tier` = 'pro', `subscription_end_at` = NOW + 30d (bought) + 30d (converted) = NOW + 60 days.
- [ ] **Scenario 3.2**: User has Premium (1 day left) -> Buys Pro.
    - **Expected**: Negligible extra time added (approx 12 hours). Total ~30.5 days.

## 4. Downgrade / Expiration
- [ ] **Scenario 4.1**: User has Pro (Expires TODAY). Cron job runs.
    - **Expected**: `tier` = 'free', `subscription_end_at` = NULL.
- [ ] **Scenario 4.2**: User has Pro (Active) -> Buys Premium.
    - **Current Logic**: "Downgrade with Overwrite".
    - **Expected**: `tier` = 'premium', `subscription_end_at` = NOW + 30 days. (Old Pro time is forfeited/replaced).

## 5. Admin Actions
- [ ] **Scenario 5.1**: Admin manually adds specific days.
    - **Expected**: Exactly X days added to current expiry (extension) or set from now (new/upgrade).
