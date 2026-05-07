# Retorno del Extremo — Cómo obtener el APK

## Pasos (15 minutos, todo gratis)

---

### PASO 1 — Crear cuenta en GitHub
1. Ve a https://github.com
2. Clic en **Sign up** — registra una cuenta gratis
3. Confirma tu email

---

### PASO 2 — Crear repositorio
1. Una vez dentro de GitHub, clic en el botón verde **"New"** (esquina superior izquierda)
2. Nombre del repositorio: `extremo-app`
3. Selecciona **Public**
4. Clic en **"Create repository"**

---

### PASO 3 — Subir los archivos
1. En la página de tu nuevo repositorio, clic en **"uploading an existing file"**
2. Descomprime el ZIP que descargaste
3. Arrastra **TODA** la carpeta descomprimida al área de GitHub
4. Clic en **"Commit changes"** (botón verde abajo)

---

### PASO 4 — Esperar la compilación (5-10 minutos)
1. Ve a la pestaña **"Actions"** de tu repositorio
2. Verás un workflow corriendo llamado **"Build Android APK"**
3. Espera a que el círculo amarillo se vuelva verde ✓
4. Si se pone rojo, abre el workflow y lee el error (escríbeme y lo resuelvo)

---

### PASO 5 — Descargar el APK
1. Clic en el workflow completado (el verde)
2. Baja hasta la sección **"Artifacts"**
3. Clic en **"extremo-app-debug"** — se descarga un ZIP
4. Descomprime ese ZIP → adentro está el archivo **`app-debug.apk`**

---

### PASO 6 — Instalar en tu Android
1. Pasa el APK a tu teléfono (WhatsApp, cable USB, Google Drive, etc.)
2. En tu Android: **Ajustes → Seguridad → Instalar apps de fuentes desconocidas** → Activar
3. Abre el archivo APK desde el teléfono
4. Toca **"Instalar"**
5. La app aparece en tu pantalla de inicio como **"Extremo"**

---

## ¿Algo salió mal?
- Si el workflow falla → ve a la pestaña Actions, abre el error y mándame captura
- Si el APK no instala → verifica que activaste "fuentes desconocidas" en tu Android

---

## Estructura del proyecto
```
extremo-app/
├── www/
│   ├── index.html        ← App completa
│   ├── assets/
│   │   └── ml/           ← Módulos de IA
│   │       ├── vision-service.js     ← Orquestador principal
│   │       ├── food-detector.js      ← Análisis de alimentos
│   │       ├── pose-analyzer.js      ← Corrección de ejercicios
│   │       └── progress-tracker.js   ← Seguimiento corporal
│   └── icons/            ← Iconos de la app
├── .github/
│   └── workflows/
│       └── build-apk.yml ← Compilación automática
├── capacitor.config.json ← Configuración Android
├── package.json          ← Dependencias
└── README.md             ← Este archivo
```

---

## 🤖 Funcionalidades de Inteligencia Artificial

### 📷 Análisis de Alimentos
- **Detección automática**: Identifica más de 20 tipos de alimentos usando IA
- **Análisis nutricional**: Calcula calorías, proteínas, carbohidratos y grasas
- **Recomendaciones**: Sugerencias personalizadas basadas en tus metas
- **Historial**: Guarda todos tus análisis para seguimiento

### 🏃 Corrección de Forma en Ejercicios
- **Análisis en tiempo real**: Usa la cámara para corregir tu técnica
- **Detección de poses**: Reconoce squats, planks y otros ejercicios
- **Medición de ángulos**: Monitorea la posición de rodillas, hombros y cadera
- **Feedback visual**: Overlay en video con correcciones
- **Conteo automático**: Cuenta repeticiones y calidad del movimiento

### 📊 Seguimiento de Progreso Corporal
- **Análisis de simetría**: Detecta desequilibrios musculares
- **Proporciones corporales**: Mide ratios cintura/cadera, hombros/cintura
- **Tendencias**: Compara mediciones a lo largo del tiempo
- **Recomendaciones**: Sugerencias basadas en cambios detectados

### 🔧 Tecnologías Utilizadas
- **TensorFlow.js**: Framework de machine learning para web
- **MediaPipe**: Librería de Google para análisis de poses
- **Capacitor Camera**: Plugin nativo para acceso a cámara
- **WebGL**: Aceleración hardware para modelos ML
- **IndexedDB**: Cache inteligente de modelos

### 📱 Requisitos
- **Android**: 5.0+ (API 21+)
- **Cámara**: Permisos necesarios para análisis
- **Conexión**: Primera carga requiere internet para descargar modelos
- **Almacenamiento**: ~50MB para modelos ML (cacheados localmente)

---
