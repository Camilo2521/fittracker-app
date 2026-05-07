/**
 * FitTracker Notifications System
 * Push notifications para recordatorios, rachas y motivación
 */

class NotificationsManager {
  constructor() {
    this.permission = 'default';
    this.initialized = false;
    this.notificationQueue = [];
  }

  async init() {
    // Verificar soporte
    if (!('Notification' in window)) {
      console.warn('[Notifications] Browser no soporta Web Notifications');
      return false;
    }

    this.permission = Notification.permission;
    
    if (this.permission === 'default') {
      console.log('[Notifications] Solicitando permiso...');
      // No solicitar automáticamente, dejar al usuario
    }

    this.initialized = true;
    return true;
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.error('[Notifications] No soportado');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Enviar notificación de tarea diaria
   */
  async notifyDailyTask(task) {
    if (!this.canNotify()) return;

    const title = '⏰ Tarea de hoy';
    const options = {
      body: task.main,
      tag: `task-${task.id}`,
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      requireInteraction: false,
      actions: [
        { action: 'complete', title: 'Completar' },
        { action: 'snooze', title: 'Recordar después' }
      ]
    };

    return this.send(title, options);
  }

  /**
   * Notificación de racha (streak)
   */
  async notifyStreakMilestone(streak) {
    if (!this.canNotify()) return;

    const emojis = {
      3: '🔥',
      7: '🚀',
      14: '💪',
      30: '👑',
      100: '🏆'
    };

    const emoji = emojis[streak] || '⭐';
    const messages = {
      3: '¡3 días de racha! Vas muy bien',
      7: '¡Semana completa! Increíble consistencia',
      14: '¡14 días! Ya estás en otro nivel',
      30: '¡1 mes perfecto! Eres un campeon',
      100: '¡100 DÍAS! Leyenda absoluta 🏆'
    };

    const title = `${emoji} ¡Racha de ${streak} días!`;
    const options = {
      body: messages[streak] || `¡Racha increíble de ${streak} días!`,
      tag: 'streak-milestone',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      requireInteraction: true
    };

    return this.send(title, options);
  }

  /**
   * Notificación de progreso
   */
  async notifyProgressMilestone(progress) {
    if (!this.canNotify()) return;

    const milestones = {
      25: { emoji: '🎯', text: '25% hacia tu objetivo' },
      50: { emoji: '⚡', text: '50% hacia tu objetivo' },
      75: { emoji: '🚀', text: '75% hacia tu objetivo' },
      100: { emoji: '🏆', text: '¡OBJETIVO ALCANZADO!' }
    };

    const milestone = milestones[progress];
    if (!milestone) return;

    const title = `${milestone.emoji} ${progress}% completado`;
    const options = {
      body: milestone.text,
      tag: 'progress-milestone',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      requireInteraction: progress === 100
    };

    return this.send(title, options);
  }

  /**
   * Recordatorio de entrada de agua
   */
  async notifyWaterReminder() {
    if (!this.canNotify()) return;

    const tips = [
      'Bebe un vaso de agua 💧',
      'Hidratación = éxito 🌊',
      'Tu cuerpo te lo agradecerá 💦',
      'Agua = energía 💪'
    ];

    const tip = tips[Math.floor(Math.random() * tips.length)];
    const options = {
      body: tip,
      tag: 'water-reminder',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png'
    };

    return this.send('💧 Recordatorio de hidratación', options);
  }

  /**
   * Motivación diaria
   */
  async notifyMotivation() {
    if (!this.canNotify()) return;

    const messages = [
      '¡Hoy es el día perfecto para entrenar! 💪',
      'Tu cuerpo es capaz de más de lo que crees 🚀',
      'Cada esfuerzo hoy es progreso mañana ⭐',
      'La consistencia es la clave del éxito 🔑',
      '¡Tú puedes! Un día a la vez 💯',
      'Invierte en ti mismo hoy 🎯',
      'Pequeños pasos generan grandes cambios 🌟'
    ];

    const msg = messages[Math.floor(Math.random() * messages.length)];
    const options = {
      body: msg,
      tag: 'motivation',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png'
    };

    return this.send('💡 Motivación del día', options);
  }

  /**
   * Alerta de racha en peligro
   */
  async notifyStreakAtRisk(daysWithoutCompletion) {
    if (!this.canNotify()) return;

    const title = '⚠️ ¡Tu racha está en peligro!';
    const options = {
      body: `Llevas ${daysWithoutCompletion} días sin completar. ¡Vuelve hoy!`,
      tag: 'streak-at-risk',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      requireInteraction: true
    };

    return this.send(title, options);
  }

  /**
   * Recordatorio de meta
   */
  async notifyGoalReminder(goal) {
    if (!this.canNotify()) return;

    let text = '';
    if (goal.goal === 'lose') {
      text = `Peso actual: ${goal.currentWeight || 'N/A'} kg\nMeta: ${goal.targetWeight} kg`;
    } else if (goal.goal === 'gain') {
      text = `Peso actual: ${goal.currentWeight || 'N/A'} kg\nMeta: ${goal.targetWeight} kg`;
    } else {
      text = `Mantén el balance 🎯\nPeso ideal: ${goal.targetWeight} kg`;
    }

    const options = {
      body: text,
      tag: 'goal-reminder',
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png'
    };

    return this.send('🎯 Tu meta de hoy', options);
  }

  /**
   * Notificación personalizada
   */
  async sendCustom(title, options = {}) {
    if (!this.canNotify()) return;

    const defaultOptions = {
      badge: '/icons/icon-192.png',
      icon: '/icons/icon-192.png',
      requireInteraction: false,
      ...options
    };

    return this.send(title, defaultOptions);
  }

  /**
   * Envío real de notificación
   */
  async send(title, options) {
    if (!this.canNotify()) {
      console.warn('[Notifications] Sin permiso, notificación en queue:', title);
      this.notificationQueue.push({ title, options });
      return null;
    }

    try {
      const notification = new Notification(title, options);
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('[Notifications] Error enviando notificación:', error);
      return null;
    }
  }

  /**
   * Schedule notificación para después
   */
  scheduleNotification(delay, fn) {
    setTimeout(() => {
      fn().catch(err => console.error('[Notifications] Error scheduled:', err));
    }, delay);
  }

  /**
   * Schedule notificación a hora específica
   */
  scheduleAtTime(hour, minute, fn) {
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0
    );

    // Si ya pasó hoy, schedule para mañana
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime - now;
    this.scheduleNotification(delay, fn);

    return scheduledTime;
  }

  /**
   * Procesar queue de notificaciones pendientes
   */
  async processQueue() {
    while (this.notificationQueue.length > 0 && this.canNotify()) {
      const { title, options } = this.notificationQueue.shift();
      await this.send(title, options);
    }
  }

  canNotify() {
    return this.initialized && this.permission === 'granted';
  }

  hasPermission() {
    return this.permission === 'granted';
  }

  getPermissionStatus() {
    return {
      permission: this.permission,
      supported: 'Notification' in window,
      canNotify: this.canNotify(),
      queueLength: this.notificationQueue.length
    };
  }
}

// Create global instance
const NOTIFICATIONS = new NotificationsManager();
