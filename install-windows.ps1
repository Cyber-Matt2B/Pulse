# ============================================
# Pulse - Installation Windows v1.2
# ============================================
# One-liner :
# powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main/install-windows.ps1 | iex"
# ============================================

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Pulse",
    [string]$GitHubBase = "https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main",
    [string]$ReleaseBase = "https://github.com/Cyber-Matt2B/Pulse/releases/latest/download"
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
    Write-Host "  Monitoring Reseau Intelligent v1.2" -ForegroundColor Cyan
    Write-Host "  Installation Windows" -ForegroundColor Cyan
    Write-Host ""
}

function Reload-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Get-PythonCmd {
    foreach ($cmd in @("python3", "py", "python")) {
        try {
            $v = & $cmd --version 2>&1
            if ($v -match "Python 3\.\d+") { return $cmd }
        } catch {}
    }
    # Chercher dans les chemins communs
    $paths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "C:\Python313\python.exe",
        "C:\Python311\python.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Install-Python {
    Write-Host "  Verification Python..." -NoNewline
    $cmd = Get-PythonCmd
    if ($cmd) { Write-Host " OK ($(& $cmd --version 2>&1))" -ForegroundColor Green; return }
    Write-Host " Installation Python 3.11..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $tmp -UseBasicParsing
    Start-Process -FilePath $tmp -Args "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
    Remove-Item $tmp -Force
    Reload-Path
    Write-Host "  Python 3.11 installe" -ForegroundColor Green
}

