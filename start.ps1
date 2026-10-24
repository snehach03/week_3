Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "     Tomorrow's Tray - AI Bakery Demand Forecasting" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host ""

$root = $PSScriptRoot

Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; python run_backend.py"

Write-Host "Starting Vite React Frontend on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Both services are now running!" -ForegroundColor Green
Write-Host "Open your browser at: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
