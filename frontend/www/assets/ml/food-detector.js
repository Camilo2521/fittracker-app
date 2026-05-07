/**
 * Food Detector - Detección y análisis de alimentos con IA
 * Usa COCO-SSD para identificar alimentos y estimar nutrición
 * Requires: tf (TensorFlow.js CDN), cocoSsd (@tensorflow-models/coco-ssd CDN)
 */

class FoodDetector {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.foodDatabase = {
      'apple': { calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4 },
      'banana': { calories: 105, protein: 1.3, carbs: 27, fat: 0.3, fiber: 3.1 },
      'orange': { calories: 47, protein: 0.9, carbs: 12, fat: 0.3, fiber: 2.4 },
      'pizza': { calories: 285, protein: 12, carbs: 36, fat: 10, fiber: 2.5 },
      'sandwich': { calories: 350, protein: 15, carbs: 45, fat: 12, fiber: 3 },
      'cake': { calories: 412, protein: 5, carbs: 48, fat: 18, fiber: 1 },
      'hot dog': { calories: 150, protein: 5, carbs: 2, fat: 13, fiber: 0 },
      'carrot': { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8 },
      'broccoli': { calories: 55, protein: 3.7, carbs: 11, fat: 0.6, fiber: 5.1 },
      'chicken': { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
      'fish': { calories: 206, protein: 22, carbs: 0, fat: 12, fiber: 0 },
      'rice': { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
      'pasta': { calories: 157, protein: 5.8, carbs: 31, fat: 0.9, fiber: 1.8 },
      'bread': { calories: 265, protein: 9, carbs: 49, fat: 3.2, fiber: 2.7 },
      'cheese': { calories: 402, protein: 7, carbs: 3.4, fat: 33, fiber: 0 },
      'milk': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0 },
      'egg': { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0 },
      'salad': { calories: 50, protein: 2, carbs: 8, fat: 1, fiber: 2 },
      'soup': { calories: 70, protein: 3, carbs: 10, fat: 2, fiber: 1 },
      'yogurt': { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0 }
    };
  }

  async initialize() {
    if (this.model) return;

    this.isLoading = true;
    try {
      if (typeof tf === 'undefined') throw new Error('TensorFlow.js no disponible');
      if (typeof cocoSsd === 'undefined') throw new Error('COCO-SSD no disponible');

      await tf.setBackend('webgl');
      await tf.ready();

      this.model = await cocoSsd.load();
      console.log('✅ Modelo COCO-SSD para alimentos cargado');
    } catch (error) {
      console.error('❌ Error cargando modelo de alimentos:', error);
      this.isLoading = false;
      throw error;
    }
    this.isLoading = false;
  }

  async detectFood(imageElement) {
    if (!this.model || this.isLoading) {
      await this.initialize();
    }

    try {
      const predictions = await this.model.estimateObjects(imageElement);

      // Filtrar solo alimentos con confianza > 0.5
      const foodItems = predictions.filter(pred => {
        const foodClasses = Object.keys(this.foodDatabase);
        return foodClasses.includes(pred.class) && pred.score > 0.5;
      });

      return this.processDetections(foodItems);
    } catch (error) {
      console.error('Error detectando alimentos:', error);
      throw error;
    }
  }

  processDetections(detections) {
    const mealAnalysis = {
      items: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      detectionTime: new Date(),
      confidence: 0,
      recommendations: []
    };

    detections.forEach(detection => {
      const foodInfo = this.foodDatabase[detection.class] || {};
      const quantity = this.estimateQuantity(detection.bbox);

      const item = {
        name: detection.class,
        confidence: (detection.score * 100).toFixed(1) + '%',
        boundingBox: detection.bbox,
        estimatedQuantity: quantity,
        servingSize: this.getServingSize(detection.class, quantity),
        ...foodInfo
      };

      // Ajustar nutrientes por cantidad
      const multiplier = this.getQuantityMultiplier(quantity);
      item.calories *= multiplier;
      item.protein *= multiplier;
      item.carbs *= multiplier;
      item.fat *= multiplier;
      item.fiber *= multiplier;

      mealAnalysis.items.push(item);

      // Sumar totales
      mealAnalysis.totalCalories += item.calories;
      mealAnalysis.totalProtein += item.protein;
      mealAnalysis.totalCarbs += item.carbs;
      mealAnalysis.totalFat += item.fat;
      mealAnalysis.totalFiber += item.fiber;
    });

    // Calcular confianza promedio
    if (mealAnalysis.items.length > 0) {
      mealAnalysis.confidence = (
        mealAnalysis.items.reduce((sum, item) =>
          sum + parseFloat(item.confidence), 0
      ) / mealAnalysis.items.length
      ).toFixed(1) + '%';
    }

    // Generar recomendaciones
    mealAnalysis.recommendations = this.generateNutritionRecommendations(mealAnalysis);

    return mealAnalysis;
  }

