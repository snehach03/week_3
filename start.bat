@echo off
echo ========================================================
echo      Tomorrow's Tray - AI Bakery Demand Forecasting
echo ========================================================
echo.
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Tomorrow's Tray Backend" cmd /k "cd /d %~dp0backend && python run_backend.py"

echo Starting Vite React Frontend on http://localhost:5173 ...
start "Tomorrow's Tray Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both services launched in separate windows!
echo Open your browser at: http://localhost:5173
echo.
pause
