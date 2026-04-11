# Pulse - Installation Windows
# Usage: powershell -ExecutionPolicy Bypass -File install-windows.ps1

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Pulse",
    [string]$GitHubRepo = "https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main"
)

$ErrorActionPreference = "Continue"

Write-Host "
  PULSE - Monitoring Reseau Intelligent
  Installation Windows
" -ForegroundColor Green

# 1. Deps Python
Write-Host "[1/4] Installation des dependances..." -ForegroundColor Cyan
pip install fastapi uvicorn ping3 manuf requests psutil python-nmap netifaces2 -q
npm install -g serve -q 2>&1 | Out-Null
Write-Host "  OK" -ForegroundColor Green

# 2. Telecharger Pulse depuis GitHub
Write-Host "[2/4] Telechargement de Pulse..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "$InstallDir\modules" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\agent" | Out-Null

$files = @(
    "api.py", "alerts.py", "config.py", "pulse_launcher.py",
    "modules/network.py", "modules/security.py", "modules/machines.py",
    "modules/services.py", "modules/wifi.py", "modules/snmp.py",
    "modules/__init__.py", "agent/agent.py"
)

foreach ($file in $files) {
    $dir = Split-Path "$InstallDir\$file" -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    try {
        Invoke-WebRequest -Uri "$GitHubRepo/$file" -OutFile "$InstallDir\$file" -UseBasicParsing
        Write-Host "  $file OK" -ForegroundColor Green
    } catch {
        Write-Host "  $file ERREUR" -ForegroundColor Yellow
    }
}

# Créer auth.json par défaut
$auth = '{"username":"admin","password":"240be518fabd2724ddb6f04eeb1da5967448d7e831d06d456aef69e7a346c510","token":"pulse-default-token-changeme"}'
Set-Content -Path "$InstallDir\auth.json" -Value $auth -Encoding UTF8
Write-Host "  auth.json cree (admin/admin123)" -ForegroundColor Green

# 3. Créer lanceur
Write-Host "[3/4] Creation du lanceur..." -ForegroundColor Cyan
$bat = "@echo off`r`ntitle Pulse`r`ncolor 0A`r`necho Pulse demarre...`r`ncd /d `"$InstallDir`"`r`nstart `"`" /B python -m uvicorn api:app --host 0.0.0.0 --port 8000`r`ntimeout /t 3 /nobreak > nul`r`nstart `"`" /B npx serve -s dashboard\build -l 3000`r`ntimeout /t 3 /nobreak > nul`r`nstart http://localhost:3000`r`npause`r`n"
Set-Content -Path "$InstallDir\Start-Pulse.bat" -Value $bat -Encoding ASCII

try {
    $WshShell = New-Object -comObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Pulse.lnk")
    $Shortcut.TargetPath = "$InstallDir\Start-Pulse.bat"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Save()
    Write-Host "  Raccourci bureau cree" -ForegroundColor Green
} catch {}

# 4. Agent
Write-Host "[4/4] Configuration agent..." -ForegroundColor Cyan
try {
    $action = New-ScheduledTaskAction -Execute "python" -Argument "$InstallDir\agent\agent.py"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    Register-ScheduledTask -TaskName "PulseAgent" -Action $action -Trigger $trigger -Force | Out-Null
    Write-Host "  Agent configure" -ForegroundColor Green
} catch {
    Write-Host "  Agent: lancer manuellement si besoin" -ForegroundColor Yellow
}

Write-Host "
  PULSE INSTALLE !
  Dashboard : http://localhost:3000
  Login     : admin / admin123
  Lancer    : bureau > Pulse
" -ForegroundColor Green

$open = Read-Host "Demarrer maintenant ? (O/N)"
if ($open -eq "O" -or $open -eq "o") {
    Start-Process "$InstallDir\Start-Pulse.bat"
}
