CREATE TABLE IF NOT EXISTS support_requests (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_requests_chat_id ON support_requests(chat_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
