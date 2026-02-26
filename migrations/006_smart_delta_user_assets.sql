-- 006_smart_delta_user_assets.sql
-- Drop the old user_assets table
DROP TABLE IF EXISTS user_assets;

-- Create the new user_assets table tracking only deltas
CREATE TABLE user_assets (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('added', 'removed')),
    type VARCHAR(20) NOT NULL, -- 'crypto' or 'stock'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, symbol),
    FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
);

-- Create index for faster querying by chatbot / scanner
CREATE INDEX idx_user_assets_symbol ON user_assets(symbol);
CREATE INDEX idx_user_assets_action ON user_assets(action);
