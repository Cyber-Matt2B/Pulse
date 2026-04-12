# ============================================
# Pulse - Agent Windows
# ============================================
# Installe uniquement l'agent de monitoring
# sur une machine Windows
# ============================================
# Usage :
# powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main/install-agent-windows.ps1 | iex"
# ============================================

param(
    [string]$PulseServer = "",
    [string]$AgentDir = "$env:LOCALAPPDATA\PulseAgent"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ____  _   _ _     ____  _____" -ForegroundColor Green
    Write-Host " |  _ \| | | | |   / ___|| ____|" -ForegroundColor Green
    Write-Host " | |_) | | | | |   \___ \|  _|  " -ForegroundColor Green
    Write-Host " |  __/| |_| | |___ ___) | |___  " -ForegroundColor Green
    Write-Host " |_|    \___/|_____|____/|_____|" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Pulse Agent - Installation Windows" -ForegroundColor Cyan
    Write-Host ""
}

function Get-PythonCmd {
    foreach ($cmd in @("python3", "py", "python")) {
        try {
            $v = & $cmd --version 2>&1
            if ($v -match "Python 3\.\d+") { return $cmd }
        } catch {}
    }
    return $null
}

Write-Header

# Demander l'IP du serveur Pulse
if (-not $PulseServer) {
    $PulseServer = Read-Host "  IP du serveur Pulse (ex: 192.168.1.16)"
}
$PulseAPI = "http://$PulseServer`:8000"

Write-Host "`n[1/3] Verification Python..." -NoNewline
$pyCmd = Get-PythonCmd
if (-not $pyCmd) {
    Write-Host " Installation..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $tmp -UseBasicParsing
    Start-Process -FilePath $tmp -Args "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
    Remove-Item $tmp -Force
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    $pyCmd = Get-PythonCmd
}
Write-Host " OK" -ForegroundColor Green

Write-Host "[2/3] Installation dependances..." -NoNewline
& $pyCmd -m pip install psutil requests -q 2>&1 | Out-Null
Write-Host " OK" -ForegroundColor Green

Write-Host "[3/3] Installation de l'agent..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null

$agentScript = @"
import time, socket, platform, datetime, subprocess, sys, os
try:
    import psutil, requests
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'psutil', 'requests', '-q'])
    import psutil, requests

PULSE_API = "$PulseAPI"
INTERVAL = 60

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except: return "127.0.0.1"

def send():
    data = {
        "ip": get_ip(),
        "hostname": socket.gethostname(),
        "cpu_percent": psutil.cpu_percent(interval=1),
        "ram_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage("C:\\").percent,
        "uptime": str(datetime.datetime.now() - datetime.datetime.fromtimestamp(psutil.boot_time())).split(".")[0],
        "os": f"{platform.system()} {platform.release()}"
    }
    try:
        requests.post(f"{PULSE_API}/api/agent/push", json=data, timeout=5)
        requests.post(f"{PULSE_API}/api/agent/ping", json={"ip": data["ip"]}, timeout=3)
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] OK CPU:{data['cpu_percent']}% RAM:{data['ram_percent']}%")
    except Exception as e:
        print(f"Erreur: {e}")

print(f"Pulse Agent - {PULSE_API}")
print(f"Machine: {socket.gethostname()} ({get_ip()})")
while True:
    send()
    time.sleep(INTERVAL)
"@

Set-Content -Path "$AgentDir\pulse-agent.py" -Value $agentScript -Encoding UTF8

# Tâche planifiée
try {
    $action = New-ScheduledTaskAction -Execute $pyCmd -Argument "$AgentDir\pulse-agent.py"
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName "PulseAgent" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "  Agent configure (demarre au demarrage)" -ForegroundColor Green
} catch {
    Write-Host "  Lancer manuellement : $pyCmd $AgentDir\pulse-agent.py" -ForegroundColor Yellow
}

# Démarrer l'agent maintenant
Start-Process $pyCmd -ArgumentList "$AgentDir\pulse-agent.py" -WindowStyle Minimized

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "  PULSE AGENT INSTALLE !" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "  Serveur : $PulseAPI" -ForegroundColor White
Write-Host "  Agent   : demarre en arriere-plan" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Green
