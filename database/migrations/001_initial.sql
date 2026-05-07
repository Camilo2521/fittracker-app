-- ============================================================
-- Migration 001 - Initial Schema
-- FitTracker v1.0.0
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id          TEXT UNIQUE NOT NULL,
  name                 TEXT NOT NULL,
  current_weight       REAL,
  target_weight        REAL,
  goal                 TEXT CHECK(goal IN ('lose', 'gain', 'maintain')),
  goal_type            TEXT,
  start_weight         REAL,
  completed_onboarding INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Weight log
CREATE TABLE IF NOT EXISTS weights (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  value      REAL NOT NULL,
  unit       TEXT NOT NULL DEFAULT 'kg',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fitness goals
CREATE TABLE IF NOT EXISTS goals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  goal           TEXT NOT NULL CHECK(goal IN ('lose', 'gain', 'maintain')),
  target_weight  REAL NOT NULL,
  start_weight   REAL,
  current_weight REAL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Daily habit checks (habits stored as JSON object)
CREATE TABLE IF NOT EXISTS daily_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  checks     TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

-- Water intake
CREATE TABLE IF NOT EXISTS water_intake (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  glasses    INTEGER NOT NULL DEFAULT 0,
  ml         INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

-- Workout sessions
CREATE TABLE IF NOT EXISTS workouts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('strength', 'cardio', 'flexibility')),
  duration   INTEGER NOT NULL,
  intensity  TEXT NOT NULL CHECK(intensity IN ('low', 'medium', 'high')),
  calories   INTEGER,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Manual nutrition entries
CREATE TABLE IF NOT EXISTS nutrition (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  meal_type  TEXT,
  calories   INTEGER NOT NULL DEFAULT 0,
  protein    REAL NOT NULL DEFAULT 0,
  carbs      REAL NOT NULL DEFAULT 0,
  fat        REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ML-detected meals
CREATE TABLE IF NOT EXISTS meals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  name         TEXT NOT NULL,
  calories     INTEGER NOT NULL DEFAULT 0,
  protein      REAL NOT NULL DEFAULT 0,
  carbs        REAL NOT NULL DEFAULT 0,
  fat          REAL NOT NULL DEFAULT 0,
  detected_by  TEXT NOT NULL DEFAULT 'manual',
  confidence   REAL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ML exercise sessions
CREATE TABLE IF NOT EXISTS exercises (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  type          TEXT NOT NULL,
  duration      INTEGER,
  reps          INTEGER,
  sets          INTEGER,
  posture_score REAL,
  feedback      TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ML body progress measurements
CREATE TABLE IF NOT EXISTS progress_measurements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT REFERENCES users(external_id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'progress_measurement',
  metrics         TEXT,
  progress        TEXT,
  recommendations TEXT,
  timestamp       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value per user)
CREATE TABLE IF NOT EXISTS settings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(external_id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT,
  UNIQUE(user_id, key)
);

-- ── Indexes for query performance ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weights_user_date     ON weights(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date    ON workouts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_checks_user_date      ON daily_checks(user_id, date);
CREATE INDEX IF NOT EXISTS idx_water_user_date       ON water_intake(user_id, date);
CREATE INDEX IF NOT EXISTS idx_nutrition_user_date   ON nutrition(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meals_user_date       ON meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exercises_user_date   ON exercises(user_id, date);
CREATE INDEX IF NOT EXISTS idx_progress_user         ON progress_measurements(user_id);
