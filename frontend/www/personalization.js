/**
 * FitTracker Personalization System
 * Rutinas y recomendaciones dinámicas personalizadas
 */

class PersonalizationEngine {
  constructor() {
    this.initialized = false;
  }

  async init() {
    await DB.ready;
    this.initialized = true;
  }

  /**
   * Obtener perfil del usuario
   */
  async getUserProfile() {
    const goal = await API.getGoal();
    const weights = await API.getWeights(100);
    const workouts = await API.getWorkouts(30);
    const streaks = await STREAKS.getStreakStats();

    // Calcular nivel de actividad
    const activityLevel = this._calculateActivityLevel(workouts);

    // Calcular progreso real
    const progress = this._calculateRealProgress(weights, goal);

    // Calcular velocidad de progreso
    const velocity = this._calculateVelocity(weights);

    return {
      goal: goal?.goal || 'lose',
      targetWeight: goal?.targetWeight || 0,
      currentWeight: weights.length ? weights[0].value : 0,
      startWeight: goal?.startWeight || (weights.length ? weights[weights.length - 1].value : 0),
      activityLevel: activityLevel,
      progress: progress,
      velocity: velocity,
      streak: streaks.current,
      bestStreak: streaks.best,
      workoutsThisMonth: workouts.length
    };
  }

  /**
   * Obtener rutina personalizada
   */
  async getPersonalizedRoutine() {
    const profile = await this.getUserProfile();

    // Seleccionar rutina según objetivo
    let routine = null;

    if (profile.goal === 'lose') {
      routine = this._getWeightLossRoutine(profile.activityLevel);
    } else if (profile.goal === 'gain') {
      routine = this._getGainRoutine(profile.activityLevel);
    } else {
      routine = this._getMaintenanceRoutine(profile.activityLevel);
    }

    // Adaptar según progreso
    return this._adaptRoutineByProgress(routine, profile);
  }

  /**
   * Obtener recomendaciones nutricionales personalizadas
   */
  async getPersonalizedNutrition() {
    const profile = await this.getUserProfile();
    const recommendations = {};

    if (profile.goal === 'lose') {
      recommendations.macro = {
        protein: { percent: 40, grams: null },
        carbs: { percent: 35, grams: null },
        fats: { percent: 25, grams: null },
        focus: 'Alto en proteína para preservar masa muscular'
      };
      
      recommendations.meals = {
        breakfast: [
          'Huevos (2-3) + avena + frutas',
          'Yogurt griego + granola + berries',
          'Batido de proteína + plátano'
        ],
        lunch: [
          'Pechuga de pollo + arroz integral + vegetales',
          'Salmón + quinoa + ensalada',
          'Tilapia + batata + brócoli'
        ],
        dinner: [
          'Pechuga de pollo + vegetales sin carbs',
          'Tilapia + vegetales al vapor',
          'Huevos + espinacas + champiñones'
        ],
        snacks: [
          'Almendras (puñado)',
          'Proteína en polvo con agua',
          'Manzana con mantequilla de maní'
        ]
      };

      recommendations.tips = [
        'Crea un déficit calórico de 300-500 calorías',
        'Aumenta proteína para reducir hambre',
        'Come lentamente, mastica bien',
        'Toma agua antes de comer',
        'Come en pequeñas porciones 5-6 veces al día'
      ];
    } else if (profile.goal === 'gain') {
      recommendations.macro = {
        protein: { percent: 35, grams: null },
        carbs: { percent: 45, grams: null },
        fats: { percent: 20, grams: null },
        focus: 'Superávit calórico con énfasis en carbs complejos'
      };

      recommendations.meals = {
        breakfast: [
          'Avena + plátano + mantequilla de cacahuete + leche',
          'Pancakes integrales + miel + fruta',
          'Huevos + pan integral + aguacate'
        ],
        lunch: [
          'Pollo + arroz blanco + frijoles + aceite de oliva',
          'Carne roja magra + papa + vegetales',
          'Pasta integral + atún + vegetales'
        ],
        dinner: [
          'Pollo + camote + brócoli',
          'Lomo + arroz + lentejas',
          'Salmón + pasta + aguacate'
        ],
        snacks: [
          'Trail mix (frutos secos + chocolate)',
          'Batido: leche + proteína + plátano + mantequilla de maní',
          'Sándwich de atún con mayonesa',
          'Frutos secos y deshidratados'
        ]
      };

      recommendations.tips = [
        'Crea un superávit calórico de 300-500 calorías',
        'Come cada 3-4 horas',
        'Aumenta carbohidratos complejos',
        'No te saltes comidas',
        'Duerme 8+ horas para recuperación'
      ];
    } else {
      // Maintain
      recommendations.macro = {
        protein: { percent: 30, grams: null },
        carbs: { percent: 40, grams: null },
        fats: { percent: 30, grams: null },
        focus: 'Balance equilibrado de macronutrientes'
      };

      recommendations.meals = {
        breakfast: [
          'Huevos + pan integral + frutas',
          'Yogurt + granola + berries',
          'Batido + tostadas de aguacate'
        ],
        lunch: [
          'Pechuga de pollo + arroz + vegetales variados',
          'Salmón + quinoa + ensalada',
          'Pavo + papas + brócoli'
        ],
        dinner: [
          'Pescado blanco + vegetales al vapor + papa',
          'Pollo + arroz integral + ensalada',
          'Carne magra + camote + espinacas'
        ],
        snacks: [
          'Frutas frescas',
          'Frutos secos (puñado)',
          'Yogurt natural',
          'Almendras con pasas'
        ]
      };

      recommendations.tips = [
        'Mantén consistencia en porciones',
        'Varía tus alimentos regularmente',
        'Incluye todos los grupos alimenticios',
        'Come a horas regulares',
        'Disfruta la comida sin restricciones extremas'
      ];
    }

    return recommendations;
  }

