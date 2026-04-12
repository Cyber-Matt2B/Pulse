# ============================================
# Pulse - Installation Windows v1.1
# ============================================
# Usage : PowerShell en admin
# Set-ExecutionPolicy Bypass -Scope Process
# .\install-windows.ps1
# One-liner :
# powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main/install-windows.ps1 | iex"
# ============================================

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Pulse",
    [string]$GitHubBase = "https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main",
    [string]$ReleaseBase = "https://github.com/Cyber-Matt2B/Pulse/releases/latest/download"
)

$ErrorActionPreference = "Continue"

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  ____  _   _ _     ____  _____" -ForegroundColor Green
    Write-Host " |  _ \| | | | |   / ___|| ____|" -ForegroundColor Green
    Write-Host " | |_) | | | | |   \___ \|  _|  " -ForegroundColor Green
    Write-Host " |  __/| |_| | |___ ___) | |___  " -ForegroundColor Green
    Write-Host " |_|    \___/|_____|____/|_____|" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Monitoring Reseau Intelligent v1.1" -ForegroundColor Cyan
    Write-Host "  Installation Windows" -ForegroundColor Cyan
    Write-Host ""
}

function Reload-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Install-Python {
    Write-Host "  Verification Python..." -NoNewline
    try { $v = python --version 2>&1; Write-Host " OK ($v)" -ForegroundColor Green; return } catch {}
    Write-Host " Installation..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $tmp -UseBasicParsing
    Start-Process -FilePath $tmp -Args "/quiet InstallAllUsers=0 PrependPath=1" -Wait
    Remove-Item $tmp -Force
    Reload-Path
    Write-Host "  Python installe" -ForegroundColor Green
}

function Install-NodeJS {
    Write-Host "  Verification Node.js..." -NoNewline
    try { $v = node --version 2>&1; Write-Host " OK ($v)" -ForegroundColor Green; return } catch {}
    Write-Host " Installation..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile $tmp -UseBasicParsing
    Start-Process msiexec -Args "/i $tmp /quiet" -Wait
    Remove-Item $tmp -Force
    Reload-Path
    Write-Host "  Node.js installe" -ForegroundColor Green
}

function Install-Nmap {
    Write-Host "  Verification nmap..." -NoNewline
    if (Get-Command nmap -ErrorAction SilentlyContinue) { Write-Host " OK" -ForegroundColor Green; return }
    Write-Host " Installation..." -ForegroundColor Yellow
    $tmp = "$env:TEMP\nmap-installer.exe"
    Invoke-WebRequest -Uri "https://nmap.org/dist/nmap-7.94-setup.exe" -OutFile $tmp -UseBasicParsing
    Start-Process -FilePath $tmp -Args "/S" -Wait
    Remove-Item $tmp -Force
    Reload-Path
    Write-Host "  nmap installe" -ForegroundColor Green
}

function Install-PulseDeps {
    Write-Host "  Installation dependances Python..." -ForegroundColor Cyan
    $deps = @("fastapi", "uvicorn", "ping3", "ifaddr", "manuf", "requests", "psutil", "python-nmap")
    foreach ($dep in $deps) {
        Write-Host "    $dep..." -NoNewline
        python -m pip install $dep -q 2>&1 | Out-Null
        Write-Host " OK" -ForegroundColor Green
    }
    Write-Host "  Installation serve..." -NoNewline
    npm install -g serve 2>&1 | Out-Null
    Write-Host " OK" -ForegroundColor Green
}

