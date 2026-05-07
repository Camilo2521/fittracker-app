'use strict';

const express = require('express');
const router  = express.Router();
const pg      = require('../../db/postgres');

/**
 * POST /api/v1/progress/metrics
 * Calcula IMC, TMB y TDEE.
 * Prioridad: valores en SQLite → valores del body (usuario aún no sincronizado).
 */
router.post('/metrics', async (req, res) => {
  const {
    userId,
    weight: bodyWeight, heightCm: bodyHeight, age: bodyAge,
    gender: bodyGender, activityLevel: bodyActivity, goal: bodyGoal,
  } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId es requerido' });

  const sqliteDb = require('../../db/connection');
  const user = sqliteDb.prepare('SELECT * FROM users WHERE external_id = ?').get(userId);

  // Merge: DB values take precedence, body values as fallback
  const weight   = user?.current_weight || bodyWeight;
  const height   = user?.height_cm      || bodyHeight;
  const age      = user?.age            || bodyAge;
  const gender   = user?.gender         || bodyGender   || 'male';
  const activity = user?.activity_level || bodyActivity || 'moderate';
  const goal     = user?.goal           || bodyGoal     || 'maintain';

  if (!weight || !height || !age) {
    return res.status(422).json({
      error:   'Perfil físico incompleto',
      missing: [
        !weight && 'weight (current_weight)',
        !height && 'heightCm (height_cm)',
        !age    && 'age',
      ].filter(Boolean),
    });
  }

  const bmi = weight / ((height / 100) ** 2);

  const bmr = gender === 'female'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;

  const activityFactors = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = bmr * (activityFactors[activity] || 1.55);

  let calorieTarget = tdee;
  if (goal === 'lose')     calorieTarget = tdee - 400;
  else if (goal === 'gain') calorieTarget = tdee + 300;

  const metrics = {
    bmi:            Math.round(bmi * 10) / 10,
    bmr:            Math.round(bmr),
    tdee:           Math.round(tdee),
    calorie_target: Math.round(calorieTarget),
  };

  // Persistir en Postgres (opcional, no bloquea la respuesta)
  pg.query(
    `INSERT INTO physical_metrics (external_id, bmi, bmr, tdee, calorie_target, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (external_id, measured_at) DO UPDATE
     SET bmi=$2, bmr=$3, tdee=$4, calorie_target=$5`,
    [userId, metrics.bmi, metrics.bmr, metrics.tdee, metrics.calorie_target]
  ).catch(e => console.warn('[progress] No se pudo persistir en Postgres:', e.message));

  res.json(metrics);
});

/**
 * GET /api/v1/progress/:userId/metrics
 * Historial de métricas físicas desde Postgres.
 */
router.get('/:userId/metrics', async (req, res) => {
  try {
    const result = await pg.query(
      `SELECT measured_at, bmi, bmr, tdee, calorie_target
       FROM physical_metrics
       WHERE external_id = $1
       ORDER BY measured_at DESC
       LIMIT 30`,
      [req.params.userId]
    );
    res.json(result?.rows || []);
  } catch (e) {
    if (e?.code === '42P01') return res.json([]);
    res.status(503).json({ error: 'Servicio de métricas no disponible' });
  }
});

module.exports = router;
