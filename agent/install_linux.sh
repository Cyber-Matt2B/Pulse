#!/bin/bash
# Pulse Agent — Installation Linux one-liner
# Usage : curl http://192.168.1.16:8000/agent/install | bash

set -e
PULSE_API="${PULSE_API:-http://192.168.1.16:8000}"
AGENT_DIR="$HOME/.pulse-agent"

echo "=== Pulse Agent — Installation ==="
echo "API : $PULSE_API"

# Dépendances
python3 -m pip install psutil requests --break-system-packages -q 2>/dev/null || \
pip3 install psutil requests -q 2>/dev/null || true

# Télécharger l'agent
mkdir -p "$AGENT_DIR"
curl -s "$PULSE_API/agent/agent.py" -o "$AGENT_DIR/agent.py"
sed -i "s|http://192.168.1.16:8000|$PULSE_API|g" "$AGENT_DIR/agent.py"

# Créer service systemd si disponible
if command -v systemctl &>/dev/null; then
    sudo tee /etc/systemd/system/pulse-agent.service > /dev/null << EOF
[Unit]
Description=Pulse Agent
After=network.target
[Service]
ExecStart=$(which python3) $AGENT_DIR/agent.py
Restart=always
RestartSec=60
User=$USER
[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable pulse-agent
    sudo systemctl start pulse-agent
    echo "✓ Service pulse-agent démarré"
else
    # Fallback cron
    (crontab -l 2>/dev/null; echo "*/5 * * * * python3 $AGENT_DIR/agent.py --once") | crontab -
    echo "✓ Cron configuré (toutes les 5 min)"
fi

echo "✓ Pulse Agent installé dans $AGENT_DIR"
echo "  Logs : journalctl -u pulse-agent -f"