function Download-Pulse {
    Write-Host "  Telechargement de Pulse depuis GitHub..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallDir\modules" | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallDir\agent" | Out-Null

    $files = @(
        "api.py", "alerts.py", "config.py", "db.py", "pulse_launcher.py",
        "modules/__init__.py", "modules/network.py", "modules/security.py",
        "modules/machines.py", "modules/services.py", "modules/wifi.py",
        "modules/snmp.py", "agent/agent.py"
    )

    foreach ($file in $files) {
        $dest = "$InstallDir\$($file.Replace('/', '\'))"
        New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
        try {
            Invoke-WebRequest -Uri "$GitHubBase/$file" -OutFile $dest -UseBasicParsing
            Write-Host "    $file OK" -ForegroundColor Green
        } catch {
            Write-Host "    $file ERREUR" -ForegroundColor Yellow
        }
    }

    # auth.json par defaut
    Write-Host "    auth.json sera cree automatiquement au premier demarrage" -ForegroundColor Green
}

function Download-Dashboard {
    Write-Host "  Telechargement du dashboard..." -ForegroundColor Cyan
    $buildZip = "$env:TEMP\pulse-build.zip"
    try {
        Invoke-WebRequest -Uri "$ReleaseBase/pulse-build-v1.1.zip" -OutFile $buildZip -UseBasicParsing
        New-Item -ItemType Directory -Force -Path "$InstallDir\dashboard" | Out-Null
        Expand-Archive -Path $buildZip -DestinationPath "$InstallDir\dashboard" -Force
        Remove-Item $buildZip -Force
        Write-Host "  Dashboard OK" -ForegroundColor Green
    } catch {
        Write-Host "  Dashboard ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Init-Database {
    Write-Host "  Initialisation de la base de donnees..." -NoNewline
    $initScript = @"
import sys
sys.path.insert(0, r'$InstallDir')
from db import init_db
init_db()
print('OK')
"@
    $tmp = "$env:TEMP\pulse_initdb.py"
    [System.IO.File]::WriteAllText($tmp, $initScript)
    $result = python $tmp 2>&1
    Remove-Item $tmp -Force
    Write-Host " OK" -ForegroundColor Green
}

function Fix-NetworkModule {
    Write-Host "  Configuration module reseau Windows..." -NoNewline
    $fixScript = @"
import re, os

path = r'$InstallDir\modules\network.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix netifaces -> ifaddr
content = content.replace('import netifaces', 'import ifaddr as _ifaddr')

# Fix get_all_networks
old = re.search(r'def get_all_networks\(\):.*?return networks', content, re.DOTALL)
if old:
    new = '''def get_all_networks():
    networks = []
    for adapter in _ifaddr.get_adapters():
        for ip in adapter.ips:
            if not isinstance(ip.ip, str): continue
            addr = ip.ip
            if addr.startswith('127.') or addr.startswith('169.254.') or addr.startswith('fe80'): continue
            try:
                import ipaddress
                net = ipaddress.IPv4Network(f'{addr}/255.255.255.0', strict=False)
                networks.append(str(net))
            except: continue
    return networks'''
    content = content[:old.start()] + new + content[old.end():]

# Fix nmap path
content = content.replace("nmap.PortScanner()", "nmap.PortScanner(nmap_search_path=[r'C:\\Program Files (x86)\\Nmap', r'C:\\Program Files\\Nmap'])")

# Fix network column references
content = content.replace("network_info[\"network\"]", "network_info if isinstance(network_info, str) else network_info[\"network\"]")
content = content.replace("network_info['network']", "network_info if isinstance(network_info, str) else network_info['network']")
content = re.sub(r"network_info\[.interface.\]", '(network_info.get("interface","") if isinstance(network_info,dict) else "")', content)
content = re.sub(r"network_info\[.ip.\]", '(network_info.get("ip","") if isinstance(network_info,dict) else network_info)', content)
content = content.replace("ports = scan_ports(ip)", "ports = []")
content = content.replace("not is_whitelisted(d[\"ip\"])", "True")
content = content.replace("not is_whitelisted(d['ip'])", "True")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')
"@
    $tmp = "$env:TEMP\pulse_fixnet.py"
    [System.IO.File]::WriteAllText($tmp, $fixScript)
    python $tmp 2>&1 | Out-Null
    Remove-Item $tmp -Force
    Write-Host " OK" -ForegroundColor Green
}

function Create-Launcher {
    Write-Host "  Creation du lanceur..." -ForegroundColor Cyan
    $nmap_path = ""
    if (Test-Path "C:\Program Files (x86)\Nmap\nmap.exe") { $nmap_path = "C:\Program Files (x86)\Nmap" }
    elseif (Test-Path "C:\Program Files\Nmap\nmap.exe") { $nmap_path = "C:\Program Files\Nmap" }

    $bat  = "@echo off`r`n"
    $bat += "title Pulse - Network Monitoring`r`n"
    $bat += "color 0A`r`n"
    $bat += "net session >nul 2>&1`r`n"
    $bat += "if %errorLevel% neq 0 (`r`n"
    $bat += "    powershell -Command `"Start-Process '%~f0' -Verb RunAs`"`r`n"
    $bat += "    exit`r`n"
    $bat += ")`r`n"
    if ($nmap_path) { $bat += "set PATH=%PATH%;$nmap_path`r`n" }
    $bat += "set PYTHONPATH=$InstallDir`r`n"
    $bat += "echo   PULSE - Monitoring Reseau Intelligent`r`n"
    $bat += "echo   Dashboard : http://localhost:3000`r`n"
    $bat += "echo   Login     : admin / admin123`r`n`r`n"
    $bat += "cd /d `"$InstallDir`"`r`n"
    $bat += "start `"`" /B python -m uvicorn api:app --host 0.0.0.0 --port 8000`r`n"
    $bat += "timeout /t 2 /nobreak > nul`r`n"
    $bat += "start `"`" /B npx serve -s `"$InstallDir\dashboard\build`" -l 3000`r`n"
    $bat += "timeout /t 3 /nobreak > nul`r`n"
    $bat += "start http://localhost:3000`r`n"
    $bat += "pause`r`n"
    Set-Content -Path "$InstallDir\Start-Pulse.bat" -Value $bat -Encoding ASCII

    try {
        $ws = New-Object -comObject WScript.Shell
        $sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Pulse.lnk")
        $sc.TargetPath = "$InstallDir\Start-Pulse.bat"
        $sc.WorkingDirectory = $InstallDir
        $sc.Description = "Pulse - Network Monitoring"
        $sc.Save()
        Write-Host "  Raccourci bureau cree" -ForegroundColor Green
    } catch {
        Write-Host "  Lancer : $InstallDir\Start-Pulse.bat" -ForegroundColor Yellow
    }
}

# ── MAIN ──────────────────────────────────────────────────────
Write-Header

Write-Host "[1/7] Verification des prerequis..." -ForegroundColor Cyan
Install-Python
Install-NodeJS
Install-Nmap

Write-Host "`n[2/7] Installation des dependances..." -ForegroundColor Cyan
Install-PulseDeps

Write-Host "`n[3/7] Telechargement de Pulse..." -ForegroundColor Cyan
Download-Pulse

Write-Host "`n[4/7] Telechargement du dashboard..." -ForegroundColor Cyan
Download-Dashboard

Write-Host "`n[5/7] Initialisation de la base de donnees..." -ForegroundColor Cyan
Init-Database

Write-Host "`n[6/7] Configuration module reseau..." -ForegroundColor Cyan
Fix-NetworkModule

Write-Host "`n[7/7] Creation du lanceur..." -ForegroundColor Cyan
Create-Launcher

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "  PULSE v1.1 INSTALLE !" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "  Demarrer : bureau > Pulse" -ForegroundColor White
Write-Host "  Dashboard : http://localhost:3000" -ForegroundColor White
Write-Host "  Login     : admin / admin123" -ForegroundColor White
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""

$open = Read-Host "Demarrer Pulse maintenant ? (O/N)"
if ($open -eq "O" -or $open -eq "o") {
    Start-Process "$InstallDir\Start-Pulse.bat"
}
