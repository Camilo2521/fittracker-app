/**
 * Lazy Loader for Chart.js
 * Carga Chart.js solo cuando sea necesario (en Dashboard/Stats)
 * Reduce carga inicial de ~1.5s a ~300ms
 */

class ChartLoader {
  static _loaded = false;
  static _loading = null;

  static async load() {
    // Si ya está cargado, retorna el objeto global
    if (typeof Chart !== 'undefined') {
      return Chart;
    }

    // Si ya está cargando, espera y retorna
    if (this._loading) {
      return this._loading;
    }

    // Inicia la carga
    this._loading = this._doLoad();
    return this._loading;
  }

  static async _doLoad() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
      script.async = true;
      script.onload = () => {
        this._loaded = true;
        this._loading = null;
        resolve(window.Chart);
      };
      script.onerror = () => {
        this._loading = null;
        reject(new Error('Failed to load Chart.js'));
      };
      document.head.appendChild(script);
    });
  }

  static isLoaded() {
    return typeof Chart !== 'undefined';
  }
}

// Exportar para uso global
window.ChartLoader = ChartLoader;
