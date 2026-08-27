Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   🚀 KHỞI ĐỘNG HỆ THỐNG ĐIỂM DANH KHUÔN MẶT IOT" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/3] Đang khởi động Backend Server (Port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$baseDir\backend'; node --watch server.js"

Start-Sleep -Seconds 2

Write-Host "[2/3] Đang khởi động React Dashboard (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$baseDir\dashboard'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "[3/3] Đang mở trình duyệt Web..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   ✅ Hệ thống đã được khởi động thành công!" -ForegroundColor Green
Write-Host "   🌐 Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "   📡 Backend: http://localhost:3001" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
