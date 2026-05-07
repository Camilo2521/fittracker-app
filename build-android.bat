@echo off
title FitTracker - Build Android APK
set "NODEJS=C:\Program Files\nodejs"
set "NPM_GLOBAL=C:\Users\camil\AppData\Roaming\npm"
set "PATH=%NODEJS%;%NPM_GLOBAL%;%PATH%"

echo ============================================================
echo  FitTracker - Build Android APK
echo ============================================================
echo.

REM Check Java
java -version >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Java no encontrado. Instala Java JDK 17 desde:
  echo         https://adoptium.net/temurin/releases/?version=17
  echo.
  pause
  exit /b 1
)

REM Check Android SDK (via ANDROID_HOME)
if "%ANDROID_HOME%"=="" (
  echo [WARN] ANDROID_HOME no definido. Buscando en ubicaciones comunes...
  if exist "C:\Users\%USERNAME%\AppData\Local\Android\Sdk" (
    set "ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk"
    set "PATH=%ANDROID_HOME%\tools;%ANDROID_HOME%\platform-tools;%PATH%"
    echo [OK] Android SDK encontrado en %ANDROID_HOME%
  ) else (
    echo [ERROR] Android SDK no encontrado. Instala Android Studio desde:
    echo         https://developer.android.com/studio
    pause
    exit /b 1
  )
)

echo [1/4] Instalando dependencias del frontend...
cd /d %~dp0frontend
call npm install
if %errorlevel% neq 0 ( echo [ERROR] npm install fallido & pause & exit /b 1 )

echo.
echo [2/4] Agregando plataforma Android (si no existe)...
if not exist "android" (
  call npx cap add android
  if %errorlevel% neq 0 ( echo [ERROR] cap add android fallido & pause & exit /b 1 )
)

echo.
echo [3/4] Sincronizando archivos web con Android...
call npx cap sync android
if %errorlevel% neq 0 ( echo [ERROR] cap sync fallido & pause & exit /b 1 )

echo.
echo [4/4] Compilando APK de debug...
cd /d %~dp0frontend\android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 ( echo [ERROR] Gradle build fallido & pause & exit /b 1 )

echo.
echo ============================================================
echo  APK generado en:
echo  frontend\android\app\build\outputs\apk\debug\app-debug.apk
echo ============================================================
echo.
echo Copiando APK al directorio raiz...
copy "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0FitTracker.apk"
echo [OK] FitTracker.apk listo para instalar en tu telefono Android.
echo.
pause
