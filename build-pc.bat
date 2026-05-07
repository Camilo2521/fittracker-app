@echo off
title FitTracker - Build Instalador Windows
set "NODEJS=C:\Program Files\nodejs"
set "NPM_GLOBAL=C:\Users\camil\AppData\Roaming\npm"
set "PATH=%NODEJS%;%NPM_GLOBAL%;%PATH%"

echo ============================================================
echo  FitTracker - Generando instalador para Windows
echo ============================================================
echo.

REM Check node
node --version >nul 2>&1
if %errorlevel% neq 0 ( echo [ERROR] Node.js no encontrado & pause & exit /b 1 )

echo [1/4] Instalando dependencias raiz (Electron)...
cd /d %~dp0
call npm install
if %errorlevel% neq 0 ( echo [ERROR] npm install fallido & pause & exit /b 1 )

echo.
echo [2/4] Instalando dependencias del backend...
cd /d %~dp0backend
call npm install
if %errorlevel% neq 0 ( echo [ERROR] backend npm install fallido & pause & exit /b 1 )

echo.
echo [3/4] Construyendo frontend (minificado)...
cd /d %~dp0frontend
call npm install
node scripts/build.js 2>nul
echo [OK] Frontend listo.

echo.
echo [4/4] Compilando instalador Electron para Windows...
cd /d %~dp0
call npx electron-builder build --win --publish never
if %errorlevel% neq 0 ( echo [ERROR] electron-builder fallido & pause & exit /b 1 )

echo.
echo ============================================================
echo  INSTALADOR GENERADO en: dist-electron\
echo  Archivo: FitTracker-Setup-1.0.0.exe
echo ============================================================
echo.
explorer dist-electron
pause
