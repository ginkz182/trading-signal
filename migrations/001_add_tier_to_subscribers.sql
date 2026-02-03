-- Add the tier column to the subscribers table
ALTER TABLE subscribers ADD COLUMN tier VARCHAR(255) DEFAULT 'free';

-- Update all existing subscribers to the 'free' tier
UPDATE subscribers SET tier = 'free';
