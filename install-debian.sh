#!/bin/bash
# ============================================
# Pulse - Installation Debian/Ubuntu
# ============================================
# Usage :
# curl -sSL https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main/install-debian.sh | bash
# ============================================

set -e
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

PULSE_DIR="/opt/pulse"
GITHUB_BASE="https://raw.githubusercontent.com/Cyber-Matt2B/Pulse/main"
RELEASE_BASE="https://github.com/Cyber-Matt2B/Pulse/releases/latest/download"

echo ""
echo -e "${GREEN}  ____  _   _ _     ____  _____"
echo " |  _ \| | | | |   / ___|| ____|"
echo " | |_) | | | | |   \___ \|  _|  "
echo " |  __/| |_| | |___ ___) | |___  "
echo " |_|    \___/|_____|____/|_____|${NC}"
echo ""
echo -e "${CYAN}  Monitoring Reseau Intelligent v1.2"
echo "  Installation Debian/Ubuntu${NC}"
echo ""

# Vérifier root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Lancer en tant que root : sudo bash install-debian.sh${NC}"
    exit 1
fi

echo -e "${CYAN}[1/6] Installation des dependances systeme...${NC}"
apt-get update -q
apt-get install -y -q python3 python3-pip python3-venv nmap nodejs npm curl wget unzip 2>/dev/null
echo -e "${GREEN}  OK${NC}"

echo -e "${CYAN}[2/6] Creation du dossier Pulse...${NC}"
mkdir -p "$PULSE_DIR/modules"
mkdir -p "$PULSE_DIR/agent"
mkdir -p "$PULSE_DIR/backups"
echo -e "${GREEN}  OK${NC}"

echo -e "${CYAN}[3/6] Telechargement de Pulse...${NC}"
for file in api.py alerts.py config.py db.py pulse_launcher.py modules/__init__.py modules/network.py modules/security.py modules/machines.py modules/services.py modules/wifi.py modules/snmp.py agent/agent.py; do
    curl -sSL "$GITHUB_BASE/$file" -o "$PULSE_DIR/$file"
    echo -e "${GREEN}  $file OK${NC}"
done

echo -e "${CYAN}[4/6] Telechargement du dashboard...${NC}"
curl -sSL "$RELEASE_BASE/pulse-build-v1.1.zip" -o /tmp/pulse-build.zip
mkdir -p "$PULSE_DIR/dashboard"
unzip -q /tmp/pulse-build.zip -d "$PULSE_DIR/dashboard"
rm /tmp/pulse-build.zip
echo -e "${GREEN}  Dashboard OK${NC}"

echo -e "${CYAN}[5/6] Installation des dependances Python...${NC}"
python3 -m venv "$PULSE_DIR/venv"
"$PULSE_DIR/venv/bin/pip" install -q fastapi uvicorn ping3 netifaces manuf requests psutil python-nmap
npm install -g serve -q 2>/dev/null
echo -e "${GREEN}  OK${NC}"

echo -e "${CYAN}[6/6] Configuration...${NC}"
# Init DB
"$PULSE_DIR/venv/bin/python3" -c "
import sys
sys.path.insert(0, '$PULSE_DIR')
from db import init_db
init_db()
print('DB OK')
"

# Services systemd
cat > /etc/systemd/system/pulse-api.service << SVCEOF
[Unit]
Description=Pulse API
After=network.target

[Service]
WorkingDirectory=$PULSE_DIR
ExecStart=$PULSE_DIR/venv/bin/uvicorn api:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=PYTHONPATH=$PULSE_DIR

[Install]
WantedBy=multi-user.target
SVCEOF

cat > /etc/systemd/system/pulse-dashboard.service << SVCEOF
[Unit]
Description=Pulse Dashboard
After=network.target

[Service]
ExecStart=/usr/bin/npx serve -s $PULSE_DIR/dashboard/build -l 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable pulse-api pulse-dashboard
systemctl start pulse-api pulse-dashboard

# Cron scan toutes les 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * cd $PULSE_DIR && $PULSE_DIR/venv/bin/python3 modules/network.py >> /var/log/pulse-scan.log 2>&1") | crontab -

sleep 3
API_STATUS=$(systemctl is-active pulse-api)
DASH_STATUS=$(systemctl is-active pulse-dashboard)

echo ""
echo -e "${GREEN}  ============================================${NC}"
echo -e "${GREEN}  PULSE v1.2 INSTALLE !${NC}"
echo -e "${GREEN}  ============================================${NC}"
echo -e "  API     : ${API_STATUS}"
echo -e "  Dashboard : ${DASH_STATUS}"
echo ""
echo -e "  Dashboard : ${CYAN}http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo -e "  Login     : admin / admin123"
echo -e "${GREEN}  ============================================${NC}"
echo ""
echo "  Agent sur autres machines :"
echo "  curl http://$(hostname -I | awk '{print $1}'):8000/agent/install | bash"
echo ""
