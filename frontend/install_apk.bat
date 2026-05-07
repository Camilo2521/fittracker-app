@echo off
echo ========================================
echo 📱 FitTracker v1.2 - Instalador APK
echo ========================================
echo.

cd /d "%~dp0"

echo 🔍 Verificando ADB...
if not exist "C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools\adb.exe" (
    echo ❌ ADB no encontrado. Instala Android SDK primero.
    pause
    exit /b 1
)

set ADB="C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo.
echo 📋 Verificando dispositivos conectados...
%ADB% devices
echo.

echo ⌛ Esperando dispositivo...
timeout 3 >nul

echo.
echo 🔍 Verificando conexión...
%ADB% shell echo "test" >nul 2>&1
if errorlevel 1 (
    echo ❌ No se puede conectar al dispositivo.
    echo.
    echo 💡 Soluciones:
    echo   1. Asegúrate de que el emulador esté ejecutándose
    echo   2. O conecta un dispositivo físico con USB debugging
    echo   3. Reinicia ADB: adb kill-server && adb start-server
    echo.
    pause
    exit /b 1
)

echo ✅ Dispositivo conectado correctamente.
echo.

echo 📦 Instalando FitTracker v1.2...
echo Ubicación APK: android\app\build\outputs\apk\debug\app-debug.apk
echo.

%ADB% install -r "android\app\build\outputs\apk\debug\app-debug.apk"

if errorlevel 1 (
    echo.
    echo ❌ Error durante la instalación.
    echo.
    echo 💡 Posibles soluciones:
    echo   1. Desinstala versión anterior: adb uninstall com.fittracker.app
    echo   2. Libera espacio en el dispositivo
    echo   3. Reinicia el dispositivo
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ ¡Instalación completada exitosamente!
echo.
echo 🎯 Próximos pasos:
echo   1. Abre FitTracker en tu dispositivo
echo   2. Otorga permisos de notificaciones cuando se pida
echo   3. Completa algunas tareas para probar las rachas
echo   4. Verifica las recomendaciones personalizadas
echo.
echo 📊 Información de la app:
echo   📦 Package: com.fittracker.app
echo   🔢 Versión: 1.2-debug
echo   📱 Min Android: 5.1 (API 22)
echo.

echo 🚀 ¡FitTracker está listo para usar!
echo.
pause