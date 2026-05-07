'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const db   = require('./connection');

const MIGRATIONS_DIR = path.join(__dirname, '../../../database/migrations');

// Tracking table (idempotente)
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT UNIQUE NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

function getApplied() {
  return db.prepare('SELECT filename FROM _migrations').all().map(r => r.filename);
}

function columnExists(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);
}

function applyMigration(filename, sql) {
  // Para ALTER TABLE statements, verificar si la columna ya existe (idempotencia)
  if (filename === '002_user_physical_profile.sql') {
    const alterLines = sql
      .split('\n')
      .filter(l => /^\s*ALTER TABLE users ADD COLUMN/i.test(l));

    let applied = 0;
    for (const line of alterLines) {
      const match = line.match(/ADD COLUMN\s+(\w+)/i);
      if (match && !columnExists('users', match[1])) {
        try { db.prepare(line.replace(/;?\s*$/, '')).run(); applied++; }
        catch (e) { console.warn(`[migrate] Saltando ${match[1]}:`, e.message); }
      }
    }
    db.prepare('INSERT OR IGNORE INTO _migrations (filename) VALUES (?)').run(filename);
    if (applied > 0) console.log(`[migrate] ${filename}: ${applied} columna(s) añadida(s)`);
    return;
  }

  db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT OR IGNORE INTO _migrations (filename) VALUES (?)').run(filename);
  })();
  console.log(`[migrate] ${filename}: aplicada`);
}

function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn('[migrate] Directorio de migraciones no encontrado:', MIGRATIONS_DIR);
    return;
  }

  const applied = getApplied();
  const files   = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.includes(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      applyMigration(file, sql);
      count++;
    } catch (e) {
      console.error(`[migrate] Error aplicando ${file}:`, e.message);
    }
  }

  if (count > 0) {
    console.log(`[migrate] ${count} migración(es) aplicada(s).`);
  }
}

module.exports = { runMigrations };

// Permitir ejecutar como script: node src/db/migrate.js
if (require.main === module) {
  console.log('Ejecutando migraciones...');
  runMigrations();
  console.log('Listo.');
}
