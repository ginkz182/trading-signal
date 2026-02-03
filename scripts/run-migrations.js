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

    const migrationsDir = path.join(__dirname, "../migrations");
    const migrationFiles = fs.readdirSync(migrationsDir).sort();

    for (const file of migrationFiles) {
      if (file.endsWith(".sql")) {
        console.log(`Running migration: ${file}`);
        const migration = fs.readFileSync(
          path.join(migrationsDir, file),
          "utf8",
        );
        await client.query(migration);
        console.log(`Migration ${file} completed.`);
      }
    }

    console.log("All migrations run successfully.");
  } catch (err) {
    console.error("Error running migrations:", err);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
};

runMigrations();
