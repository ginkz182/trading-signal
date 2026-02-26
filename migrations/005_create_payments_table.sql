-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL, -- 'stripe', 'telegram'
    transaction_id VARCHAR(100) UNIQUE, -- stripe_charge_id, etc.
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'thb',
    status VARCHAR(20) NOT NULL, -- 'pending', 'paid', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
);

-- Add Stripe fields to subscribers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscribers' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE subscribers ADD COLUMN stripe_customer_id VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscribers' AND column_name = 'is_auto_renewal') THEN
        ALTER TABLE subscribers ADD COLUMN is_auto_renewal BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_chat_id ON payments(chat_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