  /**
   * Obtener recomendaciones de entrenamiento
   */
  async getPersonalizedTraining() {
    const profile = await this.getUserProfile();
    const training = {};

    if (profile.goal === 'lose') {
      training.focus = 'Quemar calorías + Preservar masa muscular';
      training.frequency = '4-5 días por semana';
      training.split = {
        monday: {
          type: 'Cardio + Núcleo',
          duration: '30-45 min',
          exercises: [
            'Cardio (trote, ciclismo, natación): 25-30 min',
            'Plancha: 3x45 seg',
            'Abdominales: 3x15 rep',
            'Sentadillas: 3x12 rep'
          ]
        },
        wednesday: {
          type: 'Fuerza - Tren Superior',
          duration: '40 min',
          exercises: [
            'Flexiones de brazos: 4x8-10',
            'Remo: 4x8-10',
            'Press de hombro: 3x10',
            'Curl de bíceps: 3x12'
          ]
        },
        friday: {
          type: 'Fuerza - Tren Inferior',
          duration: '40 min',
          exercises: [
            'Sentadillas: 4x10',
            'Levantamiento de cadera: 3x12',
            'Estocadas: 3x12 c/pierna',
            'Pantorrillas: 3x15'
          ]
        }
      };
    } else if (profile.goal === 'gain') {
      training.focus = 'Ganar masa muscular + Fuerza';
      training.frequency = '4-5 días por semana';
      training.split = {
        monday: {
          type: 'Pecho + Tríceps',
          duration: '50-60 min',
          exercises: [
            'Press de pecho: 4x6-8',
            'Flexiones inclinadas: 4x8',
            'Aperturas con mancuernas: 3x10',
            'Dips: 3x8-10'
          ]
        },
        wednesday: {
          type: 'Espalda + Bíceps',
          duration: '50-60 min',
          exercises: [
            'Peso muerto: 4x6-8',
            'Remo con barra: 4x8',
            'Jalones: 3x10',
            'Curl con barra: 3x8-10'
          ]
        },
        friday: {
          type: 'Piernas + Hombros',
          duration: '50-60 min',
          exercises: [
            'Sentadillas: 4x6-8',
            'Prensa de piernas: 4x8',
            'Press de hombro: 3x8',
            'Elevaciones laterales: 3x12'
          ]
        }
      };
    } else {
      training.focus = 'Mantener forma + Salud cardiovascular';
      training.frequency = '3-4 días por semana';
      training.split = {
        monday: {
          type: 'Cardio moderado',
          duration: '30 min',
          exercises: ['Caminar rápido o trotar a ritmo constante']
        },
        wednesday: {
          type: 'Fuerza ligera',
          duration: '30 min',
          exercises: [
            'Flexiones: 3x10',
            'Sentadillas: 3x12',
            'Plancha: 3x30 seg',
            'Abdominales: 3x10'
          ]
        },
        friday: {
          type: 'Yoga/Flexibilidad',
          duration: '30 min',
          exercises: ['Yoga o stretching completo']
        }
      };
    }

    return training;
  }

  /**
   * Cambiar meta sin afectar progreso
   */
  async updateGoalWithoutResetProgress(newGoal, newTargetWeight) {
    const currentGoal = await API.getGoal();
    const weights = await API.getWeights(100);
    
    // Guardar el peso de inicio de la meta anterior
    const startWeight = currentGoal?.startWeight || 
                       (weights.length ? weights[weights.length - 1].value : weights[0].value);

    // Crear nueva meta pero mantener el peso de inicio
    await API.setGoal(newGoal, newTargetWeight);

    // Guardar el peso inicial para mantener continuidad
    await API.setSetting('goal_start_weight', startWeight);

    return {
      success: true,
      message: 'Meta actualizada sin afectar progreso',
      oldGoal: currentGoal?.goal,
      newGoal: newGoal,
      startWeight: startWeight,
      newTarget: newTargetWeight
    };
  }

