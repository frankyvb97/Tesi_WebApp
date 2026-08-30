$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Split-Path -Parent $ScriptDir)

$Host.UI.RawUI.WindowTitle = "Avvio WebApp DINOv3"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Avvio WebApp - Inferenza DINOv3 Kvasir-v2" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "[0/3] Inizializzazione configurazioni..."
python setup\setup_env.py

$VENV_DIR = "..\Progetto_Tesi\venv_tesi"
if (Test-Path "config\config.json") {
    $config = Get-Content "config\config.json" -Raw | ConvertFrom-Json
    if ($config.VENV_DIR) {
        $VENV_DIR = $config.VENV_DIR
    }
}

$activate_script = Join-Path $VENV_DIR "Scripts\Activate.ps1"
if (-Not (Test-Path $activate_script)) {
    Write-Host "[ERRORE] L'ambiente virtuale non e' stato trovato in '$VENV_DIR'." -ForegroundColor Red
    Write-Host "Per favore, esegui prima lo script setup_env.py nella cartella Progetto_Tesi."
    Write-Host ""
    Read-Host "Premi Invio per chiudere"
    exit 1
}

Write-Host "[1/3] Attivazione ambiente virtuale Python..."
. $activate_script

Write-Host "[2/3] Avvio del server Flask in corso..."
Write-Host "Apertura automatica del browser all'indirizzo http://127.0.0.1:5000..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Premere Ctrl+C per fermare il server." -ForegroundColor Yellow
Write-Host ""

# Background job che attende la disponibilità del server e apre il browser
Start-Job -ScriptBlock {
    param($url)
    $attempts = 0
    while ($attempts -lt 45) {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                Start-Process $url
                break
            }
        } catch { }
        $attempts++
    }
} -ArgumentList "http://127.0.0.1:5000" | Out-Null

try {
    python app.py
}
finally {
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Server fermato con successo." -ForegroundColor Green
    Read-Host "Premi Invio per terminare"
}