function Install-NodeJS {
    Write-Host "  Verification Node.js..." -NoNewline
    try { $v = node --version 2>&1; if ($v -match "v\d+") { Write-Host " OK ($v)" -ForegroundColor Green; return } } catch {}
    Write-Host " Installation Node.js..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile $tmp -UseBasicParsing
    Start-Process msiexec -Args "/i `"$tmp`" /quiet /norestart" -Wait
    Remove-Item $tmp -Force
    Reload-Path
    Write-Host "  Node.js installe" -ForegroundColor Green
}

function Install-Nmap {
    Write-Host "  Verification nmap..." -NoNewline
    foreach ($p in @("C:\Program Files (x86)\Nmap\nmap.exe","C:\Program Files\Nmap\nmap.exe")) {
        if (Test-Path $p) { Write-Host " OK" -ForegroundColor Green; return }
    }
    Write-Host " Installation nmap..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\nmap-installer.exe"
    Invoke-WebRequest -Uri "https://nmap.org/dist/nmap-7.94-setup.exe" -OutFile $tmp -UseBasicParsing
    Start-Process -FilePath $tmp -Args "/S" -Wait
    Remove-Item $tmp -Force
    Reload-Path
    Write-Host "  nmap installe" -ForegroundColor Green
}

function Install-Npcap {
    Write-Host "  Verification Npcap..." -NoNewline
    $npcap = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Npcap" -ErrorAction SilentlyContinue
    if ($npcap) { Write-Host " OK" -ForegroundColor Green; return }
    Write-Host " Installation Npcap..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\npcap-installer.exe"
    Invoke-WebRequest -Uri "https://npcap.com/dist/npcap-1.79.exe" -OutFile $tmp -UseBasicParsing
    Start-Process -FilePath $tmp -Args "/S" -Wait
    Remove-Item $tmp -Force
    Write-Host "  Npcap installe" -ForegroundColor Green
}

function Install-PulseDeps {
    Write-Host "  Installation dependances Python..." -ForegroundColor Cyan
    Reload-Path
    $pyCmd = Get-PythonCmd
    if (-not $pyCmd) { Write-Host "  ERREUR: Python non trouve" -ForegroundColor Red; return }
    foreach ($dep in @("fastapi", "uvicorn", "ping3", "ifaddr", "manuf", "requests", "psutil", "python-nmap")) {
        Write-Host "    $dep..." -NoNewline
        & $pyCmd -m pip install $dep -q 2>&1 | Out-Null
        Write-Host " OK" -ForegroundColor Green
    }
    Write-Host "  Installation serve..." -NoNewline
    npm install -g serve 2>&1 | Out-Null
    Write-Host " OK" -ForegroundColor Green
}

function Download-Pulse {
    Write-Host "  Telechargement fichiers Pulse..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallDir\modules" | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallDir\agent" | Out-Null
    foreach ($file in @("api.py","alerts.py","config.py","db.py","pulse_launcher.py","modules/__init__.py","modules/network.py","modules/security.py","modules/machines.py","modules/services.py","modules/wifi.py","modules/snmp.py","agent/agent.py")) {
        $dest = "$InstallDir\$($file.Replace('/', '\'))"
        New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
        try {
            Invoke-WebRequest -Uri "$GitHubBase/$file" -OutFile $dest -UseBasicParsing
            Write-Host "    $file OK" -ForegroundColor Green
        } catch { Write-Host "    $file ERREUR" -ForegroundColor Yellow }
    }
}

function Download-Dashboard {
    Write-Host "  Telechargement dashboard..." -ForegroundColor Cyan
    $buildZip = "$env:TEMP\pulse-build.zip"
    try {
        Invoke-WebRequest -Uri "$ReleaseBase/pulse-build-v1.2.zip" -OutFile $buildZip -UseBasicParsing
        Remove-Item "$InstallDir\dashboard" -Recurse -Force 2>$null
        New-Item -ItemType Directory -Force -Path "$InstallDir\dashboard" | Out-Null
        Expand-Archive -Path $buildZip -DestinationPath "$InstallDir\dashboard" -Force
        Remove-Item $buildZip -Force
        Write-Host "  Dashboard OK" -ForegroundColor Green
    } catch { Write-Host "  Dashboard ERREUR: $($_.Exception.Message)" -ForegroundColor Red }
}

function Init-Database {
    Write-Host "  Initialisation base de donnees..." -NoNewline
    $pyCmd = Get-PythonCmd
    $tmp = "$env:TEMP\pulse_init.py"
    "import sys`nsys.path.insert(0, r'$InstallDir')`nfrom db import init_db`ninit_db()`nprint('OK')" | Set-Content $tmp -Encoding UTF8
    & $pyCmd $tmp 2>&1 | Out-Null
    Remove-Item $tmp -Force
    Write-Host " OK" -ForegroundColor Green
}

function Fix-NetworkModule {
    Write-Host "  Patch module reseau Windows..." -NoNewline
    $pyCmd = Get-PythonCmd
    $fixCode = @'
import re
path = r'INSTALL_DIR\modules\network.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('import netifaces', 'import ifaddr as _ifaddr')
old = re.search(r'def get_all_networks\(\):.*?return networks', content, re.DOTALL)
if old:
    new_func = "def get_all_networks():\n    networks = []\n    for adapter in _ifaddr.get_adapters():\n        for ip in adapter.ips:\n            if not isinstance(ip.ip, str): continue\n            addr = ip.ip\n            if addr.startswith('127.') or addr.startswith('169.254.') or addr.startswith('fe80'): continue\n            try:\n                import ipaddress\n                net = ipaddress.IPv4Network(f'{addr}/255.255.255.0', strict=False)\n                networks.append(str(net))\n            except: continue\n    return networks"
    content = content[:old.start()] + new_func + content[old.end():]
nmap_paths = "['C:\\\\Program Files (x86)\\\\Nmap', 'C:\\\\Program Files\\\\Nmap']"
content = content.replace("nmap.PortScanner()", "nmap.PortScanner(nmap_search_path=" + nmap_paths + ")")
content = content.replace('network_info["network"]', 'network_info if isinstance(network_info, str) else network_info["network"]')
content = content.replace("network_info['network']", "network_info if isinstance(network_info, str) else network_info['network']")
content = re.sub(r'network_info\["interface"\]', '(network_info.get("interface","") if isinstance(network_info,dict) else "")', content)
content = re.sub(r"network_info\['interface'\]", '(network_info.get("interface","") if isinstance(network_info,dict) else "")', content)
content = re.sub(r'network_info\["ip"\]', '(network_info.get("ip","") if isinstance(network_info,dict) else network_info)', content)
content = re.sub(r"network_info\['ip'\]", '(network_info.get("ip","") if isinstance(network_info,dict) else network_info)', content)
content = content.replace("ports = scan_ports(ip)", "ports = []")
content = content.replace('not is_whitelisted(d["ip"])', "True")
content = content.replace("not is_whitelisted(d['ip'])", "True")
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')
'@
    $fixCode = $fixCode.Replace('INSTALL_DIR', $InstallDir)
    $tmp = "$env:TEMP\pulse_fix.py"
    $fixCode | Set-Content $tmp -Encoding UTF8
    & $pyCmd $tmp 2>&1 | Out-Null
    Remove-Item $tmp -Force
    Write-Host " OK" -ForegroundColor Green
}

function Create-Launcher {
    Write-Host "  Creation du lanceur..." -ForegroundColor Cyan
    $pyCmd = Get-PythonCmd
    $bat  = "@echo off`r`ntitle Pulse`r`ncolor 0A`r`n"
    $bat += "net session >nul 2>&1`r`n"
    $bat += "if %errorLevel% neq 0 (`r`n"
    $bat += "    powershell -Command `"Start-Process '%~f0' -Verb RunAs`"`r`n"
    $bat += "    exit`r`n"
    $bat += ")`r`n"
    $bat += "set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\Nmap;C:\Program Files\Nmap;%APPDATA%\npm`r`n"
    $bat += "set PYTHONPATH=$InstallDir`r`n"
    $bat += "echo.`r`n"
    $bat += "echo   PULSE - Monitoring Reseau Intelligent v1.2`r`n"
    $bat += "echo   Dashboard : http://localhost:3000`r`n"
    $bat += "echo   Login     : admin / admin123`r`n"
    $bat += "echo.`r`n"
    $bat += "cd /d `"$InstallDir`"`r`n"
    $bat += "start `"`" /B $pyCmd -m uvicorn api:app --host 0.0.0.0 --port 8000`r`n"
    $bat += "timeout /t 3 /nobreak > nul`r`n"
    $bat += "start `"`" /B npx serve -s `"$InstallDir\dashboard\build`" -l 3000`r`n"
    $bat += "timeout /t 3 /nobreak > nul`r`n"
    $bat += "start http://localhost:3000`r`n"
    $bat += "pause > nul`r`n"
    Set-Content -Path "$InstallDir\Start-Pulse.bat" -Value $bat -Encoding ASCII
    try {
        $ws = New-Object -comObject WScript.Shell
        $sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Pulse.lnk")
        $sc.TargetPath = "$InstallDir\Start-Pulse.bat"
        $sc.WorkingDirectory = $InstallDir
        $sc.Description = "Pulse - Network Monitoring"
        $sc.Save()
        Write-Host "  Raccourci bureau cree" -ForegroundColor Green
    } catch { Write-Host "  Lancer : $InstallDir\Start-Pulse.bat" -ForegroundColor Yellow }
}

