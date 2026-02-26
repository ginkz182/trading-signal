-- Rename tiers in subscribers table
UPDATE subscribers SET tier = 'premium' WHERE tier = 'purrfect_resident';
UPDATE subscribers SET tier = 'pro' WHERE tier = 'vip';
