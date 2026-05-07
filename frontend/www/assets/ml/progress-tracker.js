/**
 * Progress Tracker - Seguimiento de progreso físico con IA
 * Analiza cambios corporales y métricas de fitness a lo largo del tiempo
 * Requires: tf (TensorFlow.js CDN), bodySegmentation (@tensorflow-models/body-segmentation CDN)
 */

class ProgressTracker {
  constructor() {
    this.segmenter = null;
    this.isInitialized = false;
    this.bodyMetrics = {
      chest: [],
      waist: [],
      hips: [],
      thighs: [],
      arms: [],
      bodyFat: [],
      muscleMass: []
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔄 Inicializando tracker de progreso...');

      if (typeof tf === 'undefined') throw new Error('TensorFlow.js no disponible');
      if (typeof bodySegmentation === 'undefined') throw new Error('body-segmentation no disponible');

      await tf.setBackend('webgl');
      await tf.ready();

      this.segmenter = await bodySegmentation.createSegmenter(
        bodySegmentation.SupportedModels.BodyPix,
        {
          architecture: 'MobileNetV1',
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2
        }
      );

      this.isInitialized = true;
      console.log('✅ Tracker de progreso inicializado');
    } catch (error) {
      console.error('❌ Error inicializando progreso:', error);
      throw error;
    }
  }

  async analyzeBody(imageElement) {
    if (!this.segmenter) await this.initialize();

    try {
      const segmentation = await this.segmenter.segmentPeople(imageElement, {
        flipHorizontal: false,
        multiSegmentation: false,
        segmentBodyParts: true
      });

      if (!segmentation || segmentation.length === 0) {
        return { error: 'No se detectó persona en la imagen' };
      }

      const personSegmentation = segmentation[0];
      const metrics = this.extractBodyMetrics(personSegmentation, imageElement);

      // Comparar con mediciones anteriores
      const progress = await this.calculateProgress(metrics);

      return {
        currentMetrics: metrics,
        progress,
        recommendations: this.generateProgressRecommendations(progress),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error analizando cuerpo:', error);
      throw error;
    }
  }

  extractBodyMetrics(segmentation, imageElement) {
    const { width, height } = imageElement;
    const pixels = this.segmentationToPixels(segmentation, width, height);

    const metrics = {
      bodyOutline: this.extractBodyOutline(pixels, width, height),
      proportions: this.calculateBodyProportions(pixels, width, height),
      symmetry: this.analyzeBodySymmetry(pixels, width, height),
      estimatedMeasurements: this.estimateMeasurements(pixels, width, height)
    };

    return metrics;
  }

  segmentationToPixels(segmentation, width, height) {
    const pixels = new Uint8Array(width * height * 4);

    for (let i = 0; i < segmentation.data.length; i++) {
      const pixelIndex = i * 4;
      const isBody = segmentation.data[i] > 0.5;

      pixels[pixelIndex] = isBody ? 255 : 0;     // R
      pixels[pixelIndex + 1] = isBody ? 255 : 0; // G
      pixels[pixelIndex + 2] = isBody ? 255 : 0; // B
      pixels[pixelIndex + 3] = 255;              // A
    }

    return pixels;
  }

  extractBodyOutline(pixels, width, height) {
    const outline = {
      top: height,
      bottom: 0,
      left: width,
      right: 0,
      centerX: 0,
      centerY: 0
    };

    let bodyPixelCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const isBody = pixels[index] > 0;

        if (isBody) {
          outline.top = Math.min(outline.top, y);
          outline.bottom = Math.max(outline.bottom, y);
          outline.left = Math.min(outline.left, x);
          outline.right = Math.max(outline.right, x);

          outline.centerX += x;
          outline.centerY += y;
          bodyPixelCount++;
        }
      }
    }

    if (bodyPixelCount > 0) {
      outline.centerX /= bodyPixelCount;
      outline.centerY /= bodyPixelCount;
    }

    outline.width = outline.right - outline.left;
    outline.height = outline.bottom - outline.top;

