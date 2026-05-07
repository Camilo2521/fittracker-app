/**
 * FitTracker Backend API
 * Express server entry point
 */

require('dotenv').config();

const express  = require('express');
const helmet   = require('helmet');
const cors     = require('cors');
const morgan   = require('morgan');
const { runMigrations } = require('./db/migrate');

// Aplicar migraciones pendientes al arrancar
runMigrations();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8080')
  .split(',')
  .map(o => o.trim());

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-internal-token'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api/v1', require('./routes/v1'));

// ── HEALTH CHECK UNIFICADO ────────────────────────────────────
app.get('/health', async (_req, res) => {
  const sqliteDb = require('./db/connection');
  const pg       = require('./db/postgres');
  const { FLAGS } = require('./middleware/featureFlags');

  const checks = { node: 'ok', sqlite: 'unknown', postgres: 'unknown', python: 'unknown' };

  try { sqliteDb.prepare('SELECT 1').get(); checks.sqlite = 'ok'; }
  catch (e) { checks.sqlite = `error: ${e.message}`; }

  checks.postgres = await pg.healthCheck();

  try {
    const pyRes = await fetch(
      `${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}/health`,
      { signal: AbortSignal.timeout(2000) }
    );
    const data = await pyRes.json();
    checks.python = data.status || 'ok';
  } catch { checks.python = 'unavailable'; }

  // SQLite is the primary DB; postgres is optional. Return 200 as long as SQLite is up.
  const sqliteOk = checks.sqlite === 'ok';
  const pgOk     = ['ok', 'unavailable', 'no_config'].includes(checks.postgres)
                   || checks.postgres?.startsWith('error:');
  const allOk    = sqliteOk;

  res.status(allOk ? 200 : 503).json({
    status:        (sqliteOk && pgOk) ? 'ok' : sqliteOk ? 'degraded' : 'error',
    version:       '2.0.0',
    timestamp:     new Date().toISOString(),
    checks,
    feature_flags: FLAGS,
  });
});

// ── ERROR HANDLING ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const message = err.expose || process.env.NODE_ENV !== 'production'
    ? err.message
    : 'Internal server error';
  res.status(status).json({ error: message });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const { FLAGS } = require('./middleware/featureFlags');
  console.log(`✅ FitTracker API v2 running on http://localhost:${PORT}`);
  console.log(`   Environment  : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB path      : ${process.env.DB_PATH || '../database/fittracker.db'}`);
  console.log(`   Python svc   : ${process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'}`);
  console.log(`   Flags activos: ${Object.entries(FLAGS).filter(([,v])=>v).map(([k])=>k).join(', ') || 'ninguno'}`);
});

module.exports = app;
