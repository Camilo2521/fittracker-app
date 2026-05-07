/**
 * Accessibility Module
 * WCAG 2.1 AA compliant
 * 
 * - aria-labels para elementos interactivos
 * - Contraste mínimo WCAG AA (4.5:1)
 * - Keyboard navigation
 * - prefers-reduced-motion support
 */

class AccessibilityManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Inicializar sistema de accesibilidad
   */
  init() {
    if (this.initialized) return;

    this.addAriaLabels();
    this.verifyContrast();
    this.enhanceKeyboardNavigation();
    this.addSkipLink();
    this.monitorReducedMotion();

    this.initialized = true;
    console.log('✓ Accessibility initialized');
  }

  /**
   * Agregar aria-labels a todos los botones interactivos
   */
  addAriaLabels() {
    const labelMap = {
      // Navigation
      'dashboard': 'Ir a panel de control',
      'workouts': 'Ver entrenamientos',
      'nutrition': 'Ver nutrición y comidas',
      'water': 'Registrar hidratación',
      'reports': 'Ver reportes semanales',

      // Action buttons
      'add': 'Agregar nuevo',
      'delete': 'Eliminar elemento',
      'edit': 'Editar elemento',
      'save': 'Guardar cambios',
      'cancel': 'Cancelar operación',
      'submit': 'Enviar formulario',

      // Toggle buttons
      'toggle': 'Activar/desactivar',
      'expand': 'Expandir sección',
      'collapse': 'Contraer sección',

      // Form controls
      'next': 'Ir al siguiente paso',
      'previous': 'Volver al paso anterior',
      'completed': 'Marcar como completado',
    };

    // Agregar aria-labels a botones sin texto visible
    document.querySelectorAll('button[class*="icon"], button:has(svg), [role="button"]:has(svg)').forEach(btn => {
      if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
        const dataId = btn.dataset.action || btn.className;
        const label = Object.entries(labelMap).find(([key]) => dataId.includes(key))?.[1];
        
        if (label) {
          btn.setAttribute('aria-label', label);
        }
      }
    });

    console.log('✓ Aria-labels added');
  }

  /**
   * Verificar contraste WCAG AA (4.5:1 para texto normal)
   */
  verifyContrast() {
    const textElements = document.querySelectorAll('body, body *');
    let contrastIssues = 0;

    // Verificación simplificada: revisar variables CSS de contraste
    const style = getComputedStyle(document.documentElement);
    const bgBase = style.getPropertyValue('--bg-base').trim() || '#0F0F0D';
    const textColor = style.getPropertyValue('--text-1').trim() || '#F2F2EF';

    // Obtener luminancia relativa (CIE 1931)
    const getLuminance = (hex) => {
      const rgb = parseInt(hex.slice(1), 16);
      const r = (rgb >> 16) & 255;
      const g = (rgb >> 8) & 255;
      const b = rgb & 255;

      const luminance = (v) => {
        v = v / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };

      return luminance(r) * 0.2126 + luminance(g) * 0.7152 + luminance(b) * 0.0722;
    };

    try {
      const l1 = getLuminance(bgBase);
      const l2 = getLuminance(textColor);
      const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

      console.log(`✓ Color contrast ratio: ${contrast.toFixed(2)}:1 (WCAG ${contrast >= 4.5 ? 'AA ✓' : 'FAIL ✗'})`);
    } catch (e) {
      console.warn('Could not verify contrast ratio');
    }
  }

  /**
   * Mejorar navegación por teclado
   */
  enhanceKeyboardNavigation() {
    // Asegurar que todos los elementos interactivos sean focusables
    document.querySelectorAll('[role="button"]:not(button)').forEach(el => {
      if (!el.hasAttribute('tabindex')) {
        el.setAttribute('tabindex', '0');
      }

      // Agregar keydown listener para Enter y Space
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });

    // Focus visible indicator
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-nav');
    });

    console.log('✓ Keyboard navigation enhanced');
  }

  /**
   * Agregar skip link para saltar a contenido principal
   */
  addSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Saltar al contenido principal';
    skipLink.setAttribute('aria-label', 'Saltar al contenido principal');

    document.body.prepend(skipLink);

    // Agregar id al contenido principal si no existe
    const main = document.querySelector('.scroll-area') || document.querySelector('main');
    if (main && !main.id) {
      main.id = 'main-content';
    }

    console.log('✓ Skip link added');
  }

  /**
   * Monitor prefers-reduced-motion
   */
  monitorReducedMotion() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyReducedMotion = (matches) => {
      if (matches) {
        document.documentElement.style.setProperty('--transition-duration', '0.01ms');
        document.body.classList.add('reduced-motion');
      } else {
        document.documentElement.style.setProperty('--transition-duration', '220ms');
        document.body.classList.remove('reduced-motion');
      }
    };

    applyReducedMotion(prefersReduced.matches);
    prefersReduced.addEventListener('change', (e) => applyReducedMotion(e.matches));

    console.log('✓ Reduced motion monitor active');
  }

  /**
   * Annoucement para screen readers
   */
  announce(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remover después de ser leído
    setTimeout(() => announcement.remove(), 3000);
  }
}

window.AccessibilityManager = AccessibilityManager;