    return outline;
  }

  calculateBodyProportions(pixels, width, height) {
    const outline = this.extractBodyOutline(pixels, width, height);

    // Estimar proporciones corporales
    const totalHeight = outline.height;
    const shoulderWidth = this.estimateShoulderWidth(pixels, width, height, outline);
    const waistWidth = this.estimateWaistWidth(pixels, width, height, outline);
    const hipWidth = this.estimateHipWidth(pixels, width, height, outline);

    return {
      height: totalHeight,
      shoulderToWaistRatio: shoulderWidth / waistWidth,
      waistToHipRatio: waistWidth / hipWidth,
      shoulderWidth,
      waistWidth,
      hipWidth,
      bodyShape: this.classifyBodyShape(shoulderWidth, waistWidth, hipWidth)
    };
  }

  estimateShoulderWidth(pixels, width, height, outline) {
    // Buscar la línea más ancha en la parte superior del torso
    let maxWidth = 0;
    const shoulderRegion = {
      top: outline.top,
      bottom: outline.top + (outline.height * 0.25)
    };

    for (let y = shoulderRegion.top; y < shoulderRegion.bottom; y++) {
      let left = width, right = 0;
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (pixels[index] > 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      maxWidth = Math.max(maxWidth, right - left);
    }

    return maxWidth;
  }

  estimateWaistWidth(pixels, width, height, outline) {
    // Buscar la línea más estrecha en la zona media
    let minWidth = width;
    const waistRegion = {
      top: outline.top + (outline.height * 0.4),
      bottom: outline.top + (outline.height * 0.6)
    };

    for (let y = waistRegion.top; y < waistRegion.bottom; y++) {
      let left = width, right = 0;
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (pixels[index] > 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      const currentWidth = right - left;
      if (currentWidth > 0) {
        minWidth = Math.min(minWidth, currentWidth);
      }
    }

    return minWidth;
  }

  estimateHipWidth(pixels, width, height, outline) {
    // Buscar la línea más ancha en la parte inferior
    let maxWidth = 0;
    const hipRegion = {
      top: outline.top + (outline.height * 0.7),
      bottom: outline.bottom
    };

    for (let y = hipRegion.top; y < hipRegion.bottom; y++) {
      let left = width, right = 0;
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (pixels[index] > 0) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      maxWidth = Math.max(maxWidth, right - left);
    }

    return maxWidth;
  }

  classifyBodyShape(shoulderWidth, waistWidth, hipWidth) {
    const shoulderToWaist = shoulderWidth / waistWidth;
    const waistToHip = waistWidth / hipWidth;

    if (shoulderToWaist > 1.1 && waistToHip < 0.9) {
      return 'inverted_triangle';
    } else if (shoulderToWaist < 0.95 && waistToHip > 1.1) {
      return 'pear';
    } else if (shoulderToWaist > 1.05 && waistToHip > 1.05) {
      return 'rectangle';
    } else if (waistToHip < 0.85) {
      return 'hourglass';
    } else {
      return 'balanced';
    }
  }

  analyzeBodySymmetry(pixels, width, height) {
    const outline = this.extractBodyOutline(pixels, width, height);
    const centerX = outline.centerX;

    let leftPixels = 0, rightPixels = 0;

    for (let y = outline.top; y < outline.bottom; y++) {
      for (let x = outline.left; x < outline.right; x++) {
        const index = (y * width + x) * 4;
        if (pixels[index] > 0) {
          if (x < centerX) leftPixels++;
          else rightPixels++;
        }
      }
    }

    const symmetryRatio = Math.min(leftPixels, rightPixels) / Math.max(leftPixels, rightPixels);
    return {
      symmetryScore: symmetryRatio * 100,
      leftPixels,
      rightPixels,
      balance: symmetryRatio > 0.9 ? 'good' : symmetryRatio > 0.8 ? 'fair' : 'needs_work'
    };
  }

  estimateMeasurements(pixels, width, height) {
    // Estimaciones aproximadas basadas en proporciones corporales
    // NOTA: Estas son estimaciones muy aproximadas y no reemplazan mediciones reales
    const outline = this.extractBodyOutline(pixels, width, height);

    // Asumir altura promedio de 170cm para escala
    const assumedHeightCm = 170;
    const pixelToCmRatio = assumedHeightCm / outline.height;

    const proportions = this.calculateBodyProportions(pixels, width, height);

    return {
      estimatedHeight: assumedHeightCm,
      estimatedChest: proportions.shoulderWidth * pixelToCmRatio * 1.2, // Ajuste aproximado
      estimatedWaist: proportions.waistWidth * pixelToCmRatio,
      estimatedHips: proportions.hipWidth * pixelToCmRatio,
      disclaimer: 'Estas son estimaciones aproximadas. Para mediciones precisas, usa una cinta métrica.'
    };
  }

  async calculateProgress(currentMetrics) {
    try {
      // Obtener mediciones anteriores de la base de datos
      const previousMeasurements = await this.getPreviousMeasurements();

      if (previousMeasurements.length === 0) {
        return {
          message: 'Primera medición registrada',
          changes: {},
          trend: 'baseline'
        };
      }

      const latestPrevious = previousMeasurements[previousMeasurements.length - 1];
      const changes = this.compareMeasurements(latestPrevious.metrics, currentMetrics);

      return {
        changes,
        trend: this.analyzeTrend(previousMeasurements),
        comparison: {
          previous: latestPrevious,
          current: currentMetrics
        }
      };
    } catch (error) {
      console.error('Error calculando progreso:', error);
      return { error: 'No se pudo calcular el progreso' };
    }
  }

  compareMeasurements(previous, current) {
    const changes = {};

    // Comparar proporciones
    if (previous.proportions && current.proportions) {
      changes.shoulderToWaistRatio = {
        previous: previous.proportions.shoulderToWaistRatio,
        current: current.proportions.shoulderToWaistRatio,
        change: current.proportions.shoulderToWaistRatio - previous.proportions.shoulderToWaistRatio
      };

      changes.waistToHipRatio = {
        previous: previous.proportions.waistToHipRatio,
        current: current.proportions.waistToHipRatio,
        change: current.proportions.waistToHipRatio - previous.proportions.waistToHipRatio
      };
    }

    // Comparar simetría
    if (previous.symmetry && current.symmetry) {
      changes.symmetryScore = {
        previous: previous.symmetry.symmetryScore,
        current: current.symmetry.symmetryScore,
        change: current.symmetry.symmetryScore - previous.symmetry.symmetryScore
      };
    }

    return changes;
  }

  analyzeTrend(measurements) {
    if (measurements.length < 2) return 'insufficient_data';

    const recent = measurements.slice(-3); // Últimas 3 mediciones
    const symmetryScores = recent.map(m => m.metrics.symmetry?.symmetryScore || 0);

    const avgChange = symmetryScores.reduce((acc, score, i) => {
      if (i === 0) return acc;
      return acc + (score - symmetryScores[i - 1]);
    }, 0) / (symmetryScores.length - 1);

    if (avgChange > 2) return 'improving';
    if (avgChange < -2) return 'declining';
    return 'stable';
  }

  generateProgressRecommendations(progress) {
    const recommendations = [];

    if (progress.trend === 'baseline') {
      recommendations.push({
        type: 'info',
        message: 'Esta es tu primera medición. Continúa tomando fotos regularmente para ver el progreso.',
        action: 'Programa recordatorios semanales para mediciones'
      });
    } else if (progress.trend === 'improving') {
      recommendations.push({
        type: 'positive',
        message: '¡Excelente progreso! Tus métricas corporales están mejorando.',
        action: 'Mantén tu rutina actual y continúa monitoreando'
      });
    } else if (progress.trend === 'declining') {
      recommendations.push({
        type: 'warning',
        message: 'Las métricas muestran un ligero declive. Revisa tu rutina de ejercicios.',
        action: 'Considera ajustar tu plan de entrenamiento o nutrición'
      });
    }

    if (progress.changes?.symmetryScore) {
      const symmetryChange = progress.changes.symmetryScore.change;
      if (symmetryChange < -5) {
        recommendations.push({
          type: 'suggestion',
          message: 'La simetría corporal ha disminuido. Incluye ejercicios unilaterales.',
          action: 'Agrega ejercicios como lunges, step-ups o remo unilateral'
        });
      }
    }

    return recommendations;
  }

  async getPreviousMeasurements() {
    try {
      const measurements = await DB.getAll(STORES.progressMeasurements);
      return measurements.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      console.error('Error obteniendo mediciones anteriores:', error);
      return [];
    }
  }

  async saveMeasurement(measurementData) {
    try {
      const measurementRecord = {
        type: 'progress_measurement',
        metrics: measurementData.currentMetrics,
        progress: measurementData.progress,
        recommendations: measurementData.recommendations,
        timestamp: new Date().toISOString()
      };
      await DB.add(STORES.progressMeasurements, measurementRecord);
      console.log('✅ Medición de progreso guardada');
    } catch (error) {
      console.error('Error guardando medición:', error);
      throw error;
    }
  }
}

window.ProgressTracker = new ProgressTracker();