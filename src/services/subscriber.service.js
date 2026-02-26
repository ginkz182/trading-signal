/**
 * PostgreSQL-Only Subscriber Service
 * Works with local PostgreSQL and all cloud services
 */
const { Pool, types } = require("pg");
const config = require("../config");

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

      // Create user_assets table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS user_assets (
          id SERIAL PRIMARY KEY,
          chat_id VARCHAR(50) NOT NULL,
          symbol VARCHAR(20) NOT NULL,
          action VARCHAR(10) NOT NULL CHECK (action IN ('added', 'removed')),
          type VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chat_id, symbol),
          FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
        )
      `);
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_assets_symbol ON user_assets(symbol)
      `);
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_assets_action ON user_assets(action)
      `);

      // Add subscription_end_at column if not exists
      try {
        await this.pool.query(`
          ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMP
        `);
      } catch (e) {
        // Ignore if exists (though IF NOT EXISTS should handle it in newer PG, allow for safety)
        console.log("Column subscription_end_at might already exist");
      }

      // Create subscription_history table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS subscription_history (
            id SERIAL PRIMARY KEY,
            chat_id VARCHAR(50) NOT NULL,
            old_tier VARCHAR(50),
            new_tier VARCHAR(50),
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reason VARCHAR(100),
            duration_days INTEGER,
            FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
        )
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_sub_end_at ON subscribers(subscription_end_at)
      `);

      // Create backtest_usage table for tracking usage limits
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS backtest_usage (
          id SERIAL PRIMARY KEY,
          chat_id VARCHAR(50) NOT NULL,
          used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chat_id) REFERENCES subscribers(chat_id) ON DELETE CASCADE
        )
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_backtest_usage_chat_month 
        ON backtest_usage(chat_id, used_at)
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
        last_name = COALESCE($4, subscribers.last_name)
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

    if (result.rows.length > 0) {
      const subscriber = result.rows[0];
      if (!subscriber.tier) {
        subscriber.tier = "free";
      }
      return subscriber;
    }

    return null;
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

  // --- Asset Subscription Methods ---

  async getActiveAssets(chatId, tier) {
    await this.initialize();
    const config = require("../config");
    const defaultCrypto = config.symbols || [];
    const defaultStocks = config.stockSymbols || [];
    
    const defaultAssets = [...defaultCrypto, ...defaultStocks];

    if (!tier || tier === 'free') {
      return defaultAssets;
    }

    const result = await this.pool.query(
      "SELECT symbol, action FROM user_assets WHERE chat_id = $1",
      [chatId]
    );

    let activeAssets = new Set(defaultAssets);

    for (const row of result.rows) {
      if (row.action === 'added') {
        activeAssets.add(row.symbol);
      } else if (row.action === 'removed') {
        activeAssets.delete(row.symbol);
      }
    }

    return Array.from(activeAssets);
  }

  async getActiveAssetsWithTypes(chatId, tier) {
    await this.initialize();
    const config = require("../config");
    const defaultCrypto = config.symbols || [];
    const defaultStocks = config.stockSymbols || [];

    if (!tier || tier === 'free') {
      return {
        isCustom: false,
        crypto: defaultCrypto,
        stocks: defaultStocks
      };
    }

    const result = await this.pool.query(
      "SELECT symbol, action, type FROM user_assets WHERE chat_id = $1",
      [chatId]
    );

    let cryptoSet = new Set(defaultCrypto);
    let stockSet = new Set(defaultStocks);

    for (const row of result.rows) {
      const targetSet = row.type === 'stock' ? stockSet : cryptoSet;
      if (row.action === 'added') {
        targetSet.add(row.symbol);
      } else if (row.action === 'removed') {
        targetSet.delete(row.symbol);
      }
    }

    return {
      isCustom: result.rows.length > 0,
      crypto: Array.from(cryptoSet),
      stocks: Array.from(stockSet)
    };
  }

  async subscribeAsset(chatId, symbol, type, tier) {
    if (!tier || tier === 'free') {
      throw new Error("Free tier cannot customize assets. Please upgrade to Premium.");
    }
    
    await this.initialize();
    symbol = symbol.toUpperCase();
    
    const activeAssets = await this.getActiveAssets(chatId, tier);
    if (activeAssets.includes(symbol)) {
        return { status: 'exists' };
    }
    
    const result = await this.pool.query(`
      INSERT INTO user_assets (chat_id, symbol, type, action) 
      VALUES ($1, $2, $3, 'added') 
      ON CONFLICT (chat_id, symbol) 
      DO UPDATE SET action = 'added', type = EXCLUDED.type
      RETURNING *
    `, [chatId, symbol, type || 'crypto']);
    
    return { status: 'added', asset: result.rows[0] };
  }

  async unsubscribeAsset(chatId, symbol, tier) {
    if (!tier || tier === 'free') {
      throw new Error("Free tier cannot customize assets. Please upgrade to Premium.");
    }
    
    await this.initialize();
    symbol = symbol.toUpperCase();
    
    let type = 'crypto';
    const config = require("../config");
    if ((config.stockSymbols || []).includes(symbol)) {
        type = 'stock';
    } else if ((config.symbols || []).includes(symbol)) {
        type = 'crypto';
    } else {
        const existing = await this.pool.query("SELECT type FROM user_assets WHERE chat_id = $1 AND symbol = $2", [chatId, symbol]);
        if (existing.rows.length > 0) {
            type = existing.rows[0].type;
        }
    }
    
    const result = await this.pool.query(`
      INSERT INTO user_assets (chat_id, symbol, type, action) 
      VALUES ($1, $2, $3, 'removed') 
      ON CONFLICT (chat_id, symbol) 
      DO UPDATE SET action = 'removed'
      RETURNING *
    `, [chatId, symbol, type]);
    
    return result.rows[0];
  }

  async getAllUniqueSubscribedAssets() {
    await this.initialize();
    const config = require("../config");
    
    const cryptoAssets = new Set(config.symbols || []); 
    const stockAssets = new Set(config.stockSymbols || []);
    
    const result = await this.pool.query("SELECT DISTINCT symbol, type FROM user_assets WHERE action = 'added'");
    
    result.rows.forEach(row => {
        if (row.type === 'stock') {
            stockAssets.add(row.symbol);
        } else {
            cryptoAssets.add(row.symbol);
        }
    });
    
    return {
        crypto: [...cryptoAssets],
        stocks: [...stockAssets]
    };
  }

  // --- Subscription Management Methods ---

  /**
   * Updates a user's subscription tier and expiration.
   * @param {string} chatId - User's chat ID
   * @param {string} newTier - New tier (e.g., 'purrfect_resident')
   * @param {number} durationDays - Duration in days (optional, null for lifetime/indefinite)
   * @param {string} reason - Reason for change (e.g., 'purchase', 'admin', 'expired')
   */
  async updateSubscription(chatId, newTier, durationDays = null, reason = "manual") {
    await this.initialize();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current subscription
      const res = await client.query("SELECT tier, subscription_end_at FROM subscribers WHERE chat_id = $1", [chatId]);
      if (res.rows.length === 0) {
        throw new Error("Subscriber not found");
      }
      const oldTier = res.rows[0].tier;
      const currentEndAt = res.rows[0].subscription_end_at;

      // 2. Calculate new expiration
      let newEndAt = null;
      if (durationDays) {
        let baseDate = new Date(); // Default to NOW
        
        // CASE 1: Extension (Same Tier)
        if (oldTier === newTier && currentEndAt && currentEndAt > baseDate) {
            baseDate = new Date(currentEndAt);
            console.log(`Extending subscription for ${chatId} from ${baseDate.toISOString()}`);
        }
        
        // CASE 2: Upgrade (Different Tier, Higher Value)
        // Check if both tiers have pricing info
        const oldTierConfig = config.tiers[oldTier];
        const newTierConfig = config.tiers[newTier];

        if (oldTier !== newTier && 
            currentEndAt && currentEndAt > baseDate && 
            oldTierConfig?.monthlyPrice && newTierConfig?.monthlyPrice) {
            
            // Only prorate if upgrading (New Price > Old Price)
            if (newTierConfig.monthlyPrice > oldTierConfig.monthlyPrice) {
                const now = new Date();
                const remainingTimeMs = new Date(currentEndAt) - now;
                const remainingDays = Math.max(0, remainingTimeMs / (1000 * 60 * 60 * 24));
                
                // Value Calculation (Price per day)
                const oldPricePerDay = oldTierConfig.monthlyPrice / 30;
                const newPricePerDay = newTierConfig.monthlyPrice / 30;
                
                const remainingValue = remainingDays * oldPricePerDay;
                const convertedDays = remainingValue / newPricePerDay;
                
                console.log(`🔄 Prorating Upgrade for ${chatId}:`);
                console.log(`   - Remaining: ${remainingDays.toFixed(2)} days of ${oldTier}`);
                console.log(`   - Value: ${remainingValue.toFixed(2)} units`);
                console.log(`   - Converted: +${convertedDays.toFixed(2)} days of ${newTier}`);
                
                // Add converted days to the NEW subscription start date (which is NOW)
                // New Duration = Purchased Days + Converted Days
                baseDate.setDate(baseDate.getDate() + convertedDays);
            }
        }

        baseDate.setDate(baseDate.getDate() + durationDays);
        newEndAt = baseDate;
      }

      // 3. Update subscribers table
      // Note: If newTier is 'free', we might want to clear subscription_end_at or keep it as null
      await client.query(
        `UPDATE subscribers 
         SET tier = $1, subscription_end_at = $2, last_updated = CURRENT_TIMESTAMP 
         WHERE chat_id = $3`,
        [newTier, newEndAt, chatId]
      );

      // 4. Log history
      await client.query(
        `INSERT INTO subscription_history (chat_id, old_tier, new_tier, reason, duration_days)
         VALUES ($1, $2, $3, $4, $5)`,
        [chatId, oldTier || 'free', newTier, reason, durationDays]
      );

      await client.query('COMMIT');
      console.log(`Updated subscription for ${chatId}: ${oldTier} -> ${newTier} (Expires: ${newEndAt})`);
      
      return { chatId, oldTier, newTier, expiresAt: newEndAt };

    } catch (e) {
      await client.query('ROLLBACK');
      console.error("Failed to update subscription:", e);
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Checks for expired subscriptions and downgrades them to free.
   * Should be called by a cron job.
   */
  async checkExpirations() {
    await this.initialize();
    console.log("🔍 Checking for expired subscriptions...");

    const client = await this.pool.connect();
    const results = { downgraded: 0, distinctUsers: [] };

    try {
      await client.query('BEGIN');

      // Find expired users who are NOT free
      const expiredQuery = `
        SELECT chat_id, tier 
        FROM subscribers 
        WHERE subscription_end_at < CURRENT_TIMESTAMP 
        AND tier != 'free'
      `;
      const res = await client.query(expiredQuery);

      for (const row of res.rows) {
        // Downgrade to free
        await client.query(
          `UPDATE subscribers 
           SET tier = 'free', subscription_end_at = NULL, last_updated = CURRENT_TIMESTAMP 
           WHERE chat_id = $1`,
          [row.chat_id]
        );

        // (No longer clearing custom assets on downgrade due to Smart Delta)

        // Log history
        await client.query(
          `INSERT INTO subscription_history (chat_id, old_tier, new_tier, reason, duration_days)
           VALUES ($1, $2, 'free', 'expired', 0)`,
          [row.chat_id, row.tier]
        );
        
        results.downgraded++;
        results.distinctUsers.push(row.chat_id);
        console.log(`📉 Downgraded user ${row.chat_id} (Expired)`);
      }

      await client.query('COMMIT');
      return results;

    } catch (e) {
      await client.query('ROLLBACK');
      console.error("Failed to process expirations:", e);
      throw e;
    } finally {
      client.release();
    }
  }

  // --- Backtest Usage Tracking ---

  /**
   * Gets the number of backtests a user has run in the current calendar month.
   * @param {string} chatId
   * @returns {number}
   */
  async getBacktestUsageCount(chatId) {
    await this.initialize();
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM backtest_usage 
       WHERE chat_id = $1 
       AND date_trunc('month', used_at) = date_trunc('month', CURRENT_TIMESTAMP)`,
      [chatId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Records a backtest usage for a user.
   * @param {string} chatId
   */
  async recordBacktestUsage(chatId) {
    await this.initialize();
    await this.pool.query(
      `INSERT INTO backtest_usage (chat_id) VALUES ($1)`,
      [chatId]
    );
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
