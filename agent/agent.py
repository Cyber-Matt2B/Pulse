#!/usr/bin/env python3
"""
Pulse Agent — monitore CPU/RAM/disque et envoie les métriques à l'API Pulse.
Installation : curl http://IP:8000/agent/install | bash
"""
import time, socket, platform, datetime, sys, json

try:
    import psutil
except ImportError:
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'psutil', '--break-system-packages', '-q'])
    import psutil

try:
    import requests
except ImportError:
    import subprocess
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'requests', '--break-system-packages', '-q'])
    import requests

# Config — modifiable
PULSE_API = "http://192.168.1.16:8000"
INTERVAL  = 300  # secondes entre chaque envoi (5 min)
TOKEN     = ""   # optionnel si l'API est ouverte pour les agents

def get_real_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def collect():
    return {
        "ip":           get_real_ip(),
        "hostname":     socket.gethostname(),
        "cpu_percent":  psutil.cpu_percent(interval=1),
        "ram_percent":  psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage('/').percent,
        "uptime":       str(datetime.datetime.now() - datetime.datetime.fromtimestamp(psutil.boot_time())).split('.')[0],
        "os":           f"{platform.system()} {platform.release()}",
    }

def send(data):
    try:
        headers = {"Content-Type": "application/json"}
        if TOKEN:
            headers["Authorization"] = f"Bearer {TOKEN}"
        r = requests.post(f"{PULSE_API}/api/agent/push", json=data, headers=headers, timeout=5)
        # Heartbeat séparé
        requests.post(f"{PULSE_API}/api/agent/ping", json={"ip": data["ip"]}, timeout=3)
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Envoyé — CPU:{data['cpu_percent']}% RAM:{data['ram_percent']}% Disk:{data['disk_percent']}% → {r.status_code}")
    except Exception as e:
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Erreur envoi : {e}")

if __name__ == "__main__":
    print(f"Pulse Agent démarré — envoi vers {PULSE_API} toutes les {INTERVAL}s")
    while True:
        send(collect())
        time.sleep(INTERVAL)
