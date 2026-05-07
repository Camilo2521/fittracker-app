'use strict';

const express = require('express');
const router  = express.Router();

const PYTHON_BASE = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const { generateInternalToken } = require('../../utils/internalToken');

/**
 * POST /api/v1/yolo/analyze/:exerciseType
 * Multipart/form-data: frame=<JPEG>
 * Query param: session_id
 *
 * Proxy directo al microservicio Python para mantener la latencia baja.
 * Devuelve { reps, phase, form_score, angles, issues, tips, keypoints }.
 */
router.post('/analyze/:exerciseType', async (req, res) => {
  const { exerciseType } = req.params;
  const sessionId = req.query.session_id || 'default';

  // Pasar el body multipart tal cual al servicio Python
  const pythonUrl = `${PYTHON_BASE}/frames/analyze/${exerciseType}?session_id=${sessionId}`;

  try {
    // Re-stream el body (multer ya no es necesario — pasamos raw)
    const chunks = [];
    req.on('data', c => chunks.push(c));
    await new Promise(resolve => req.on('end', resolve));
    const body = Buffer.concat(chunks);

    const pyRes = await fetch(pythonUrl, {
      method:  'POST',
      headers: {
        'x-internal-token': generateInternalToken(),
        'content-type':     req.headers['content-type'],  // multipart boundary
        'content-length':   body.length,
      },
      body,
      signal: AbortSignal.timeout(6000),
    });

    const data = await pyRes.json().catch(() => ({}));
    res.status(pyRes.status).json(data);
  } catch (err) {
    res.status(503).json({ error: 'Servicio YOLO no disponible', detail: err.message });
  }
});

/**
 * GET /api/v1/yolo/session/:sessionId/summary
 */
router.get('/session/:sessionId/summary', async (req, res) => {
  try {
    const pyRes = await fetch(
      `${PYTHON_BASE}/frames/session/${req.params.sessionId}/summary`,
      { headers: { 'x-internal-token': generateInternalToken() }, signal: AbortSignal.timeout(4000) }
    );
    res.status(pyRes.status).json(await pyRes.json());
  } catch {
    res.status(503).json({ error: 'Servicio YOLO no disponible' });
  }
});

/**
 * DELETE /api/v1/yolo/session/:sessionId
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const pyRes = await fetch(
      `${PYTHON_BASE}/frames/session/${req.params.sessionId}`,
      { method: 'DELETE', headers: { 'x-internal-token': generateInternalToken() }, signal: AbortSignal.timeout(4000) }
    );
    res.status(pyRes.status).json(await pyRes.json());
  } catch {
    res.status(503).json({ error: 'Servicio YOLO no disponible' });
  }
});

module.exports = router;