  estimateQuantity(bbox) {
    // bbox = [x, y, width, height]
    const area = bbox[2] * bbox[3];

    // Estimación basada en área del bounding box
    if (area > 15000) return 'Large';
    if (area > 8000) return 'Medium';
    if (area > 3000) return 'Small';
    return 'Very Small';
  }

  getServingSize(food, quantity) {
    const servingSizes = {
      'apple': { Small: '1 small (150g)', Medium: '1 medium (180g)', Large: '1 large (220g)' },
      'banana': { Small: '1 small (100g)', Medium: '1 medium (120g)', Large: '1 large (150g)' },
      'orange': { Small: '1 small (130g)', Medium: '1 medium (150g)', Large: '1 large (180g)' },
      'pizza': { Small: '1/4 slice', Medium: '1/2 slice', Large: '1 slice' },
      'sandwich': { Small: '1/2 sandwich', Medium: '1 sandwich', Large: '1.5 sandwiches' },
      'cake': { Small: '1/8 slice', Medium: '1/4 slice', Large: '1/2 slice' }
    };

    return servingSizes[food]?.[quantity] || `${quantity.toLowerCase()} serving`;
  }

  getQuantityMultiplier(quantity) {
    const multipliers = {
      'Very Small': 0.5,
      'Small': 0.75,
      'Medium': 1,
      'Large': 1.5
    };
    return multipliers[quantity] || 1;
  }

  generateNutritionRecommendations(meal) {
    const recommendations = [];

    // Análisis de balance calórico
    if (meal.totalCalories > 800) {
      recommendations.push({
        type: 'warning',
        message: 'Esta comida tiene muchas calorías. Considera porciones más pequeñas.',
        suggestion: 'Reduce el tamaño de las porciones en un 20-30%'
      });
    } else if (meal.totalCalories < 300) {
      recommendations.push({
        type: 'info',
        message: 'Esta comida es ligera. Podrías agregar más vegetales o proteínas.',
        suggestion: 'Agrega verduras, frutas o proteínas magras'
      });
    }

    // Análisis de macronutrientes
    const proteinPercentage = (meal.totalProtein * 4 / meal.totalCalories) * 100;
    if (proteinPercentage < 15) {
      recommendations.push({
        type: 'suggestion',
        message: 'Bajo en proteínas. Considera agregar carne magra, pescado o legumbres.',
        suggestion: 'Incluye 100-150g de proteína magra'
      });
    }

    const carbPercentage = (meal.totalCarbs * 4 / meal.totalCalories) * 100;
    if (carbPercentage > 70) {
      recommendations.push({
        type: 'suggestion',
        message: 'Alto en carbohidratos. Equilibra con más proteínas y vegetales.',
        suggestion: 'Agrega proteínas y vegetales a tu plato'
      });
    }

    // Análisis de fibra
    if (meal.totalFiber < 5) {
      recommendations.push({
        type: 'suggestion',
        message: 'Bajo en fibra. Incluye más frutas, verduras y granos enteros.',
        suggestion: 'Agrega frutas, verduras o granos enteros'
      });
    }

    // Recomendaciones positivas
    if (meal.items.some(item => ['broccoli', 'carrot', 'salad'].includes(item.name))) {
      recommendations.push({
        type: 'positive',
        message: '¡Excelente! Incluyes vegetales saludables.',
        suggestion: 'Mantén esta buena costumbre'
      });
    }

    return recommendations;
  }

  async saveMealAnalysis(mealData) {
    try {
      const mealRecord = {
        type: 'meal_analysis',
        data: mealData,
        timestamp: new Date().toISOString()
      };
      await DB.add(STORES.meals, mealRecord);
      console.log('✅ Análisis de comida guardado');

      // Sincronizar al backend (Phase 3): un registro por alimento detectado
      if (window.SYNC && mealData?.items?.length) {
        const date = new Date().toISOString().split('T')[0];
        for (const item of mealData.items) {
          SYNC.syncDetectedMeal({
            name:       item.name,
            date,
            calories:   Math.round(item.calories  || 0),
            protein:    Math.round((item.protein   || 0) * 10) / 10,
            carbs:      Math.round((item.carbs     || 0) * 10) / 10,
            fat:        Math.round((item.fat       || 0) * 10) / 10,
            confidence: parseFloat(item.confidence) || null,
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error guardando análisis:', error);
      throw error;
    }
  }
}

window.FoodDetector = new FoodDetector();