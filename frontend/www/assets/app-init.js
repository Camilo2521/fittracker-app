/**
 * FitTracker App Initialization
 * Punto de entrada principal después de cargar los scripts críticos
 */

class FitTrackerApp {
  constructor() {
    this.isInitialized = false;
    this.showedOnboarding = false;
  }

  /**
   * Inicializar la aplicación
   */
  async initialize() {
    try {
      console.log('⚡ [FitTracker] Inicializando aplicación...');
      
      // 1. Esperar a que DOM esté lista
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }

      // 2. Registrar servicios en el contenedor
      this.registerServices();

      // 3. Inicializar base de datos
      const db = window.AppServices.get('database');
      await db.ready;
      console.log('✓ Database initialized');

      // 4. Cargar datos de usuario
      await this.loadUserData();
      this.syncUserToBackend(); // fire-and-forget: no bloquea el arranque

      // 6. Inicializar UI
      this.initializeUI();

      // 7. Inicializar Accesibilidad (WCAG AA)
      const a11y = new AccessibilityManager();
      a11y.init();
      this.registerServiceWorker();

      this.isInitialized = true;
      
      // Disparar evento para que las partes lazy sepan que están listas
      window.dispatchEvent(new CustomEvent('appready'));
      
      console.log('✅ [FitTracker] App ready!');
    } catch (error) {
      console.error('❌ Fatal Error durante inicialización:', error);
      this.showErrorScreen(error);
    }
  }

  /**
   * Registrar servicios en el contenedor
   */
  registerServices() {
    const AppServices = window.AppServices;

    // Usar la instancia DB global (creada en db.js) para no abrir dos conexiones
    if (typeof DB !== 'undefined') {
      const cachedDb = new CachedDatabase(DB);
      AppServices.register('database', cachedDb, true);
    } else if (typeof Database !== 'undefined') {
      const cachedDb = new CachedDatabase(new Database());
      AppServices.register('database', cachedDb, true);
    }

    // API (ya existe globalmente)
    if (typeof API !== 'undefined') {
      AppServices.register('api', API, true);
    }
  }

  /**
   * Cargar datos de usuario
   */
  async loadUserData() {
    try {
      const db = window.AppServices.get('database');
      const user = await db.getUser();
      const weights = user ? await db.getWeights(user.id) : [];
      const goals = user ? await db.getGoals(user.id) : [];

      // Guardar en estado global para scripts antiguos
      window.currentUser = user;
      window.currentWeights = weights;
      window.currentGoals = goals;

      console.log('✓ User data loaded');
    } catch (error) {
      console.warn('Error loading user data:', error);
    }
  }

  /**
   * Inicializar UI - Actualizar header con nombre del usuario
   */
  initializeUI() {
    try {
      const user = window.currentUser;
      if (!user || !user.name) return;

      const name = user.name;
      const headerDate = document.querySelector('.header-date');
      if (headerDate && name && name !== 'Usuario') {
        const hour = new Date().getHours();
        let greeting = '';
        if (hour < 12) greeting = `☀️ Buenos días, ${name}`;
        else if (hour < 19) greeting = `Buenas tardes, ${name}`;
        else greeting = `🌙 Buenas noches, ${name}`;
        headerDate.textContent = greeting;
      }

      console.log('✓ UI initialized');
    } catch (error) {
      console.warn('Error initializing UI:', error);
    }
  }

  /**
   * Sincronizar usuario ya-onboarded al backend (por si nunca se registró).
   * Se llama en cada inicio; el backend hace upsert silencioso.
   */
  async syncUserToBackend() {
    try {
      if (!window.SYNC) return;
      const user = window.currentUser;
      if (!user || !user.completedOnboarding) return;

      const uid = String(user.id);
      SYNC.setUserId(uid);
      await SYNC.registerUser({
        externalId:    uid,
        name:          user.name          || 'Usuario',
        currentWeight: user.currentWeight || null,
        targetWeight:  user.targetWeight  || null,
        goal:          user.goal          || null,
        completedOnboarding: true,
      });
    } catch (e) {
      console.warn('[sync] Auto-registro de usuario falló silenciosamente:', e.message);
    }
  }

  /**
   * Registrar Service Worker
   */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Limpia todos los SW para evitar problemas de caché
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }

  /**
   * Mostrar pantalla de error si inicialización falla
   */
  showErrorScreen(error) {
    const errorHTML = `
      <div style="
        position: fixed;
        inset: 0;
        background: #0F0F0D;
        color: #F2F2EF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: system-ui, sans-serif;
        z-index: 9999;
      ">
        <div style="text-align: center; max-width: 400px;">
          <h1 style="margin-bottom: 16px;">⚠️ Error</h1>
          <p style="color: #8A8A82; margin-bottom: 20px;">FitTracker no pudo iniciarse correctamente:</p>
          <pre style="
            background: #1A1A17;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            color: #FF5252;
            text-align: left;
            margin-bottom: 20px;
          ">${error.message}</pre>
          <button onclick="window.location.reload()" style="
            padding: 12px 20px;
            background: #4DEB6E;
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            text-transform: uppercase;
          ">Reintentar</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', errorHTML);
    document.body.style.overflow = 'hidden';
  }
}

// Inicializar app cuando esté lista
const fitTracker = new FitTrackerApp();
fitTracker.initialize().catch(err => {
  console.error('Uncaught initialization error:', err);
  fitTracker.showErrorScreen(err);
});

window.FitTrackerApp = fitTracker;
