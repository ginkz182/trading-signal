/**
 * PostgreSQL-Only Subscriber Service
 * Works with local PostgreSQL and all cloud services
 */
const { Pool, types } = require("pg");

// Make node-postgres parse TIMESTAMP columns as UTC dates
// OID for TIMESTAMP WITHOUT TIME ZONE is 1114
types.setTypeParser(1114, (stringValue) => {
  if (stringValue === null) {
    return null;
  }
  return new Date(stringValue + "Z");
});

class SubscriberService {
  constructor(config = {}) {
    if (!config.databaseUrl && !process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required. Please set up PostgreSQL database."
      );
    }

    this.pool = new Pool({
      connectionString: config.databaseUrl || process.env.DATABASE_URL,
      ssl: this.isProduction() ? { rejectUnauthorized: false } : false,
    });

    this.initialized = false;
    console.log("📊 Using PostgreSQL database for subscribers");
  }

  isProduction() {
    return process.env.NODE_ENV === "production";
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Test the connection
      await this.pool.query("SELECT NOW()");

      // Create subscribers table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS subscribers (
          chat_id VARCHAR(50) PRIMARY KEY,
          subscribed BOOLEAN DEFAULT true,
          subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          username VARCHAR(100),
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          tier VARCHAR(50) DEFAULT 'free'
        )
      `);

      // Create index for faster queries
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_subscribers_subscribed 
        ON subscribers(subscribed) WHERE subscribed = true
      `);

      console.log("✅ Subscriber service initialized with PostgreSQL");
      this.initialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize subscriber service:", error);
      throw error;
    }
  }

  async subscribe(chatId, userInfo = {}) {
    await this.initialize();

    const result = await this.pool.query(
      `
      INSERT INTO subscribers (chat_id, subscribed, last_updated, username, first_name, last_name, tier)
      VALUES ($1, true, CURRENT_TIMESTAMP, $2, $3, $4, 'free')
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        subscribed = true, 
        last_updated = CURRENT_TIMESTAMP,
        username = COALESCE($2, subscribers.username),
        first_name = COALESCE($3, subscribers.first_name),
        last_name = COALESCE($4, subscribers.last_name),
        tier = 'free'
      RETURNING *
    `,
      [chatId, userInfo.username, userInfo.first_name, userInfo.last_name]
    );

    console.log(
      `📊 User ${chatId} (${userInfo.username || "unknown"}) subscribed`
    );
    return result.rows[0];
  }

  async unsubscribe(chatId) {
    await this.initialize();

    const result = await this.pool.query(
      `
      UPDATE subscribers 
      SET subscribed = false, last_updated = CURRENT_TIMESTAMP
      WHERE chat_id = $1
      RETURNING *
    `,
      [chatId]
    );

    if (result.rows.length > 0) {
      console.log(`📊 User ${chatId} unsubscribed`);
      return result.rows[0];
    }
    return null;
  }

  async getSubscriber(chatId) {
    await this.initialize();

    const result = await this.pool.query(
      "SELECT * FROM subscribers WHERE chat_id = $1",
      [chatId]
    );
    return result.rows[0] || null;
  }

  async getActiveSubscribers() {
    await this.initialize();

    const result = await this.pool.query(
      "SELECT * FROM subscribers WHERE subscribed = true ORDER BY subscribed_at DESC"
    );
    return result.rows;
  }

  async getActiveChatIds() {
    await this.initialize();

    const result = await this.pool.query(
      "SELECT chat_id FROM subscribers WHERE subscribed = true"
    );
    return result.rows.map((row) => row.chat_id);
  }

  async getStats() {
    await this.initialize();

    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE subscribed = true) as active,
        COUNT(*) FILTER (WHERE subscribed = false) as inactive
      FROM subscribers
    `);

    const stats = result.rows[0];
    return {
      total: parseInt(stats.total),
      active: parseInt(stats.active),
      inactive: parseInt(stats.inactive),
    };
  }

  async isSubscribed(chatId) {
    await this.initialize();
    const subscriber = await this.getSubscriber(chatId);
    return !!(subscriber && subscriber.subscribed);
  }

  // Cleanup method for graceful shutdown
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log("📊 Database connection closed");
    }
  }

  // Helper method to check database connection
  async testConnection() {
    try {
      const result = await this.pool.query(
        "SELECT NOW() as current_time, version() as postgres_version"
      );
      return {
        connected: true,
        currentTime: result.rows[0].current_time,
        version: result.rows[0].postgres_version,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }
}

module.exports = SubscriberService;
