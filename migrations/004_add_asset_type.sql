-- Add type column to user_assets if it doesn't exist
ALTER TABLE user_assets ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'crypto';

-- Create requested_assets table
CREATE TABLE IF NOT EXISTS requested_assets (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, added, rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_requested_assets_status ON requested_assets(status);
