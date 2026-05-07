/**
 * SQLite database connection
 * Uses better-sqlite3 for synchronous, high-performance access
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// DB_PATH from env is resolved relative to the backend/ working directory.
// Default falls back to a path relative to this file (src/db/ → ../../../database/).
const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, '../../../database/fittracker.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Performance and safety pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

module.exports = db;
