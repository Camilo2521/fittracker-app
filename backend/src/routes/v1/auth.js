'use strict';

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../../db/connection');
const n8n     = require('../../services/n8nWebhookService');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[auth] JWT_SECRET no está configurado. ' +
    'Añade JWT_SECRET=<cadena aleatoria> a backend/.env y reinicia el servidor.'
  );
}
const JWT_EXPIRES = '30d';

// ── Ensure tables exist ───────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    name          TEXT    NOT NULL DEFAULT '',
    goal          TEXT    NOT NULL DEFAULT 'maintain',
    weight        REAL,
    height_cm     REAL,
    age           INTEGER,
    gender        TEXT,
    activity_level TEXT   NOT NULL DEFAULT 'moderate',
    restrictions  TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role       TEXT    NOT NULL CHECK(role IN ('user','assistant')),
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_history_account ON chat_history(account_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS workout_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date        TEXT    NOT NULL DEFAULT (date('now')),
    routine_name TEXT,
    exercises   TEXT    NOT NULL DEFAULT '[]',
    duration_min INTEGER,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_workout_logs_account ON workout_logs(account_id, date DESC);

  CREATE TABLE IF NOT EXISTS diet_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date        TEXT    NOT NULL DEFAULT (date('now')),
    plan_name   TEXT,
    meals       TEXT    NOT NULL DEFAULT '[]',
    total_kcal  REAL,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_diet_logs_account ON diet_logs(account_id, date DESC);

  CREATE TABLE IF NOT EXISTS progress_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date        TEXT    NOT NULL DEFAULT (date('now')),
    weight      REAL,
    body_fat    REAL,
    chest_cm    REAL,
    waist_cm    REAL,
    hip_cm      REAL,
    arm_cm      REAL,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_progress_logs_account ON progress_logs(account_id, date DESC);

  CREATE TABLE IF NOT EXISTS ai_suggestions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    suggestion_type TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    user_feedback   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ai_suggestions_account ON ai_suggestions(account_id, created_at DESC);
`);

function _sign(account) {
  return jwt.sign(
    { id: account.id, email: account.email, name: account.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function _safeUser(acc) {
  const { password_hash, ...safe } = acc;
  return safe;
}

// ── POST /api/v1/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const {
    email, password, name = '',
    goal = 'maintain', weight, height, age, gender,
    activityLevel = 'moderate', restrictions = '',
  } = req.body;

  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  if (password.length < 6)  return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' });

  try {
    const exists = db.prepare('SELECT id FROM accounts WHERE email = ?').get(email.toLowerCase().trim());
    if (exists) return res.status(409).json({ error: 'Este email ya está registrado' });

    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare(`
      INSERT INTO accounts (email, password_hash, name, goal, weight, height_cm, age, gender, activity_level, restrictions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      email.toLowerCase().trim(), hash, name.trim(),
      goal, weight || null, height || null, age || null, gender || null,
      activityLevel, restrictions
    );

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid);
    const token   = _sign(account);
    res.status(201).json({ token, user: _safeUser(account) });
  } catch (err) {
    console.error('[auth] register error:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const account = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email.toLowerCase().trim());
    if (!account) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const ok = await bcrypt.compare(password, account.password_hash);
    if (!ok)  return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const token = _sign(account);
    res.json({ token, user: _safeUser(account) });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.accountId);
  if (!account) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(_safeUser(account));
});

// ── PUT /api/v1/auth/profile ──────────────────────────────────────────────────
router.put('/profile', requireAuth, (req, res) => {
  const { name, goal, weight, height, age, gender, activityLevel, restrictions } = req.body;
  db.prepare(`
    UPDATE accounts SET
      name           = COALESCE(?, name),
      goal           = COALESCE(?, goal),
      weight         = COALESCE(?, weight),
      height_cm      = COALESCE(?, height_cm),
      age            = COALESCE(?, age),
      gender         = COALESCE(?, gender),
      activity_level = COALESCE(?, activity_level),
      restrictions   = COALESCE(?, restrictions),
      updated_at     = datetime('now')
    WHERE id = ?
  `).run(name||null, goal||null, weight||null, height||null, age||null, gender||null, activityLevel||null, restrictions||null, req.accountId);

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.accountId);
  res.json(_safeUser(updated));
});

// ── GET /api/v1/auth/chat-history ────────────────────────────────────────────
router.get('/chat-history', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT role, content, created_at FROM chat_history WHERE account_id = ? ORDER BY created_at ASC LIMIT 40'
  ).all(req.accountId);
  res.json(rows);
});

// ── POST /api/v1/auth/chat-history ───────────────────────────────────────────
router.post('/chat-history', requireAuth, (req, res) => {
  const { messages = [] } = req.body;
  const insert = db.prepare('INSERT INTO chat_history (account_id, role, content) VALUES (?, ?, ?)');
  const insertMany = db.transaction((msgs) => {
    for (const m of msgs) insert.run(req.accountId, m.role, m.content);
  });
  insertMany(messages.filter(m => m.role && m.content));
  res.json({ saved: messages.length });
});

