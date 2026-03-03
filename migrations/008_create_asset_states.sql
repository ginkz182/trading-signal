CREATE TABLE IF NOT EXISTS asset_states (
    symbol VARCHAR(20) PRIMARY KEY,
    current_trend VARCHAR(10) NOT NULL CHECK (current_trend IN ('UPTREND', 'DOWNTREND')),
    entry_price NUMERIC,
    entry_date TIMESTAMP,
    exit_price NUMERIC,
    exit_date TIMESTAMP,
    realized_pnl_percentage NUMERIC,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_states_trend ON asset_states(current_trend);
