@echo off
title FitTracker - Iniciando servicios...
set "NODEJS=C:\Program Files\nodejs"
set "NPM_GLOBAL=C:\Users\camil\AppData\Roaming\npm"
set "PATH=%NODEJS%;%NPM_GLOBAL%;%PATH%"

REM Detectar Python dinámicamente (igual que electron/main.js)
set "PYTHON="
where python  >nul 2>&1 && set "PYTHON=python"
if not defined PYTHON where python3 >nul 2>&1 && set "PYTHON=python3"
if not defined PYTHON where py     >nul 2>&1 && set "PYTHON=py"

echo [1/3] Iniciando Backend Node.js (puerto 3000)...
start "Backend Node.js :3000" cmd /k "set PATH=%NODEJS%;%NPM_GLOBAL%;%%PATH%% && cd /d %~dp0backend && node src/app.js"

echo [2/3] Iniciando Frontend http-server (puerto 8080)...
start "Frontend :8080" cmd /k "set PATH=%NODEJS%;%NPM_GLOBAL%;%%PATH%% && cd /d %~dp0frontend\www && http-server -p 8080 --cors -c-1"

if defined PYTHON (
    echo [3/3] Iniciando Python FastAPI (puerto 8000)...
    start "Python FastAPI :8000" cmd /k "cd /d %~dp0python_service && %PYTHON% -m uvicorn app.main:app --reload --port 8000"
) else (
    echo [3/3] Python no encontrado, servicio de vision omitido.
    echo        Para activarlo: instala Python 3.x y ejecuta de nuevo.
)

echo.
echo Esperando que los servicios arranquen (5 seg)...
timeout /t 5 /nobreak >nul

echo Abriendo FitTracker en el navegador...
start http://localhost:8080

echo.
echo ============================================================
echo  FitTracker corriendo:
echo  App      -^>  http://localhost:8080
echo  Backend  -^>  http://localhost:3000
echo  Python   -^>  http://localhost:8000  (si disponible)
echo ============================================================
