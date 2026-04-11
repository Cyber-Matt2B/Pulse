# Pulse Agent — Installation Windows
# Exécuter dans PowerShell en admin :
# iex (New-Object Net.WebClient).DownloadString('http://192.168.1.16:8000/agent/install.ps1')

$PULSE_API = "http://192.168.1.16:8000"
$AGENT_DIR = "$env:USERPROFILE\.pulse-agent"

Write-Host "=== Pulse Agent Windows ===" -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $AGENT_DIR | Out-Null

# Télécharger l'agent Python
Invoke-WebRequest -Uri "$PULSE_API/agent/agent.py" -OutFile "$AGENT_DIR\agent.py"

# Installer dépendances
pip install psutil requests -q

# Créer tâche planifiée Windows
$action  = New-ScheduledTaskAction -Execute "python" -Argument "$AGENT_DIR\agent.py"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -Once -At (Get-Date)
Register-ScheduledTask -TaskName "PulseAgent" -Action $action -Trigger $trigger -Force

Write-Host "✓ Pulse Agent installé et planifié toutes les 5 minutes" -ForegroundColor Green