# ── MAIN ──────────────────────────────────────────────────────
Write-Header

Write-Host "[1/8] Installation des prerequis..." -ForegroundColor Cyan
Install-Python
Install-NodeJS
Install-Nmap
Install-Npcap
Reload-Path

Write-Host "`n[2/8] Installation des dependances..." -ForegroundColor Cyan
Install-PulseDeps

Write-Host "`n[3/8] Telechargement de Pulse..." -ForegroundColor Cyan
Download-Pulse

Write-Host "`n[4/8] Telechargement du dashboard..." -ForegroundColor Cyan
Download-Dashboard

Write-Host "`n[5/8] Initialisation base de donnees..." -ForegroundColor Cyan
Init-Database

Write-Host "`n[6/8] Patch module reseau..." -ForegroundColor Cyan
Fix-NetworkModule

Write-Host "`n[7/8] Creation du lanceur..." -ForegroundColor Cyan
Create-Launcher

Write-Host "`n[8/8] Verification finale..." -ForegroundColor Cyan
$pyCmd = Get-PythonCmd
if ($pyCmd) { Write-Host "  Python OK" -ForegroundColor Green } else { Write-Host "  Python MANQUANT - redemarrer PowerShell et relancer" -ForegroundColor Red }
if (Test-Path "$InstallDir\dashboard\build\index.html") { Write-Host "  Dashboard OK" -ForegroundColor Green } else { Write-Host "  Dashboard MANQUANT" -ForegroundColor Red }
if (Test-Path "$InstallDir\pulse.db") { Write-Host "  Base de donnees OK" -ForegroundColor Green } else { Write-Host "  Base de donnees MANQUANT" -ForegroundColor Red }
if (Test-Path "$InstallDir\api.py") { Write-Host "  API OK" -ForegroundColor Green } else { Write-Host "  API MANQUANT" -ForegroundColor Red }

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "  PULSE v1.2 INSTALLE !" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "  Demarrer  : bureau > Pulse" -ForegroundColor White
Write-Host "  Dashboard : http://localhost:3000" -ForegroundColor White
Write-Host "  Login     : admin / admin123" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""

$open = Read-Host "Demarrer Pulse maintenant ? (O/N)"
if ($open -eq "O" -or $open -eq "o") {
    Start-Process "$InstallDir\Start-Pulse.bat"
}