  /**
   * Calcular progreso real basado en peso inicial de la meta
   */
  async calculateRealProgress(weights, goal = null) {
    goal = goal || await API.getGoal();
    if (!goal || !weights?.length) return 0;

    const startWeight = await API.getSetting('goal_start_weight') || 
                       (weights[weights.length - 1]?.value || weights[0].value);
    const currentWeight = weights[0].value;
    const targetWeight = goal.targetWeight;

    if (goal.goal === 'lose') {
      const totalToLose = startWeight - targetWeight;
      const alreadyLost = startWeight - currentWeight;
      return Math.min(100, Math.max(0, Math.round((alreadyLost / totalToLose) * 100)));
    } else if (goal.goal === 'gain') {
      const totalToGain = targetWeight - startWeight;
      const alreadyGained = currentWeight - startWeight;
      return Math.min(100, Math.max(0, Math.round((alreadyGained / totalToGain) * 100)));
    } else {
      // maintain
      const difference = Math.abs(currentWeight - targetWeight);
      return Math.max(0, 100 - (difference * 10));
    }
  }

  /**
   * Métodos privados
   */
  
  _calculateActivityLevel(workouts) {
    if (!workouts?.length) return 'sedentary';
    
    const thisMonth = workouts.filter(w => {
      const d = new Date(w.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const perWeek = (thisMonth.length / 4.33); // promedio semanal
    
    if (perWeek >= 5) return 'very_active';
    if (perWeek >= 3) return 'active';
    if (perWeek >= 1) return 'light';
    return 'sedentary';
  }

  _calculateRealProgress(weights, goal) {
    if (!goal || !weights?.length) return 0;

    const startWeight = weights[weights.length - 1]?.value || weights[0].value;
    const currentWeight = weights[0].value;
    const targetWeight = goal.targetWeight;

    if (goal.goal === 'lose') {
      const totalToLose = startWeight - targetWeight;
      const alreadyLost = startWeight - currentWeight;
      return Math.min(100, Math.max(0, Math.round((alreadyLost / totalToLose) * 100)));
    } else if (goal.goal === 'gain') {
      const totalToGain = targetWeight - startWeight;
      const alreadyGained = currentWeight - startWeight;
      return Math.min(100, Math.max(0, Math.round((alreadyGained / totalToGain) * 100)));
    } else {
      const difference = Math.abs(currentWeight - targetWeight);
      return Math.max(0, 100 - (difference * 10));
    }
  }

  _calculateVelocity(weights) {
    if (weights?.length < 2) return 0;

    const recent = weights[0].value;
    const previous = weights[Math.min(6, weights.length - 1)].value;
    const change = previous - recent;

    // Asumir que es aproximadamente semanal
    return Math.round(change * 10) / 10; // kg/semana
  }

  _getWeightLossRoutine(activityLevel) {
    return {
      goal: 'lose',
      type: 'Cardio + Fuerza',
      frequency: activityLevel === 'sedentary' ? '3-4' : '4-5',
      cardio: {
        frequency: '4-5 días',
        duration: '30-45 min',
        intensity: 'moderado a alto',
        types: ['trotar', 'ciclismo', 'natación', 'HIIT']
      },
      strength: {
        frequency: '2-3 días',
        duration: '30-40 min',
        focus: 'preservar músculo',
        exercises: ['sentadillas', 'flexiones', 'remo', 'peso muerto']
      }
    };
  }

  _getGainRoutine(activityLevel) {
    return {
      goal: 'gain',
      type: 'Fuerza pesada',
      frequency: '4-5',
      focus: 'hipertrofia',
      sets: '3-4 sets',
      reps: '8-12 reps',
      rest: '60-90 segundos entre sets',
      exercises: [
        'Sentadillas',
        'Press de pecho',
        'Peso muerto',
        'Remo con barra',
        'Dips',
        'Flexiones inclinadas'
      ]
    };
  }

  _getMaintenanceRoutine(activityLevel) {
    return {
      goal: 'maintain',
      type: 'Balance',
      frequency: '3-4',
      cardio: '2-3 días x 20-30 min',
      strength: '2 días x 25-30 min',
      flexibility: '1 día - yoga/stretching',
      approach: 'consistencia sobre intensidad'
    };
  }

  _adaptRoutineByProgress(routine, profile) {
    const adapted = JSON.parse(JSON.stringify(routine));

    // Aumentar intensidad si está muy avanzado
    if (profile.progress > 75 && profile.velocity > 0.5) {
      adapted.note = 'Aumenta intensidad: progreso excelente';
    } else if (profile.progress < 25 && profile.velocity < 0.1) {
      adapted.note = 'Mantén consistencia: progreso lento pero seguro';
    }

    return adapted;
  }
}

// Create global instance
const PERSONALIZATION = new PersonalizationEngine();
