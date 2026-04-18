@echo off
REM SafeEscape Quick Start Script for Windows

echo.
echo ============================================
echo  SafeEscape - Fire & Evacuation Simulator
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Installing Backend Dependencies...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Backend installation failed
    pause
    exit /b 1
)

echo [2/2] Installing Frontend Dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend installation failed
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Installation Complete!
echo ============================================
echo.
echo Next steps:
echo.
echo Terminal 1 - Run Backend:
echo   cd backend
echo   uvicorn main:app --reload --port 8000
echo.
echo Terminal 2 - Run Frontend:
echo   cd frontend
echo   npm run dev
echo.
echo Then open http://localhost:5173 in your browser
echo.
pause
