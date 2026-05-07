-- ============================================================
-- Migration 002 — Perfil físico del usuario
-- FitTracker v2.0.0
-- Reversible: columnas nullables con DEFAULT NULL
-- ============================================================

-- UPGRADE ────────────────────────────────────────────────────
-- Campos necesarios para cálculo de TMB/TDEE y RAG nutricional

ALTER TABLE users ADD COLUMN height_cm      REAL    DEFAULT NULL;
ALTER TABLE users ADD COLUMN age            INTEGER DEFAULT NULL;
ALTER TABLE users ADD COLUMN gender         TEXT    DEFAULT NULL
  CHECK(gender IS NULL OR gender IN ('male','female','other'));
ALTER TABLE users ADD COLUMN activity_level TEXT    DEFAULT 'moderate'
  CHECK(activity_level IS NULL OR activity_level IN ('sedentary','light','moderate','active','very_active'));
ALTER TABLE users ADD COLUMN restrictions   TEXT    DEFAULT NULL;

-- DOWNGRADE ──────────────────────────────────────────────────
-- SQLite >= 3.35.0 soporta DROP COLUMN.
-- Para versiones anteriores: recrear la tabla sin las columnas.
--
-- ALTER TABLE users DROP COLUMN height_cm;
-- ALTER TABLE users DROP COLUMN age;
-- ALTER TABLE users DROP COLUMN gender;
-- ALTER TABLE users DROP COLUMN activity_level;
-- ALTER TABLE users DROP COLUMN restrictions;
