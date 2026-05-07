/**
 * Service Container (Simple Dependency Injection)
 * Reemplaza globals con inyección controlada de dependencias
 */

class ServiceContainer {
  constructor() {
    this._services = new Map();
    this._singletons = new Map();
  }

  /**
   * Registra una factory o instancia como servicio
   * @param {string} name - Nombre del servicio
   * @param {Function|Object} factory - Factory function o instancia singleton
   * @param {boolean} singleton - Si es true, solo se crea una instancia
   */
  register(name, factory, singleton = true) {
    if (singleton && typeof factory === 'function') {
      this._services.set(name, factory);
    } else if (singleton) {
      // Si es un objeto, guárdalo como singleton
      this._singletons.set(name, factory);
    } else {
      this._services.set(name, factory);
    }
  }

  /**
   * Obtiene una instancia del servicio
   * @param {string} name - Nombre del servicio
   * @returns {Object} Instancia del servicio
   */
  get(name) {
    if (this._singletons.has(name)) {
      return this._singletons.get(name);
    }

    const factory = this._services.get(name);
    if (!factory) {
      throw new Error(`Service not found: ${name}`);
    }

    if (typeof factory === 'function') {
      const instance = factory();
      // Cachear como singleton la primera vez
      this._singletons.set(name, instance);
      return instance;
    }

    return factory;
  }

  /**
   * Verifica si un servicio existe
   */
  has(name) {
    return this._services.has(name) || this._singletons.has(name);
  }

  /**
   * Limpia todos los servicios (útil para testing)
   */
  clear() {
    this._services.clear();
    this._singletons.clear();
  }
}

// Crear contenedor global
window.AppServices = new ServiceContainer();

/**
 * Result Pattern para manejo de errores async
 * Retorna {ok: true, data: ...} o {ok: false, error: "mensaje"}
 */
function Result(ok, dataOrError) {
  return { ok, data: dataOrError };
}

Result.ok = (data) => Result(true, data);
Result.err = (error) => Result(false, error instanceof Error ? error.message : String(error));

/**
 * Wrapper para operaciones unsafe
 */
async function tryCatch(fn, context = null) {
  try {
    const result = await fn.call(context);
    return Result.ok(result);
  } catch (e) {
    console.error(e);
    return Result.err(e);
  }
}

window.Result = Result;
window.tryCatch = tryCatch;
