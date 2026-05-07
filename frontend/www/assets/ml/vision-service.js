/**
 * Vision Service — orquestador de IA/visión para FitTracker.
 * Requiere: window.FoodDetector, window.PoseAnalyzer, window.ProgressTracker
 */

class VisionService {
  constructor() {
    this._initPromise   = null;   // mutex: evita doble inicialización
    this.isInitialized  = false;
    this.currentMode    = null;
    this.cameraStream   = null;
    this.videoElement   = null;
    this.canvasElement  = null;
    this.availableModels = { food: false, exercise: false, progress: false };
  }

  get Camera() {
    return (window.Capacitor?.Plugins?.Camera) || null;
  }

  // ── Init (con mutex) ─────────────────────────────────────────────────────────

  async initialize() {
    if (this.isInitialized) return;
    if (this._initPromise) return this._initPromise; // ya en curso

    this._initPromise = this._doInit();
    await this._initPromise;
  }

  async _doInit() {
    console.log('🔄 Inicializando servicios de visión...');

    const [foodResult, poseResult, progressResult] = await Promise.allSettled([
      window.FoodDetector?.initialize(),
      window.PoseAnalyzer?.initialize(),
      window.ProgressTracker?.initialize(),
    ]);

    this.availableModels.food     = foodResult.status     === 'fulfilled';
    this.availableModels.exercise = poseResult.status     === 'fulfilled';
    this.availableModels.progress = progressResult.status === 'fulfilled';

    if (!this.availableModels.food)     console.info('[Vision] Alimentos no disponible:', foodResult.reason?.message);
    if (!this.availableModels.exercise) console.info('[Vision] Poses no disponible (requiere MediaPipe):', poseResult.reason?.message);
    if (!this.availableModels.progress) console.info('[Vision] Progreso no disponible:', progressResult.reason?.message);

    this.isInitialized = true;
    console.log('✅ Servicios de visión:', this.availableModels);
  }

  // ── Análisis de imagen (foto) ─────────────────────────────────────────────

  async startCameraAnalysis(mode, options = {}) {
    await this.initialize();
    await this._ensureModel(mode);

    this.currentMode = mode;

    try {
      const imgSrc = this.Camera
        ? await this._captureNative(options)
        : await this._pickImageFromBrowser();

      const image = await this._loadImage(imgSrc);

      switch (mode) {
        case 'food':     return await window.FoodDetector.detectFood(image);
        case 'exercise': return await window.PoseAnalyzer.analyzeFrame(image);
        case 'progress': return await window.ProgressTracker.analyzeBody(image);
        default: throw new Error(`Modo no soportado: ${mode}`);
      }
    } catch (error) {
      // Rethrow with clean message; caller decides how to display it
      throw error;
    }
  }

  // ── Análisis de video (cámara en vivo) ───────────────────────────────────

  async startVideoAnalysis(mode, videoElement, canvasElement) {
    await this.initialize();
    await this._ensureModel(mode);

    this.currentMode   = mode;
    this.videoElement  = videoElement;
    this.canvasElement = canvasElement;

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Permiso de cámara denegado. Habilítalo en la configuración del navegador.');
      }
      throw new Error('No se pudo acceder a la cámara: ' + err.message);
    }

    this.cameraStream = stream;
    videoElement.srcObject = stream;
    await new Promise(resolve => { videoElement.onloadedmetadata = resolve; });

    this._startLoop(mode);
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Asegura que el modelo esté listo; reintenta si TF.js cargó después de init.
   */
  async _ensureModel(mode) {
    const modelKey = mode === 'exercise' ? 'exercise' : mode === 'progress' ? 'progress' : 'food';

    if (this.availableModels[modelKey]) return; // ya disponible

    // Reintento: puede que TF.js/MediaPipe terminaron de cargar
    try {
      if (mode === 'food')     await window.FoodDetector?.initialize();
      if (mode === 'exercise') await window.PoseAnalyzer?.initialize();
      if (mode === 'progress') await window.ProgressTracker?.initialize();
      this.availableModels[modelKey] = true;
    } catch (e) {
      const labels = { food: 'alimentos (TF.js/COCO-SSD)', exercise: 'poses (MediaPipe)', progress: 'progreso corporal' };
      throw new Error(`Modelo de ${labels[mode] || mode} no disponible. Comprueba tu conexión a internet.`);
    }
  }

  async _captureNative(options) {
    const { CameraResultType, CameraSource } = window.Capacitor.Plugins.Camera;
    const photo = await this.Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      direction: options.frontCamera ? 'FRONT' : 'REAR',
    });
    return photo.webPath;
  }

  _pickImageFromBrowser() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return reject(new Error('No se seleccionó imagen'));
        resolve(URL.createObjectURL(file));
      };
      input.click();
    });
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src     = src;
    });
  }

  _startLoop(mode) {
    const tick = async () => {
      if (!this.videoElement || !this.cameraStream) return;
      try {
        if (mode === 'exercise') {
          const result = await window.PoseAnalyzer.analyzeFrame(this.videoElement);
          this.drawPoseOverlay(result);
        }
      } catch { /* silent — frame errors are transient */ }
      if (this.cameraStream) requestAnimationFrame(tick);
    };
    tick();
  }

  // ── Dibujo de pose ───────────────────────────────────────────────────────

  drawPoseOverlay(poseData) {
    if (!this.canvasElement || !poseData) return;
    const ctx   = this.canvasElement.getContext('2d');
    const video = this.videoElement;

    this.canvasElement.width  = video.videoWidth;
    this.canvasElement.height = video.videoHeight;
    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    if (poseData.landmarks) {
      ctx.strokeStyle = '#5BBD72';
      ctx.lineWidth   = 2;
      const connections = [
        [11,12],[11,13],[13,15],[12,14],[14,16],
        [11,23],[12,24],[23,24],
        [23,25],[25,27],[24,26],[26,28],
      ];
      connections.forEach(([s, e]) => {
        const A = poseData.landmarks[s], B = poseData.landmarks[e];
        if (!A || !B) return;
        ctx.beginPath();
        ctx.moveTo(A.x * this.canvasElement.width, A.y * this.canvasElement.height);
        ctx.lineTo(B.x * this.canvasElement.width, B.y * this.canvasElement.height);
        ctx.stroke();
      });
      poseData.landmarks.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x * this.canvasElement.width, pt.y * this.canvasElement.height, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#5BBD72';
        ctx.fill();
      });
    }
  }

  // ── Control ──────────────────────────────────────────────────────────────

  stopAnalysis() {
    this.cameraStream?.getTracks().forEach(t => t.stop());
    this.cameraStream = null;
    this.currentMode  = null;
    this.videoElement = null;
    this.canvasElement = null;
  }

  async checkCameraPermissions() {
    if (!this.Camera) return true;
    try {
      const r = await this.Camera.checkPermissions();
      return r.camera === 'granted';
    } catch { return false; }
  }

  async requestCameraPermissions() {
    if (!this.Camera) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach(t => t.stop());
        return true;
      } catch { return false; }
    }
    try {
      const r = await this.Camera.requestPermissions();
      return r.camera === 'granted';
    } catch { return false; }
  }
}

window.VisionService = new VisionService();
