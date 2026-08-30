@echo off
cd /d "%~dp0.."
title Avvio EndoscopicApp
echo ==================================================
echo Avvio WebApp - EndoscopicApp
echo ==================================================

echo [0/3] Inizializzazione configurazioni...
python setup\setup_env.py

set VENV_DIR=..\Progetto_Tesi\venv_tesi
if exist "config\config.json" (
    for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-Content 'config\config.json' | ConvertFrom-Json).VENV_DIR" 2^>nul`) do (
        if not "%%a"=="" set VENV_DIR=%%a
    )
)

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [ERRORE] L'ambiente virtuale non e' stato trovato in "%VENV_DIR%".
    echo Per favore, esegui prima lo script setup_env.py nella cartella Progetto_Tesi.
    echo.
    echo Premi un tasto per chiudere...
    pause >nul
    exit /b 1
)

echo [1/3] Attivazione ambiente virtuale Python...
call "%VENV_DIR%\Scripts\activate.bat"

echo [2/3] Avvio del server Flask in corso...
echo Apertura automatica del browser all'indirizzo http://127.0.0.1:5000...
echo.
echo Premere Ctrl+C per fermare il server.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://127.0.0.1:5000"
python app.py

echo.
echo Premi un tasto per chiudere...
pause >nul
