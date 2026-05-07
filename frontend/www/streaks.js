/**
 * FitTracker Streaks System
 * Gestiona rachas de consistencia diaria
 */

class StreaksManager {
  constructor() {
    this.initialized = false;
  }

  async init() {
    await DB.ready;
    this.initialized = true;
  }

  /**
   * Obtener racha actual del usuario
   */
  async getCurrentStreak() {
    const setting = await API.getSetting('current_streak', 0);
    const lastStreakDate = await API.getSetting('last_streak_date', null);

    return {
      count: setting,
      lastDate: lastStreakDate,
      isActive: this._isStreakActive(lastStreakDate)
    };
  }

  /**
   * Obtener racha máxima histórica
   */
  async getBestStreak() {
    return await API.getSetting('best_streak', 0);
  }

  /**
   * Registrar actividad del día
   * Actualiza racha automáticamente
   */
  async recordDailyActivity(date = null) {
    date = date || new Date().toISOString().split('T')[0];
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const streak = await this.getCurrentStreak();
    const lastStreakDate = await API.getSetting('last_streak_date');
    const currentCount = await API.getSetting('current_streak', 0);
    const bestStreak = await API.getSetting('best_streak', 0);

    let newCount = currentCount;

    // Validar que sea día siguiente
    if (lastStreakDate === yesterdayStr && date === today) {
      // Continuar racha
      newCount = currentCount + 1;
    } else if (lastStreakDate === today) {
      // Mismo día, no incrementar
      newCount = currentCount;
    } else if (lastStreakDate !== yesterdayStr && date === today) {
      // Racha rota, comenzar nueva
      newCount = 1;
    }

    // Actualizar racha actual
    await API.setSetting('current_streak', newCount);
    await API.setSetting('last_streak_date', date);

    // Actualizar mejor racha
    if (newCount > bestStreak) {
      await API.setSetting('best_streak', newCount);
    }

    return {
      streak: newCount,
      isContinued: newCount > currentCount,
      newBest: newCount > bestStreak,
      broke: newCount === 1 && currentCount > 1
    };
  }

  /**
   * Verificar si la racha está en peligro
   */
  async checkStreakAtRisk() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const lastStreakDate = await API.getSetting('last_streak_date');
    const currentStreak = await API.getSetting('current_streak', 0);

    // Si no ha completado hoy y también no completó ayer
    if (lastStreakDate !== today && lastStreakDate !== yesterdayStr && currentStreak > 0) {
      const daysWithout = () => {
        const last = new Date(lastStreakDate);
        const now = new Date();
        return Math.floor((now - last) / (1000 * 60 * 60 * 24));
      };

      return {
        atRisk: true,
        daysWithout: daysWithout(),
        currentStreak: currentStreak
      };
    }

    return { atRisk: false };
  }

  /**
   * Obtener estadísticas de racha
   */
  async getStreakStats() {
    const current = await this.getCurrentStreak();
    const best = await this.getBestStreak();
    const total = await API.getSetting('total_streak_days', 0);

    return {
      current: current.count,
      best: best,
      totalDaysCompleted: total,
      streak: {
        current: current.count,
        best: best,
        isActive: current.isActive,
        lastUpdate: current.lastDate
      }
    };
  }

  /**
   * Resetear racha (cuando se rompe)
   */
  async resetStreak() {
    await API.setSetting('current_streak', 0);
    return true;
  }

  /**
   * Obtener progreso visual de racha
   */
  async getStreakVisual() {
    const current = await this.getCurrentStreak();
    const best = await this.getBestStreak();
    
    const fire = (count) => {
      if (count === 0) return '⭕';
      if (count < 3) return '🔥';
      if (count < 7) return '🔥🔥';
      if (count < 14) return '🔥🔥🔥';
      if (count < 30) return '🔥🔥🔥🔥';
      return '🔥🔥🔥🔥🔥';
    };

    return {
      current: {
        visual: fire(current.count),
        text: `${current.count} días`,
        emoji: current.count > 0 ? '🔥' : '⭕'
      },
      best: {
        visual: fire(best),
        text: `${best} días`,
        emoji: best > 0 ? '👑' : '🎯'
      }
    };
  }

  /**
   * Verificar si hoy debe contar para racha
   */
  async shouldCountToday() {
    const today = new Date().toISOString().split('T')[0];
    const lastStreakDate = await API.getSetting('last_streak_date');

    // Si ya registró hoy
    if (lastStreakDate === today) {
      return false;
    }

    // Obtener checks del día
    const checks = await API.getDailyChecks(today);
    const completedChecks = Object.values(checks).filter(Boolean).length;

    // Considerar racha completada si hizo al menos 3 de 5 tareas
    // O si hizo entrenamientos
    return completedChecks >= 3;
  }

  /**
   * Helpers privados
   */
  _isStreakActive(lastDate) {
    if (!lastDate) return false;

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return lastDate === todayStr || lastDate === yesterdayStr;
  }
}

// Create global instance
const STREAKS = new StreaksManager();
