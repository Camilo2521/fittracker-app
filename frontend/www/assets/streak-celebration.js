/**
 * Streak Celebration Manager
 * Celebraciones visuales cuando se alcanzan hitos de rachas
 * Emojis, confetti canvas, haptics, mensajes personalizados
 */

class StreakCelebration {
  static MILESTONES = {
    1: { emoji: '🔥', message: '¡Primer día! Así se hace.', color: '#FFB830' },
    3: { emoji: '🎯', message: '¡3 días! Ya tienes el ritmo.', color: '#4A9EFF' },
    7: { emoji: '⭐', message: '¡Una semana! Eres increíble.', color: '#4DEB6E' },
    14: { emoji: '💎', message: '¡Dos semanas! Dominas esto.', color: '#FF5252' },
    30: { emoji: '👑', message: '¡30 días! Eres un campeón.', color: '#FFB830' },
    60: { emoji: '🚀', message: '¡Dos meses! Alcanzaste las estrellas.', color: '#4DEB6E' },
    100: { emoji: '🏆', message: '¡100 días! LEYENDA CONFIRMADA.', color: '#FF5252' }
  };

  /**
   * Verificar si debe celebrarse una racha
   */
  static shouldCelebrate(streakDays) {
    return this.MILESTONES.hasOwnProperty(streakDays);
  }

  /**
   * Mostrar celebración visual
   */
  static celebrate(streakDays) {
    const milestone = this.MILESTONES[streakDays];
    if (!milestone) return;

    // Animar confetti
    this.showConfetti(milestone.color);

    // Mostrar modal de celebración
    this.showCelebrationModal(streakDays, milestone);

    // Feedback háptico (si está disponible)
    this.triggerHaptics();
  }

  /**
   * Generar y animar confetti
   */
  static showConfetti(color) {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const particles = [];

    // Crear partículas
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 4 + 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        life: 1,
        symbol: ['🎉', '✨', '⭐', '🏆', '💪', '🔥'][Math.floor(Math.random() * 6)]
      });
    }

    const startTime = Date.now();
    const duration = 2500; // 2.5 segundos

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        // Actualizar posición
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // Gravedad
        p.rotation += p.rotationSpeed;

        // Fade out
        p.life = Math.max(0, 1 - progress);

        // Dibujar partícula
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `${p.size * 4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.symbol, 0, 0);
        ctx.restore();
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    };

    animate();
  }

  /**
   * Mostrar modal de celebración
   */
  static showCelebrationModal(streakDays, milestone) {
    const modal = document.createElement('div');
    modal.className = 'celebration-modal celebration-modal-enter';
    modal.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-emoji">${milestone.emoji}</div>
        <h2 class="celebration-title">¡Racha de ${streakDays} días!</h2>
        <p class="celebration-message">${milestone.message}</p>
        
        <div class="celebration-stats">
          <div class="stat">
            <span class="stat-label">Racha Actual</span>
            <span class="stat-value">${streakDays} 🔥</span>
          </div>
          <div class="stat">
            <span class="stat-label">Próximo Hito</span>
            <span class="stat-value">${this.getNextMilestone(streakDays)}</span>
          </div>
        </div>

        <button class="celebration-button">Seguir adelante 💪</button>
      </div>
    `;

    document.body.appendChild(modal);

    const button = modal.querySelector('.celebration-button');
    button.addEventListener('click', () => {
      modal.classList.remove('celebration-modal-enter');
      modal.classList.add('celebration-modal-exit');
      setTimeout(() => modal.remove(), 400);
    });

    // Auto-close después de 5 segundos
    setTimeout(() => {
      if (modal.parentElement) {
        modal.classList.remove('celebration-modal-enter');
        modal.classList.add('celebration-modal-exit');
        setTimeout(() => modal.remove(), 400);
      }
    }, 5000);
  }

  /**
   * Obtener próximo hito
   */
  static getNextMilestone(current) {
    const milestones = Object.keys(this.MILESTONES).map(Number).sort((a, b) => a - b);
    const next = milestones.find(m => m > current);
    return next ? `${next} días` : '🎊 ¡Leyenda!';
  }

  /**
   * Trigger haptic feedback (si Capacitor Haptics está disponible)
   */
  static async triggerHaptics() {
    try {
      if (window.Capacitor && window.Capacitor.isPluginAvailable('Haptics')) {
        const { Haptics } = window.Capacitor.Plugins;
        
        // Secuencia de vibraciones: celebrate
        await Haptics.impact({ style: 'MEDIUM' });
        setTimeout(() => Haptics.impact({ style: 'LIGHT' }), 100);
        setTimeout(() => Haptics.impact({ style: 'MEDIUM' }), 200);
      }
    } catch (error) {
      console.debug('Haptics not available:', error);
    }
  }
}

window.StreakCelebration = StreakCelebration;
