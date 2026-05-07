/**
 * IndexedDB Database Manager
 * Handles all local data persistence with automatic backup to localStorage
 */

const DB_NAME = 'FitTracker';
const DB_VERSION = 2;

// Store names
const STORES = {
  users: 'users',
  weights: 'weights',
  workouts: 'workouts',
  nutrition: 'nutrition',
  dailyChecks: 'dailyChecks',
  waterIntake: 'waterIntake',
  goals: 'goals',
  settings: 'settings',
  meals: 'meals',
  exercises: 'exercises',
  progressMeasurements: 'progressMeasurements'
};

class Database {
  constructor() {
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('IndexedDB unavailable, using localStorage only');
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores with indexes
        if (!db.objectStoreNames.contains(STORES.weights)) {
          const ws = db.createObjectStore(STORES.weights, { keyPath: 'id', autoIncrement: true });
          ws.createIndex('date', 'date', { unique: false });
          ws.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.workouts)) {
          const wks = db.createObjectStore(STORES.workouts, { keyPath: 'id', autoIncrement: true });
          wks.createIndex('date', 'date', { unique: false });
          wks.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.dailyChecks)) {
          const dc = db.createObjectStore(STORES.dailyChecks, { keyPath: 'id', autoIncrement: true });
          dc.createIndex('date', 'date', { unique: false });
          dc.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.waterIntake)) {
          const wi = db.createObjectStore(STORES.waterIntake, { keyPath: 'id', autoIncrement: true });
          wi.createIndex('date', 'date', { unique: false });
          wi.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.goals)) {
          db.createObjectStore(STORES.goals, { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.users)) {
          db.createObjectStore(STORES.users, { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains(STORES.nutrition)) {
          const ns = db.createObjectStore(STORES.nutrition, { keyPath: 'id', autoIncrement: true });
          ns.createIndex('date', 'date', { unique: false });
          ns.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.meals)) {
          const ms = db.createObjectStore(STORES.meals, { keyPath: 'id', autoIncrement: true });
          ms.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.exercises)) {
          const es = db.createObjectStore(STORES.exercises, { keyPath: 'id', autoIncrement: true });
          es.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.progressMeasurements)) {
          const pm = db.createObjectStore(STORES.progressMeasurements, { keyPath: 'id', autoIncrement: true });
          pm.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }

  // Add to store
  async add(storeName, data) {
    if (!this.db) return this._fallbackAdd(storeName, data);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add({ ...data, lastModified: Date.now() });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Update in store
  async update(storeName, data) {
    if (!this.db) return this._fallbackUpdate(storeName, data);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ ...data, lastModified: Date.now() });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all from store
  async getAll(storeName) {
    if (!this.db) return this._fallbackGetAll(storeName);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get by index
  async getByIndex(storeName, indexName, value) {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete from store
  async delete(storeName, id) {
    if (!this.db) return this._fallbackDelete(storeName, id);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear store
  async clear(storeName) {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Fallback localStorage methods
  _fallbackAdd(storeName, data) {
    const key = `${storeName}_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(data));
    return Promise.resolve(key);
  }

  _fallbackUpdate(storeName, data) {
    const key = `${storeName}_${data.id || data.date}`;
    localStorage.setItem(key, JSON.stringify(data));
    return Promise.resolve(key);
  }

  _fallbackGetAll(storeName) {
    const prefix = storeName + '_';
    const items = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) {
        items.push(JSON.parse(localStorage.getItem(key)));
      }
    }
    return Promise.resolve(items);
  }

  _fallbackDelete(storeName, id) {
    const key = `${storeName}_${id}`;
    localStorage.removeItem(key);
    return Promise.resolve(true);
  }

  // ── HIGH-LEVEL CONVENIENCE METHODS ─────────────────────────

  async getUser(id = null) {
    const users = await this.getAll(STORES.users);
    if (id === null) return users[0] || null;
    return users.find(u => u.id === id) || null;
  }

  async addUser(data) {
    return await this.add(STORES.users, data);
  }

  async updateUser(data) {
    return await this.update(STORES.users, data);
  }

  async getWeights(userId) {
    if (!userId) return await this.getAll(STORES.weights);
    return await this.getByIndex(STORES.weights, 'userId', userId);
  }

  async addWeight(data) {
    return await this.add(STORES.weights, data);
  }

  async getGoals(userId) {
    const goals = await this.getAll(STORES.goals);
    if (!userId) return goals;
    return goals.filter(g => g.userId === userId);
  }

  async updateGoal(id, data) {
    return await this.update(STORES.goals, { id, ...data });
  }

  async getWorkouts(userId) {
    if (!userId) return await this.getAll(STORES.workouts);
    return await this.getByIndex(STORES.workouts, 'userId', userId);
  }

  async addWorkout(data) {
    return await this.add(STORES.workouts, data);
  }

  async getNutrition(userId) {
    if (!userId) return await this.getAll(STORES.nutrition);
    return await this.getByIndex(STORES.nutrition, 'userId', userId);
  }

  async addNutrition(data) {
    return await this.add(STORES.nutrition, data);
  }

  // Export all data
  async exportData() {
    const data = {};
    for (const store of Object.values(STORES)) {
      data[store] = await this.getAll(store);
    }
    return data;
  }

  // Import data
  async importData(data) {
    for (const [storeName, items] of Object.entries(data)) {
      if (STORES[Object.keys(STORES).find(k => STORES[k] === storeName)]) {
        await this.clear(storeName);
        for (const item of items) {
          await this.add(storeName, item);
        }
      }
    }
  }
}

// Create global instance
const DB = new Database();
