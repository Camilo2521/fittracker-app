'use strict';

const crypto = require('crypto');

/**
 * Genera un token HMAC-SHA256 para autenticación interna Node → Python.
 * Formato: "{timestamp_unix}.{sha256_hex}"
 * El microservicio Python valida que el timestamp sea ≤ 30 seg de antigüedad.
 */
function generateInternalToken() {
  const secret = process.env.INTERNAL_API_SECRET || 'changeme';

  const ts  = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

module.exports = { generateInternalToken };
