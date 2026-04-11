import requests
from config import NTFY_ENABLED, NTFY_URL

def send_alert(title, message, priority="default", tags="computer"):
    if not NTFY_ENABLED:
        return
    try:
        requests.post(NTFY_URL,
            data=message.encode("utf-8"),
            headers={
                "Title":    title.encode("utf-8").decode("latin-1", errors="replace"),
                "Priority": priority,
                "Tags":     tags,
            },
            timeout=5
        )
        print(f"  [Ntfy] Alerte envoyee : {title}")
    except Exception as e:
        print(f"  [Ntfy] Erreur : {e}")

def alert_anomalie(hostname, alerts):
    from config import ALERT_ANOMALIE
    if not ALERT_ANOMALIE:
        return
    send_alert(
        title=f"Pulse | Anomalie : {hostname}",
        message="\n".join(alerts),
        priority="high",
        tags="warning"
    )

def alert_intrus(ip, network):
    from config import ALERT_INTRUS
    if not ALERT_INTRUS:
        return
    send_alert(
        title="Pulse | Appareil inconnu detecte !",
        message=f"IP : {ip}\nReseau : {network}\nVerifier immediatement.",
        priority="urgent",
        tags="rotating_light"
    )

def alert_disparu(hostname, ip):
    from config import ALERT_DISPARU
    if not ALERT_DISPARU:
        return
    send_alert(
        title=f"Pulse | Appareil deconnecte",
        message=f"{hostname} ({ip}) a quitte le reseau.",
        priority="default",
        tags="wave"
    )

def alert_nocturne(count):
    from config import ALERT_NOCTURNE
    if not ALERT_NOCTURNE:
        return
    send_alert(
        title="Pulse | Activite nocturne detectee",
        message=f"{count} connexion(s) entre 1h et 5h du matin.",
        priority="high",
        tags="moon"
    )
