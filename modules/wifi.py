import sqlite3, datetime, subprocess, re, sys
sys.path.insert(0, '/root/pulse')

DB_PATH = "/root/pulse/pulse.db"

def init_wifi_table():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS wifi_scan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, ssid TEXT, bssid TEXT,
        channel INTEGER, frequency TEXT,
        signal INTEGER, security TEXT)''')
    conn.commit(); conn.close()

def scan_wifi():
    """Scan les réseaux WiFi disponibles via nmcli."""
    init_wifi_table()
    networks = []
    try:
        r = subprocess.run(
            ['nmcli','-t','-f','SSID,BSSID,CHAN,FREQ,SIGNAL,SECURITY','dev','wifi','list','--rescan','yes'],
            capture_output=True, text=True, timeout=15)
        for line in r.stdout.splitlines():
            parts = line.split(':')
            if len(parts) >= 6:
                try:
                    net = {
                        "ssid":     parts[0] or "(caché)",
                        "bssid":    ':'.join(parts[1:7]) if len(parts)>6 else parts[1],
                        "channel":  int(parts[7] if len(parts)>7 else parts[2]),
                        "frequency":parts[8] if len(parts)>8 else parts[3],
                        "signal":   int(parts[9] if len(parts)>9 else parts[4]),
                        "security": parts[10] if len(parts)>10 else parts[5],
                    }
                    networks.append(net)
                except Exception:
                    continue
    except Exception as e:
        print(f"[wifi] nmcli error: {e}")
        return []

    if networks:
        conn = sqlite3.connect(DB_PATH)
        ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        for n in networks:
            conn.execute("INSERT INTO wifi_scan (timestamp,ssid,bssid,channel,frequency,signal,security) VALUES (?,?,?,?,?,?,?)",
                (ts,n['ssid'],n['bssid'],n['channel'],n['frequency'],n['signal'],n['security']))
        conn.commit(); conn.close()
    return networks

def analyze_channels(networks):
    """Analyse la saturation des canaux WiFi."""
    channel_load = {}
    for n in networks:
        ch = n.get('channel', 0)
        if ch not in channel_load:
            channel_load[ch] = []
        channel_load[ch].append(n)
    recommendations = []
    for ch, nets in sorted(channel_load.items()):
        count = len(nets)
        avg_signal = sum(n['signal'] for n in nets) / count
        saturation = "Élevée" if count >= 3 else "Moyenne" if count == 2 else "Faible"
        recommendations.append({
            "channel": ch,
            "networks": count,
            "avg_signal": round(avg_signal),
            "saturation": saturation,
            "networks_list": [n['ssid'] for n in nets]
        })
    # Recommander le canal le moins chargé (1, 6, 11 pour 2.4GHz)
    best_channels = [ch for ch in [1,6,11] if ch not in channel_load]
    return {"channels": recommendations, "best_free": best_channels}

def get_wifi_history():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM wifi_scan WHERE timestamp=(SELECT MAX(timestamp) FROM wifi_scan) ORDER BY signal DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
