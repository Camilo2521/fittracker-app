/**
 * Pose Analyzer - Análisis de poses y ejercicios con IA
 * Usa MediaPipe para detectar poses y analizar técnica de ejercicios
 * Requires: mpTasksVision (MediaPipe Tasks Vision CDN bundle)
 */

class PoseAnalyzer {
  constructor() {
    this.poseLandmarker = null;
    this.isInitialized = false;
    this.exerciseHistory = [];
    this.currentExercise = null;
  }

  async initialize(wasmPath) {
    if (this.isInitialized) return;

    // Resolve wasm path from whichever version loaded
    if (!wasmPath) {
      const v = window.mpTasksVisionVersion || '0.10.14';
      wasmPath = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${v}/wasm`;
    }

    try {
      console.log('🔄 Inicializando analizador de poses...');

      const vision = window.mpTasksVision;
      if (!vision) throw new Error('MediaPipe Tasks Vision no disponible — pose analysis desactivado');

      const { FilesetResolver, PoseLandmarker } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(wasmPath);

      this.poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          delegate: 'GPU',
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isInitialized = true;
      console.log('✅ Analizador de poses inicializado');
    } catch (error) {
      console.error('❌ Error inicializando poses:', error);
      throw error;
    }
  }

  async analyzeFrame(videoElement) {
    if (!this.poseLandmarker) await this.initialize();

    try {
      const results = this.poseLandmarker.detectForVideo(
        videoElement,
        performance.now()
      );

      if (!results.landmarks || results.landmarks.length === 0) {
        return null;
      }

      const pose = results.landmarks[0];
      const metrics = this.extractExerciseMetrics(pose);

      // Agregar al historial para análisis de ejercicios
      this.exerciseHistory.push({
        timestamp: Date.now(),
        pose,
        metrics
      });

      // Mantener solo los últimos 100 frames
      if (this.exerciseHistory.length > 100) {
        this.exerciseHistory.shift();
      }

      return {
        landmarks: pose,
        metrics,
        exerciseAnalysis: this.analyzeCurrentExercise()
      };
    } catch (error) {
      console.error('Error analizando frame:', error);
      return null;
    }
  }

  extractExerciseMetrics(landmarks) {
    const angles = {
      // Brazos
      leftShoulder: this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
      rightShoulder: this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
      leftElbow: this.calculateAngle(landmarks[13], landmarks[11], landmarks[23]),
      rightElbow: this.calculateAngle(landmarks[14], landmarks[12], landmarks[24]),

      // Piernas
      leftHip: this.calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
      rightHip: this.calculateAngle(landmarks[12], landmarks[24], landmarks[26]),
      leftKnee: this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
      rightKnee: this.calculateAngle(landmarks[24], landmarks[26], landmarks[28]),

      // Columna y torso
      spine: this.calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
      neck: this.calculateAngle(landmarks[11], landmarks[12], landmarks[0])
    };

    const alignment = this.analyzeAlignment(landmarks);
    const postureScore = this.calculatePostureScore(angles, alignment);

    return {
      angles,
      alignment,
      postureScore,
      bodyPosition: this.classifyBodyPosition(angles),
      jointPositions: this.extractJointPositions(landmarks)
    };
  }

  calculateAngle(pointA, pointB, pointC) {
    const vectorBA = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
    const vectorBC = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };

    const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
    const magnitudeBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2);
    const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);

    const cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return (angle * 180) / Math.PI;
  }

  analyzeAlignment(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    return {
      shoulderLevel: Math.abs(leftShoulder.y - rightShoulder.y) < 0.05,
      hipLevel: Math.abs(leftHip.y - rightHip.y) < 0.05,
      kneeLevel: Math.abs(leftKnee.y - rightKnee.y) < 0.05,
      shoulderWidth: Math.abs(leftShoulder.x - rightShoulder.x),
      hipWidth: Math.abs(leftHip.x - rightHip.x),
      symmetry: this.calculateSymmetry(landmarks)
    };
  }

  calculateSymmetry(landmarks) {
    const leftPoints = [11, 13, 15, 23, 25, 27]; // Hombro izq, codo izq, muñeca izq, cadera izq, rodilla izq, tobillo izq
    const rightPoints = [12, 14, 16, 24, 26, 28]; // Correspondientes derechos

    let symmetryScore = 0;
    let totalComparisons = 0;

    leftPoints.forEach((leftIdx, i) => {
      const rightIdx = rightPoints[i];
      if (landmarks[leftIdx] && landmarks[rightIdx]) {
        const leftY = landmarks[leftIdx].y;
        const rightY = landmarks[rightIdx].y;
        const diff = Math.abs(leftY - rightY);
        symmetryScore += (diff < 0.1) ? 1 : 0;
        totalComparisons++;
      }
    });

    return totalComparisons > 0 ? (symmetryScore / totalComparisons) * 100 : 0;
  }

  calculatePostureScore(angles, alignment) {
    let score = 100;

    // Penalizar mala alineación
    if (!alignment.shoulderLevel) score -= 15;
    if (!alignment.hipLevel) score -= 15;
    if (!alignment.kneeLevel) score -= 10;

    // Penalizar ángulos extremos
    Object.values(angles).forEach(angle => {
      if (angle < 10 || angle > 170) score -= 5;
    });

    // Bonus por simetría
    score += (alignment.symmetry - 50) * 0.5;

    return Math.max(0, Math.min(100, score));
  }

  classifyBodyPosition(angles) {
    const { leftKnee, rightKnee, leftHip, rightHip, spine } = angles;

    // Detectar posiciones comunes
    if (leftKnee < 90 && rightKnee < 90) {
      return leftKnee < 60 ? 'deep_squat' : 'squat';
    }

    if (leftKnee > 160 && rightKnee > 160 && spine > 160) {
      return 'standing';
    }

    if (Math.abs(spine - 90) < 20) {
      return 'plank';
    }

    if (leftHip < 90 && rightHip < 90) {
      return 'lunge';
    }

    return 'other';
  }

  extractJointPositions(landmarks) {
    const joints = {
      nose: landmarks[0],
      leftEye: landmarks[1], rightEye: landmarks[2],
      leftEar: landmarks[3], rightEar: landmarks[4],
      leftShoulder: landmarks[11], rightShoulder: landmarks[12],
      leftElbow: landmarks[13], rightElbow: landmarks[14],
      leftWrist: landmarks[15], rightWrist: landmarks[16],
      leftHip: landmarks[23], rightHip: landmarks[24],
      leftKnee: landmarks[25], rightKnee: landmarks[26],
      leftAnkle: landmarks[27], rightAnkle: landmarks[28]
    };

    return joints;
  }

  analyzeCurrentExercise() {
    if (this.exerciseHistory.length < 10) return null;

    const recentFrames = this.exerciseHistory.slice(-10);
    const positions = recentFrames.map(f => f.metrics.bodyPosition);

    // Detectar patrón de ejercicio
    const squatCount = positions.filter(p => p === 'squat' || p === 'deep_squat').length;
    const plankCount = positions.filter(p => p === 'plank').length;

    if (squatCount > 5) {
      return this.analyzeSquatExercise(recentFrames);
    } else if (plankCount > 5) {
      return this.analyzePlankExercise(recentFrames);
    }

    return null;
  }

  analyzeSquatExercise(frames) {
    const kneeAngles = frames.map(f => (f.metrics.angles.leftKnee + f.metrics.angles.rightKnee) / 2);
    const minAngle = Math.min(...kneeAngles);
    const maxAngle = Math.max(...kneeAngles);

    const depth = Math.max(0, (170 - minAngle) / 170 * 100);
    const range = maxAngle - minAngle;

    let feedback = [];
    if (depth < 60) {
      feedback.push('Profundiza más en el squat para mayor activación muscular');
    } else if (depth > 100) {
      feedback.push('Excelente profundidad en el squat');
    }

    if (range < 80) {
      feedback.push('Aumenta el rango de movimiento');
    }

    return {
      exercise: 'squat',
      reps: this.countReps(frames, 'squat'),
      depth: depth.toFixed(1) + '%',
      quality: depth > 70 ? 'good' : 'needs_improvement',
      feedback
    };
  }

  analyzePlankExercise(frames) {
    const spineAngles = frames.map(f => f.metrics.angles.spine);
    const avgSpineAngle = spineAngles.reduce((a, b) => a + b, 0) / spineAngles.length;

    const alignment = frames[frames.length - 1].metrics.alignment;
    const duration = (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000;

    let feedback = [];
    if (Math.abs(avgSpineAngle - 180) > 20) {
      feedback.push('Mantén la espalda recta durante el plank');
    } else {
      feedback.push('Excelente alineación en el plank');
    }

    if (alignment.symmetry < 70) {
      feedback.push('Trabaja en mantener simetría corporal');
    }

    return {
      exercise: 'plank',
      duration: duration.toFixed(1) + 's',
      alignment: alignment.symmetry.toFixed(1) + '%',
      quality: alignment.symmetry > 80 ? 'good' : 'needs_improvement',
      feedback
    };
  }

  countReps(frames, exerciseType) {
    if (frames.length < 20) return 0;

    let reps = 0;
    let wasInPosition = false;

    frames.forEach(frame => {
      const isInPosition = frame.metrics.bodyPosition === exerciseType ||
                          (exerciseType === 'squat' && frame.metrics.bodyPosition === 'deep_squat');

      if (isInPosition && !wasInPosition) {
        reps++;
      }
      wasInPosition = isInPosition;
    });

    return reps;
  }

  // Métodos para ejercicios específicos
  startExerciseTracking(exerciseType) {
    this.currentExercise = {
      type: exerciseType,
      startTime: Date.now(),
      frames: [],
      metrics: []
    };
  }

  stopExerciseTracking() {
    if (!this.currentExercise) return null;

    const result = {
      ...this.currentExercise,
      endTime: Date.now(),
      duration: Date.now() - this.currentExercise.startTime,
      summary: this.summarizeExercise(this.currentExercise)
    };

    this.currentExercise = null;
    return result;
  }

  summarizeExercise(exercise) {
    const { type, frames } = exercise;

    switch (type) {
      case 'squat':
        return this.analyzeSquatExercise(frames);
      case 'plank':
        return this.analyzePlankExercise(frames);
      default:
        return { exercise: type, message: 'Análisis completado' };
    }
  }

  async saveExerciseSession(sessionData) {
    try {
      const sessionRecord = {
        type: 'exercise_session',
        data: sessionData,
        timestamp: new Date().toISOString()
      };
      await DB.add(STORES.exercises, sessionRecord);
      console.log('✅ Sesión de ejercicio guardada');

      // Sincronizar al backend (Phase 3+4)
      if (window.SYNC && sessionData) {
        const exerciseType = sessionData.exercise || sessionData.type || 'unknown';
        // Crear sesión (con fallback local si Python no está disponible)
        SYNC.startRepSession(exerciseType).then(session => {
          if (!session) return;
          return SYNC.completeRepSession(session.sessionId, {
            exerciseType,
            totalReps:      sessionData.reps      || 0,
            totalSets:      sessionData.sets       || 1,
            avgFormScore:   parseFloat(sessionData.depth || sessionData.alignment || 0),
            caloriesBurned: 0,
          });
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Error guardando sesión:', error);
      throw error;
    }
  }
}

window.PoseAnalyzer = new PoseAnalyzer();