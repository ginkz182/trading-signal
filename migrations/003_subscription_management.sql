-- Add subscription_end_at to subscribers table
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMP;

-- Create subscription_history table for audit logs
CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(50) NOT NULL,
    old_tier VARCHAR(50),
    new_tier VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100),
    duration_days INTEGER,
    FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
);

-- Index for faster lookup of expiration history
CREATE INDEX IF NOT EXISTS idx_sub_history_chat_id ON subscription_history(chat_id);
CREATE INDEX IF NOT EXISTS idx_sub_end_at ON subscribers(subscription_end_at);
