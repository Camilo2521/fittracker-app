/**
 * BackendSync — Puente HTTP entre IndexedDB local y la API REST Express.
 *
 * Estrategia offline-first:
 *   1. Los datos siempre se guardan primero en IndexedDB (via api.js).
 *   2. BackendSync intenta replicar la operación al backend de forma asíncrona.
 *   3. Si no hay conexión o el backend no responde, la operación se encola
 *      en localStorage y se reintenta automáticamente al volver online.
 *
 * Configuración:
 *   localStorage.setItem('fittracker_backend_url', 'https://tu-servidor.com')
 *
 * Uso (desde api.js u otros módulos):
 *   SYNC.syncWeight(75.5, '2024-01-15');   // fire-and-forget
 *   await SYNC.calculateMetrics(userId);    // espera respuesta Phase 4
 */

class BackendSync {
  constructor() {
    this._baseUrl = null;
    this._userId  = null;
    this._queue   = [];
    this._loadQueue();
    window.addEventListener('online', () => this._flushQueue());
  }

  // ── CONFIGURACIÓN ───────────────────────────────────────────

  get baseUrl() {
    if (!this._baseUrl) {
      const stored  = localStorage.getItem('fittracker_backend_url');
      const derived = window.BACKEND
        ? window.BACKEND.replace('/api/v1', '')
        : (AppConfig?.api?.baseUrl?.replace('/api/v1', '') || 'http://localhost:3000');
      this._baseUrl = stored || derived;
    }
    return this._baseUrl;
  }

  get userId() {
    if (!this._userId) {
      this._userId = localStorage.getItem('fittracker_user_id') || '';
    }
    return this._userId;
  }

  setUserId(id) {
    this._userId = String(id);
    localStorage.setItem('fittracker_user_id', this._userId);
  }

  // ── HTTP HELPERS ─────────────────────────────────────────────

  _headers() {
    return {
      'Content-Type': 'application/json',
      'x-user-id':    this.userId,
    };
  }

  async _request(method, path, body) {
    if (!navigator.onLine) {
      this._enqueue(method, path, body);
      return null;
    }
    try {
      const opts = {
        method,
        headers: this._headers(),
        signal:  AbortSignal.timeout(5000),
      };
      if (body !== undefined) opts.body = JSON.stringify(body);

      const res = await fetch(`${this.baseUrl}${path}`, opts);
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      this._enqueue(method, path, body);
      return null;
    }
  }

  _get(path)         { return this._request('GET',    path, undefined); }
  _post(path, body)  { return this._request('POST',   path, body);      }
  _put(path, body)   { return this._request('PUT',    path, body);      }

  // ── COLA OFFLINE ─────────────────────────────────────────────

  _loadQueue() {
    try {
      this._queue = JSON.parse(
        localStorage.getItem('fittracker_sync_queue') || '[]'
      );
    } catch { this._queue = []; }
  }

  _saveQueue() {
    try {
      // Limitar a 200 operaciones pendientes
      if (this._queue.length > 200) this._queue = this._queue.slice(-200);
      localStorage.setItem('fittracker_sync_queue', JSON.stringify(this._queue));
    } catch {}
  }

  _enqueue(method, path, body) {
    this._queue.push({ method, path, body });
    this._saveQueue();
  }

  async _flushQueue() {
    if (!this._queue.length || !navigator.onLine) return;
    const pending  = [...this._queue];
    this._queue    = [];
    this._saveQueue();

    for (const op of pending) {
      try {
        const opts = {
          method:  op.method,
          headers: this._headers(),
          signal:  AbortSignal.timeout(5000),
        };
        if (op.body !== undefined) opts.body = JSON.stringify(op.body);
        await fetch(`${this.baseUrl}${op.path}`, opts);
      } catch {
        // Si falla de nuevo, re-encolar (sin bucle infinito: máx intentos no implementados)
        this._queue.push(op);
      }
    }
    this._saveQueue();
  }

  // ── REGISTRO DE USUARIO (Phase 2) ────────────────────────────

  async registerUser(profile) {
    if (!profile?.externalId) return null;
    return this._post('/api/v1/auth/register', {
      name:  profile.name  || '',
      email: profile.email || '',
      weight: profile.currentWeight || null,
      goal:   profile.goal || 'maintain',
    });
  }

  // ── SYNC DE DATOS CORE (Phase 2) ─────────────────────────────
  // Estos datos viven en IndexedDB (offline-first). Las rutas legacy
  // /api/weights, /api/goals, etc. ya no existen en el backend v1.

  syncWeight()   { return Promise.resolve(null); }
  syncWorkout()  { return Promise.resolve(null); }
  syncNutrition(){ return Promise.resolve(null); }
  syncMeal()     { return Promise.resolve(null); }
  syncCheck()    { return Promise.resolve(null); }
  syncWater()    { return Promise.resolve(null); }
  syncGoal()     { return Promise.resolve(null); }

  async syncUserProfile(data) {
    if (!data?.externalId) return null;
    // PATCH /api/v1/auth/profile con token JWT si está disponible
    const token = localStorage.getItem('ft_token');
    if (!token) return null;
    try {
      const opts = { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(data), signal: AbortSignal.timeout(5000) };
      const res  = await fetch(`${this.baseUrl}/api/v1/auth/profile`, opts);
      return res.ok ? res.json().catch(() => null) : null;
    } catch {
      return null;
    }
  }

  // ── SYNC DE ML (Phase 3) ─────────────────────────────────────

  syncDetectedMeal() { return Promise.resolve(null); }

  /**
   * Inicia sesión de repeticiones en backend.
   * Retorna { sessionId, mode, fallback? } — si Python no está disponible,
   * sessionId tendrá prefijo "local_" y mode = "mediapipe".
   */
  async startRepSession(exerciseType) {
    return this._post('/api/v1/reps/sessions', {
      userId: this.userId,
      exerciseType,
    });
  }

  completeRepSession(sessionId, data) {
    return this._post(`/api/v1/reps/sessions/${sessionId}/complete`, data);
  }

  // ── PHASE 4: MÉTRICAS FÍSICAS ────────────────────────────────

  /**
   * Calcula IMC, TMB y TDEE usando el perfil físico del usuario.
   * Requiere que el usuario tenga height_cm, age y gender en el backend.
   * Retorna { bmi, bmr, tdee, calorie_target } o null.
   */
  async calculateMetrics(userId, physicalData = {}) {
    return this._post('/api/v1/progress/metrics', { userId, ...physicalData });
  }

  /**
   * Genera rutina personalizada con RAG.
   * Retorna null si el flag rag_enabled no está activo o Python no está disponible.
   */
  async generateRoutine(userId) {
    return this._post('/api/v1/routines/generate', { userId });
  }

  /**
   * Genera plan de dieta semanal con RAG.
   */
  async generateDiet(userId, weekStart) {
    return this._post('/api/v1/diets/generate', { userId, weekStart });
  }

  getWeeklyStats(week) {
    return this._get(`/api/v1/auth/workout-logs?week=${encodeURIComponent(week)}`);
  }

  // ── UTILIDADES ───────────────────────────────────────────────

  async isAvailable() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch { return false; }
  }

  get pendingCount() {
    return this._queue.length;
  }
}

// Instancia global
window.SYNC = new BackendSync();
