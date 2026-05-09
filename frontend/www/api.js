const _VALID_GOALS      = Object.freeze(['lose', 'gain', 'maintain']);
const _VALID_TYPES      = Object.freeze(['strength', 'cardio', 'flexibility']);
const _VALID_INTENSITIES = Object.freeze(['low', 'medium', 'high']);
const _WEIGHT_MIN = 30;
const _WEIGHT_MAX = 300;
const _WATER_MAX  = 20;

class FitTrackerAPI {
  constructor() {
    this.userId = this._getOrCreateUserId();
    this.initialized = false;
  }

  async init() {
    await DB.ready;
    await this._loadOrCreateUser();
    this.initialized = true;
  }

  // ── USER MANAGEMENT ────────────────────────────────────────
  _getOrCreateUserId() {
    let userId = localStorage.getItem('fittracker_user_id');
    if (!userId) {
      userId = `user_${Date.now()}`;
      localStorage.setItem('fittracker_user_id', userId);
    }
    return userId;
  }

  async _loadOrCreateUser() {
    const users = await DB.getAll(STORES.users);
    if (users.length) {
      const completed = users.find(u => u.completedOnboarding);
      if (completed) this.userId = completed.id;
    }
  }

  // ── WEIGHT MANAGEMENT ──────────────────────────────────────
  async addWeight(weight, date = this._today()) {
    if (weight < _WEIGHT_MIN || weight > _WEIGHT_MAX) throw new Error('Invalid weight');

    const result = await DB.add(STORES.weights, {
      userId: this.userId,
      date,
      value: Math.round(weight * 10) / 10,
      unit: 'kg'
    });
    if (window.SYNC) SYNC.syncWeight(Math.round(weight * 10) / 10, date).catch(() => {});
    return result;
  }

