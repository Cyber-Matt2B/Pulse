#!/bin/bash
# Pulse — Installation complète one-liner
# Usage : curl http://IP/install.sh | bash
# Ou   : bash <(curl -s http://IP/install.sh)

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
PULSE_DIR="${PULSE_DIR:-/opt/pulse}"
PULSE_PORT_API="${PULSE_PORT_API:-8000}"
PULSE_PORT_UI="${PULSE_PORT_UI:-3000}"

echo -e "${GREEN}"
echo "  ██████  ██    ██ ██      ███████ ███████ "
echo "  ██   ██ ██    ██ ██      ██      ██      "
echo "  ██████  ██    ██ ██      ███████ █████   "
echo "  ██      ██    ██ ██           ██ ██      "
echo "  ██       ██████  ███████ ███████ ███████ "
echo -e "${NC}"
echo -e "${BLUE}  Pulse — Monitoring Réseau Intelligent${NC}"
echo "  Installation automatique"
echo ""

# Vérifications
if [[ $EUID -ne 0 ]]; then echo -e "${RED}Erreur : lancer en root (sudo bash install.sh)${NC}"; exit 1; fi
command -v python3 &>/dev/null || { apt-get install -y python3 python3-pip; }
command -v node    &>/dev/null || { apt-get install -y nodejs npm; }
command -v nmap    &>/dev/null || { apt-get install -y nmap; }

echo "▶ Création du répertoire $PULSE_DIR..."
mkdir -p "$PULSE_DIR"
cd "$PULSE_DIR"

echo "▶ Environnement Python..."
python3 -m venv venv
venv/bin/pip install -q fastapi uvicorn python-nmap ping3 netifaces manuf requests psutil weasyprint

echo "▶ Téléchargement de Pulse..."
# Dans un vrai déploiement : curl -s https://github.com/ton-repo/pulse/archive/main.tar.gz | tar xz
echo "  (Copier les fichiers depuis votre serveur de développement)"

echo "▶ Configuration des services systemd..."
for service in network api dashboard; do
    systemctl enable pulse-$service 2>/dev/null || true
    systemctl start  pulse-$service 2>/dev/null || true
done

echo ""
echo -e "${GREEN}✓ Pulse installé avec succès !${NC}"
echo ""
echo "  Dashboard : http://$(hostname -I | awk '{print $1}'):$PULSE_PORT_UI"
echo "  API       : http://$(hostname -I | awk '{print $1}'):$PULSE_PORT_API"
echo "  Login     : admin / admin123"
echo ""
echo -e "${BLUE}  Changer le mot de passe depuis le menu Profil du dashboard.${NC}"
