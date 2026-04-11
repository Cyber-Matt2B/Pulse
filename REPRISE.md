# Pulse — doc de reprise session 4

## Stack
- Debian 13 · VMware bridge · IP 192.168.1.16
- Python 3 · venv /root/pulse/venv
- React 19 · D3.js · FastAPI · SQLite
- 3 services systemd : pulse-network · pulse-api · pulse-dashboard

## Fichiers clés
- /root/pulse/api.py          — FastAPI ~30 endpoints + auth JWT
- /root/pulse/config.py       — seuils · Ntfy · alertes
- /root/pulse/alerts.py       — send_alert · 4 types
- /root/pulse/modules/network.py    — scanner principal
- /root/pulse/modules/security.py   — ARP · brute force
- /root/pulse/modules/machines.py   — CPU/RAM/disque local
- /root/pulse/modules/services.py   — HTTP uptime · SSL
- /root/pulse/modules/wifi.py       — canaux · saturation
- /root/pulse/dashboard/src/App.js  — UI principale sidebar
- /root/pulse/dashboard/src/Modules.js  — Timeline/Machines/Services/Security/WiFi
- /root/pulse/auth.json        — login admin · tokens

## Login dashboard
- URL : http://192.168.1.16:3000
- API : http://192.168.1.16:8000
- User : admin / admin123

## Ce qui reste à faire (priorité)
1. Historique scores en base (30 min) — graphe 7 jours actuellement simulé
2. Fingerprinting automatique appareils (1h) — TTL + ports + MAC → "Windows 11", "Android"
3. Agent one-liner machines (1h) — script à installer sur les autres PC du réseau
4. Script install one-liner (2h) — curl | bash pour déployer Pulse en 5 min
5. Agent one-liner → Win/Linux/Mac — monitore CPU/RAM/disque depuis n'importe où
6. Timeline zoomable D3 — brush zoom
7. SNMP complet — MIB dashboard + auto-scan
8. Docker image
9. Landing page + distribution
