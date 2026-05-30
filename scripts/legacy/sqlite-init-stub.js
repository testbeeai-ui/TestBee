const { open } = require("better-sqlite3");

/**
 * Initializes the SQLite database connection and ensures the 'items' table exists.
 * @returns {Promise<better-sqlite3.Database>} The connected database instance.
 */
async function initDB() {
  // Using better-sqlite3, which is synchronous in its core methods,
  // but we wrap it in async/await for consistency with modern React hooks.
  // We open the DB file in the root directory.
  const db = open("./mydatabase.db");

  // Create a table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  return db;
}

module.exports = { initDB };
