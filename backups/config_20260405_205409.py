# ═══════════════════════════════════════
# Pulse — Configuration centrale
# Modifier ce fichier pour personnaliser
# ═══════════════════════════════════════

# Réseau
SCAN_INTERVAL   = 60  #   secondes entre chaque scan (300 = 5 min)
LATENCY_SLOW    = 200  #   ms — seuil appareil lent
LATENCY_SPIKE   = 3  #   multiplicateur spike (latence > X * moyenne)
INSTABLE_MIN    = 5  #   déconnexions minimum pour flaguer instable

# Alertes Ntfy
NTFY_ENABLED    = True
NTFY_TOPIC      = "Pulse_Matteo"
NTFY_URL        = f"https://ntfy.sh/{NTFY_TOPIC}"

# Quoi notifier
ALERT_ANOMALIE  = True  #   latence élevée, spike
ALERT_INTRUS    = True  #   appareil inconnu
ALERT_DISPARU   = True  #   appareil déconnecté (verbeux — désactivé par défaut)
ALERT_NOCTURNE  = True  #   activité entre 1h et 5h du matin

# Ports
DASHBOARD_PORT  = 3000
API_PORT        = 8000
