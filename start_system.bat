@echo off
title IoT Face Attendance Launcher

echo ========================================================
echo   KHOI DONG HE THONG DIEM DANH KHUON MAT IOT
echo ========================================================
echo.

echo [1/3] Khoi dong Backend Server (Port 3001)...
start "IoT_Backend" /D "%~dp0backend" cmd /k "node server.js"

timeout /t 2 /nobreak > nul

echo [2/3] Khoi dong React Dashboard (Port 5173)...
start "IoT_Dashboard" /D "%~dp0dashboard" cmd /k "npm run dev"

timeout /t 3 /nobreak > nul

echo [3/3] Dang mo trinh duyet Web...
start http://localhost:5173

echo.
echo ========================================================
echo   He thong da duoc khoi dong thanh cong!
echo   - Dashboard: http://localhost:5173
echo   - Backend API: http://localhost:3001
echo ========================================================
echo.
timeout /t 5 > nul
