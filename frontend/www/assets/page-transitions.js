/**
 * Page Transition Manager
 * Maneja transiciones fluidas entre páginas con animaciones
 */

class PageTransitionManager {
  constructor() {
    this.currentPage = null;
    this.isTransitioning = false;
    this.transitionDuration = 220; // ms
  }

  /**
   * Navegar a una página con transición
   */
  async navigateTo(pageName) {
    if (this.isTransitioning || this.currentPage === pageName) {
      return;
    }

    this.isTransitioning = true;

    // Obtener elementos
    const currentPage = this.currentPage ? document.querySelector(`.page[data-page="${this.currentPage}"]`) : null;
    const nextPage = document.querySelector(`.page[data-page="${pageName}"]`);

    if (!nextPage) {
      console.error(`Page not found: ${pageName}`);
      this.isTransitioning = false;
      return;
    }

    // Exit animation de página actual
    if (currentPage) {
      currentPage.classList.remove('active');
      currentPage.classList.add('exit');
      
      // Esperar a que termine la animación
      await new Promise(resolve => 
        setTimeout(resolve, this.transitionDuration)
      );
      
      currentPage.classList.remove('exit');
    }

    // Enter animation de página nueva
    nextPage.classList.add('active');

    // Actualizar estado
    this.currentPage = pageName;
    this.isTransitioning = false;

    // Disparar evento
    window.dispatchEvent(new CustomEvent('pagechange', { 
      detail: { page: pageName } 
    }));
  }

  /**
   * Obtener página actual
   */
  getCurrentPage() {
    return this.currentPage;
  }
}

window.PageTransitionManager = PageTransitionManager;
