'use strict';

/**
 * n8nWebhookService — Dispatcher de eventos hacia el agente IA de n8n.
 *
 * Fire-and-forget: nunca bloquea la respuesta HTTP principal.
 * Si n8n no está configurado o está caído, el error se logea en silencio.
 */

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const N8N_SECRET      = process.env.N8N_SECRET || '';

/**
 * Emite un evento de fitness hacia n8n.
 *
 * @param {string} eventType  — 'workout.logged' | 'diet.logged' | 'progress.updated' | 'weekly.checkin'
 * @param {object} payload    — { accountId, user, data, context }
 */
function emit(eventType, payload) {
  if (!N8N_WEBHOOK_URL) return; // deshabilitado si no está configurado

  const body = JSON.stringify({
    event:     eventType,
    timestamp: new Date().toISOString(),
    source:    'fittracker-backend-v2',
    ...payload,
  });

  // Dispatch asíncrono sin await — la respuesta HTTP ya salió
  fetch(N8N_WEBHOOK_URL, {
    method:  'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-n8n-secret':       N8N_SECRET,
      'x-fittracker-event': eventType,
    },
    body,
    signal: AbortSignal.timeout(6000),
  }).then(r => {
    if (!r.ok) console.warn(`[n8n] webhook respondió ${r.status} para evento "${eventType}"`);
  }).catch(err => {
    console.warn(`[n8n] no se pudo enviar "${eventType}":`, err.message);
  });
}

/**
 * Construye el contexto de un usuario para enriquecer el payload del evento.
 * @param {object} db         — instancia de better-sqlite3
 * @param {number} accountId
 * @returns {object}
 */
function buildUserContext(db, accountId) {
  const profile = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!profile) return null;

  const recentWorkouts = db.prepare(
    "SELECT COUNT(*) as c FROM workout_logs WHERE account_id = ? AND date >= date('now','-7 days')"
  ).get(accountId)?.c || 0;

  const recentDietLogs = db.prepare(
    "SELECT COUNT(*) as c FROM diet_logs WHERE account_id = ? AND date >= date('now','-7 days')"
  ).get(accountId)?.c || 0;

  const lastProgress = db.prepare(
    'SELECT weight, date FROM progress_logs WHERE account_id = ? ORDER BY date DESC LIMIT 2'
  ).all(accountId);

  const weightChange = lastProgress.length >= 2
    ? parseFloat((lastProgress[0].weight - lastProgress[1].weight).toFixed(1))
    : null;

  return {
    user: {
      name:          profile.name,
      goal:          profile.goal,
      weight:        profile.weight,
      height:        profile.height_cm,
      age:           profile.age,
      gender:        profile.gender,
      activityLevel: profile.activity_level,
      restrictions:  profile.restrictions,
    },
    context: {
      recentWorkouts,
      recentDietLogs,
      weeklyTarget: 4,
      weightChange,
      lastWeightDate: lastProgress[0]?.date || null,
    },
  };
}

module.exports = { emit, buildUserContext };
