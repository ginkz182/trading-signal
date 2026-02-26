-- Create user_assets table for custom subscriptions
CREATE TABLE IF NOT EXISTS user_assets (
    chat_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, symbol),
    FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
);

-- Index for faster lookups by symbol (for scanner)
CREATE INDEX IF NOT EXISTS idx_user_assets_symbol ON user_assets(symbol);
