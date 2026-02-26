const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const runMigrations = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to the database. " + process.env.DATABASE_URL);

    // Create migrations tracker table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of already executed migrations
    const executedMigrationsRes = await client.query('SELECT name FROM migrations');
    const executedMigrations = new Set(executedMigrationsRes.rows.map(row => row.name));

    const migrationsDir = path.join(__dirname, "../migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    let newMigrationsRun = 0;

    for (const file of migrationFiles) {
      if (file.endsWith(".sql")) {
        if (executedMigrations.has(file)) {
          console.log(`Skipping migration (already run): ${file}`);
          continue;
        }

        console.log(`Running migration: ${file}`);
        try {
            await client.query('BEGIN');
            const migrationStr = fs.readFileSync(
              path.join(migrationsDir, file),
              "utf8",
            );
            await client.query(migrationStr);
            await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`Migration ${file} completed.`);
            newMigrationsRun++;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`Migration ${file} failed:`, error);
            throw error; // Stop the process on first failure
        }
      }
    }

    if (newMigrationsRun === 0) {
        console.log("No new migrations to run.");
    } else {
        console.log(`Successfully ran ${newMigrationsRun} new migration(s).`);
    }

  } catch (err) {
    console.error("Error running migrations:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

runMigrations();