// ── POST /api/v1/auth/workout-log ─────────────────────────────────────────────
router.post('/workout-log', requireAuth, (req, res) => {
  const { date, routineName, exercises = [], durationMin, notes } = req.body;
  const logDate = date || new Date().toISOString().slice(0, 10);
  const info = db.prepare(`
    INSERT INTO workout_logs (account_id, date, routine_name, exercises, duration_min, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.accountId, logDate, routineName || null, JSON.stringify(exercises), durationMin || null, notes || null);

  // Despachar evento a n8n (fire-and-forget, no bloquea la respuesta)
  const ctx = n8n.buildUserContext(db, req.accountId);
  if (ctx) {
    n8n.emit('workout.logged', {
      accountId: req.accountId,
      ...ctx,
      data: { routineName: routineName || null, exercises, durationMin: durationMin || null, date: logDate, notes: notes || null },
    });
  }

  res.json({ id: info.lastInsertRowid });
});

// ── GET /api/v1/auth/workout-logs ─────────────────────────────────────────────
router.get('/workout-logs', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM workout_logs WHERE account_id = ? ORDER BY date DESC LIMIT 60'
  ).all(req.accountId);
  res.json(rows.map(r => ({ ...r, exercises: JSON.parse(r.exercises || '[]') })));
});

// ── POST /api/v1/auth/diet-log ────────────────────────────────────────────────
router.post('/diet-log', requireAuth, (req, res) => {
  const { date, planName, meals = [], totalKcal, notes } = req.body;
  const logDate = date || new Date().toISOString().slice(0, 10);
  const info = db.prepare(`
    INSERT INTO diet_logs (account_id, date, plan_name, meals, total_kcal, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.accountId, logDate, planName || null, JSON.stringify(meals), totalKcal || null, notes || null);

  // Despachar evento a n8n (fire-and-forget)
  const ctx = n8n.buildUserContext(db, req.accountId);
  if (ctx) {
    n8n.emit('diet.logged', {
      accountId: req.accountId,
      ...ctx,
      data: { planName: planName || null, meals, totalKcal: totalKcal || null, date: logDate, notes: notes || null },
    });
  }

  res.json({ id: info.lastInsertRowid });
});

// ── GET /api/v1/auth/diet-logs ────────────────────────────────────────────────
router.get('/diet-logs', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM diet_logs WHERE account_id = ? ORDER BY date DESC LIMIT 60'
  ).all(req.accountId);
  res.json(rows.map(r => ({ ...r, meals: JSON.parse(r.meals || '[]') })));
});

// ── POST /api/v1/auth/progress-log ───────────────────────────────────────────
router.post('/progress-log', requireAuth, (req, res) => {
  const { date, weight, bodyFat, chestCm, waistCm, hipCm, armCm, notes } = req.body;
  const logDate = date || new Date().toISOString().slice(0, 10);
  const info = db.prepare(`
    INSERT INTO progress_logs (account_id, date, weight, body_fat, chest_cm, waist_cm, hip_cm, arm_cm, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.accountId, logDate,
         weight || null, bodyFat || null, chestCm || null,
         waistCm || null, hipCm || null, armCm || null, notes || null);
  if (weight) {
    db.prepare("UPDATE accounts SET weight = ?, updated_at = datetime('now') WHERE id = ?")
      .run(weight, req.accountId);
  }

  // Despachar evento a n8n (fire-and-forget)
  const ctx = n8n.buildUserContext(db, req.accountId);
  if (ctx) {
    n8n.emit('progress.updated', {
      accountId: req.accountId,
      ...ctx,
      data: { weight: weight || null, bodyFat: bodyFat || null, chestCm: chestCm || null, waistCm: waistCm || null, hipCm: hipCm || null, armCm: armCm || null, date: logDate },
    });
  }

  res.json({ id: info.lastInsertRowid });
});

// ── GET /api/v1/auth/progress-logs ───────────────────────────────────────────
router.get('/progress-logs', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM progress_logs WHERE account_id = ? ORDER BY date DESC LIMIT 90'
  ).all(req.accountId);
  res.json(rows);
});

// ── POST /api/v1/auth/ai-suggestion ──────────────────────────────────────────
router.post('/ai-suggestion', requireAuth, (req, res) => {
  const { suggestionType, content, userFeedback } = req.body;
  if (!content) return res.status(400).json({ error: 'content es requerido' });
  const info = db.prepare(`
    INSERT INTO ai_suggestions (account_id, suggestion_type, content, user_feedback)
    VALUES (?, ?, ?, ?)
  `).run(req.accountId, suggestionType || 'general', content, userFeedback || null);
  res.json({ id: info.lastInsertRowid });
});

// ── GET /api/v1/auth/ai-suggestions ──────────────────────────────────────────
router.get('/ai-suggestions', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM ai_suggestions WHERE account_id = ? ORDER BY created_at DESC LIMIT 30'
  ).all(req.accountId);
  res.json(rows);
});

// ── Middleware ────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.accountId = payload.id;
    req.account   = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
