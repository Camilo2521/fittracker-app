/**
 * Enhanced Database with Memory Cache and Retry Logic
 * Wrapper alrededor de db.js con mejoras de performance
 */

class CachedDatabase {
  constructor(database) {
    this.db = database;
    this._cache = new Map(); // key: `${store}:${id}`
    this._cacheExpiry = new Map();
    this._cacheLifetime = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Establecer TTL del caché
   */
  setCacheLifetime(ms) {
    this._cacheLifetime = ms;
  }

  /**
   * Invalidar caché para una store
   */
  invalidateCache(store, id = null) {
    if (id) {
      const key = `${store}:${id}`;
      this._cache.delete(key);
      this._cacheExpiry.delete(key);
    } else {
      // Invalidar todo lo de la store
      for (const key of this._cache.keys()) {
        if (key.startsWith(`${store}:`)) {
          this._cache.delete(key);
          this._cacheExpiry.delete(key);
        }
      }
    }
  }

  /**
   * Obtener del caché si está válido
   */
  _getFromCache(store, id) {
    const key = `${store}:${id}`;
    const expiry = this._cacheExpiry.get(key);

    if (expiry && Date.now() < expiry) {
      return this._cache.get(key);
    }

    // Expirado, limpiar
    this._cache.delete(key);
    this._cacheExpiry.delete(key);
    return null;
  }

  /**
   * Guardar en caché
   */
  _setCache(store, id, data) {
    const key = `${store}:${id}`;
    this._cache.set(key, data);
    this._cacheExpiry.set(key, Date.now() + this._cacheLifetime);
  }

  /**
   * Reintento con backoff exponencial
   */
  async _withRetry(fn, maxAttempts = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          // Backoff exponencial: 100ms, 300ms, 900ms
          const delay = Math.pow(2, attempt - 1) * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Proxied getUser con caché
   * id=undefined → devuelve el primer usuario de la store
   */
  async getUser(id) {
    const cacheKey = id !== undefined ? id : '__first__';
    const cached = this._getFromCache('users', cacheKey);
    if (cached) return cached;

    const result = await this._withRetry(async () => {
      return await this.db.getUser(id);
    });

    if (result) {
      this._setCache('users', cacheKey, result);
    }

    return result;
  }

  /**
   * Proxied getWeights con caché
   */
  async getWeights(userId) {
    const cached = this._getFromCache('weights', userId);
    if (cached) return cached;

    const result = await this._withRetry(async () => {
      return await this.db.getWeights(userId);
    });

    if (result) {
      this._setCache('weights', userId, result);
    }

    return result;
  }

  /**
   * Proxied getGoals
   */
  async getGoals(userId) {
    const cached = this._getFromCache('goals', userId);
    if (cached) return cached;

    const result = await this._withRetry(async () => {
      return await this.db.getGoals(userId);
    });

    if (result) {
      this._setCache('goals', userId, result);
    }

    return result;
  }

  /**
   * Proxied addWeight con invalidación de caché
   */
  async addWeight(data) {
    const result = await this._withRetry(async () => {
      return await this.db.addWeight(data);
    });

    // Invalidar caché de weights
    this.invalidateCache('weights', data.userId);

    return result;
  }

  /**
   * Proxied updateGoal con invalidación
   */
  async updateGoal(id, data) {
    const result = await this._withRetry(async () => {
      return await this.db.updateGoal(id, data);
    });

    this.invalidateCache('goals', data.userId);
    return result;
  }

  /**
   * Delegate métodos que no necesitan caché
   */
  async getWorkouts(userId) {
    return await this._withRetry(() => this.db.getWorkouts(userId));
  }

  async addWorkout(data) {
    return await this._withRetry(() => this.db.addWorkout(data));
  }

  async getNutrition(userId) {
    return await this._withRetry(() => this.db.getNutrition(userId));
  }

  async addNutrition(data) {
    return await this._withRetry(() => this.db.addNutrition(data));
  }

  async addUser(data) {
    const result = await this._withRetry(() => this.db.addUser(data));
    this.invalidateCache('users', data.id || 1);
    return result;
  }

  async updateUser(data) {
    const result = await this._withRetry(() => this.db.updateUser(data));
    this.invalidateCache('users', data.id || 1);
    return result;
  }
}

window.CachedDatabase = CachedDatabase;