  async getWeights(limit = null) {
    const weights = await DB.getByIndex(STORES.weights, 'userId', this.userId);
    const sorted = weights.sort((a, b) => new Date(b.date) - new Date(a.date));
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getWeightsByDateRange(startDate, endDate) {
    const allWeights = await this.getWeights();
    return allWeights.filter(w => w.date >= startDate && w.date <= endDate);
  }

  async getLatestWeight() {
    const weights = await this.getWeights(1);
    return weights.length ? weights[0] : null;
  }

  async updateWeight(id, weight) {
    if (weight < _WEIGHT_MIN || weight > _WEIGHT_MAX) throw new Error('Invalid weight');
    return await DB.update(STORES.weights, {
      id,
      userId: this.userId,
      value: Math.round(weight * 10) / 10
    });
  }

  async deleteWeight(id) {
    return await DB.delete(STORES.weights, id);
  }

  // ── GOALS ──────────────────────────────────────────────────
  async setGoal(goal, targetWeight) {
    if (!_VALID_GOALS.includes(goal)) throw new Error('Invalid goal');
    if (targetWeight < _WEIGHT_MIN || targetWeight > _WEIGHT_MAX) {
      throw new Error('Invalid target weight');
    }

    const existing = await DB.getAll(STORES.goals);
    const currentWeight = (await this.getLatestWeight())?.value || 80;
    
    let startWeight;
    if (existing.length) {
      startWeight = existing[0].startWeight || currentWeight;
      await DB.update(STORES.goals, {
        id: existing[0].id,
        userId: this.userId,
        goal,
        targetWeight,
        startWeight,
        currentWeight,
        updatedAt: new Date().toISOString()
      });
    } else {
      startWeight = currentWeight;
      await DB.add(STORES.goals, {
        userId: this.userId,
        goal,
        targetWeight,
        startWeight,
        currentWeight,
        createdAt: new Date().toISOString()
      });
    }
    if (window.SYNC) SYNC.syncGoal(goal, targetWeight, startWeight, currentWeight).catch(() => {});
  }

  async getGoal() {
    const goals = await DB.getAll(STORES.goals);
    if (!goals.length) return null;
    
    const goal = goals[0];
    const latest = await this.getLatestWeight();
    
    // Actualizar peso actual
    if (latest) {
      goal.currentWeight = latest.value;
    }
    
    return goal;
  }

  // ── DAILY CHECKS ────────────────────────────────────────────
  async toggleCheck(checkId, date = this._today()) {
    const existing = await this._getDailyChecks(date);
    const checks = {...(existing[0]?.checks || {})};
    checks[checkId] = !checks[checkId];

    if (existing.length) {
      await DB.update(STORES.dailyChecks, {
        id: existing[0].id,
        userId: this.userId,
        date,
        checks
      });
    } else {
      await DB.add(STORES.dailyChecks, {
        userId: this.userId,
        date,
        checks: { [checkId]: true }
      });
    }
    if (window.SYNC) SYNC.syncCheck(checkId, date).catch(() => {});
  }

  async getDailyChecks(date = this._today()) {
    const existing = await this._getDailyChecks(date);
    return existing.length ? existing[0].checks : {};
  }

  async setCheckState(checkId, completed, date = this._today()) {
    const existing = await this._getDailyChecks(date);
    const checks = { ...(existing[0]?.checks || {}), [checkId]: !!completed };
    if (existing.length) {
      return await DB.update(STORES.dailyChecks, { id: existing[0].id, userId: this.userId, date, checks });
    }
    return await DB.add(STORES.dailyChecks, { userId: this.userId, date, checks });
  }

  async _getDailyChecks(date) {
    const checks = await DB.getByIndex(STORES.dailyChecks, 'userId', this.userId);
    return checks.filter(c => c.date === date);
  }

  async getChecksForDateRange(startDate, endDate) {
    const checks = await DB.getByIndex(STORES.dailyChecks, 'userId', this.userId);
    return checks.filter(c => c.date >= startDate && c.date <= endDate);
  }

  // ── WATER INTAKE ────────────────────────────────────────────
  async setWaterIntake(glasses, date = this._today()) {
    if (glasses < 0 || glasses > _WATER_MAX) throw new Error('Invalid water amount');

    const existing = await this._getWaterIntake(date);
    if (existing.length) {
      await DB.update(STORES.waterIntake, {
        id: existing[0].id,
        userId: this.userId,
        date,
        glasses,
        ml: glasses * 250
      });
    } else {
      await DB.add(STORES.waterIntake, {
        userId: this.userId,
        date,
        glasses,
        ml: glasses * 250
      });
    }
    if (window.SYNC) SYNC.syncWater(glasses, date).catch(() => {});
  }

  async getWaterIntake(date = this._today()) {
    const existing = await this._getWaterIntake(date);
    return existing.length ? existing[0].glasses : 0;
  }

  async _getWaterIntake(date) {
    const water = await DB.getByIndex(STORES.waterIntake, 'userId', this.userId);
    return water.filter(w => w.date === date);
  }

  async getWaterIntakeForDateRange(startDate, endDate) {
    const water = await DB.getByIndex(STORES.waterIntake, 'userId', this.userId);
    return water.filter(w => w.date >= startDate && w.date <= endDate);
  }

  // ── WORKOUTS ────────────────────────────────────────────────
  async logWorkout(type, duration, intensity, date = this._today()) {
    if (!_VALID_TYPES.includes(type))       throw new Error('Invalid workout type');
    if (!_VALID_INTENSITIES.includes(intensity)) throw new Error('Invalid intensity');

    const result = await DB.add(STORES.workouts, {
      userId: this.userId,
      date,
      type,
      duration,
      intensity,
      calories: this._estimateCalories(type, duration, intensity)
    });
    if (window.SYNC) SYNC.syncWorkout(type, duration, intensity, date).catch(() => {});
    return result;
  }

  async getWorkouts(limit = null) {
    const workouts = await DB.getByIndex(STORES.workouts, 'userId', this.userId);
    const sorted = workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getWorkoutsForDateRange(startDate, endDate) {
    const workouts = await this.getWorkouts();
    return workouts.filter(w => w.date >= startDate && w.date <= endDate);
  }

  _estimateCalories(type, duration, intensity) {
    const factors = {
      strength: { low: 4, medium: 6, high: 8 },
      cardio: { low: 8, medium: 12, high: 15 },
      flexibility: { low: 2, medium: 3, high: 4 }
    };
    return Math.round(duration * (factors[type][intensity] || 5));
  }

  // ── STATISTICS ───────────────────────────────────────────────
  async getWeeklyStats(weekStartDate) {
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    
    const startStr = weekStartDate.toISOString().split('T')[0];
    const endStr = weekEndDate.toISOString().split('T')[0];

    const weights = await this.getWeightsByDateRange(startStr, endStr);
    const workouts = await this.getWorkoutsForDateRange(startStr, endStr);
    const checks = await this.getChecksForDateRange(startStr, endStr);
    const water = await this.getWaterIntakeForDateRange(startStr, endStr);

    return {
      weightChange: weights.length > 1 ? weights[weights.length - 1].value - weights[0].value : 0,
      workoutDays: new Set(workouts.map(w => w.date)).size,
      totalCalories: workouts.reduce((sum, w) => sum + (w.calories || 0), 0),
      completedChecks: checks.reduce((sum, c) => sum + Object.values(c.checks).filter(Boolean).length, 0),
      waterDays: water.length,
      averageWater: water.length ? Math.round(water.reduce((sum, w) => sum + w.glasses, 0) / water.length) : 0
    };
  }

  async getMonthlyStats(year, month) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    return {
      weights: await this.getWeightsByDateRange(startStr, endStr),
      workouts: await this.getWorkoutsForDateRange(startStr, endStr),
      daysActive: new Set(
        (await this.getWorkoutsForDateRange(startStr, endStr)).map(w => w.date)
      ).size
    };
  }

  // ── SETTINGS ────────────────────────────────────────────────
  async setSetting(key, value) {
    return await DB.update(STORES.settings, {
      key,
      value,
      userId: this.userId
    });
  }

  async getSetting(key, defaultValue = null) {
    const settings = await DB.getAll(STORES.settings);
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : defaultValue;
  }

  // ── DATA EXPORT/IMPORT ──────────────────────────────────────
  async exportUserData() {
    const data = await DB.exportData();
    return {
      timestamp: new Date().toISOString(),
      userId: this.userId,
      data
    };
  }

  async importUserData(importData) {
    if (!importData || !importData.data) {
      throw new Error('Formato de datos inválido');
    }
    await DB.importData(importData.data);
  }

  // ── UTILITIES ───────────────────────────────────────────────
  _today() {
    return new Date().toISOString().split('T')[0];
  }

  _weekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  _weekEnd(date) {
    const start = this._weekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
  }
}

// Create global instance
const API = new FitTrackerAPI();
