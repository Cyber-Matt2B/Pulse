import os as _os
import sys as _sys
_BASE_DIR = _os.path.dirname(_os.path.abspath(__file__))
_PULSE_DIR = _os.path.dirname(_BASE_DIR)  # dossier parent = racine pulse
_sys.path.insert(0, _PULSE_DIR)
DB_PATH = _os.path.join(_PULSE_DIR, "pulse.db")

import sqlite3, datetime, subprocess, sys, re


def init_security_table():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, type TEXT, ip TEXT,
        detail TEXT, severity TEXT)''')
    conn.commit(); conn.close()

def detect_arp_spoofing():
    """Détecte si plusieurs IPs IPv4 ont la même MAC (ARP spoofing)."""
    init_security_table()
    events = []
    try:
        r = subprocess.run(['ip','neigh','show'], capture_output=True, text=True)
        mac_to_ips = {}
        for line in r.stdout.splitlines():
            parts = line.split()
            if len(parts) < 5: continue
            ip  = parts[0]
            mac = next((p for p in parts if re.match(r'^([0-9a-f]{2}:){5}[0-9a-f]{2}$', p, re.I)), None)
            if not mac: continue
            # Ignorer IPv6 — on ne surveille que l'IPv4
            if ':' in ip: continue
            # Ignorer les MACs incomplètes
            if mac == '00:00:00:00:00:00': continue
            if mac not in mac_to_ips:
                mac_to_ips[mac] = []
            if ip not in mac_to_ips[mac]:
                mac_to_ips[mac].append(ip)
        for mac, ips in mac_to_ips.items():
            if len(ips) > 1:
                detail = f"MAC {mac} → {', '.join(ips)}"
                save_security_event("ARP_SPOOFING", ips[0], detail, "HIGH")
                events.append({"type":"ARP_SPOOFING","ips":ips,"mac":mac,"severity":"HIGH"})
    except Exception as e:
        print(f"[security] ARP error: {e}")
    return events

def detect_port_scan_attempts():
    """Détecte les tentatives de brute force SSH via les logs."""
    init_security_table()
    events = []
    try:
        r = subprocess.run(
            ['journalctl','-u','ssh','--since','1 hour ago','--no-pager','-q'],
            capture_output=True, text=True, timeout=5)
        failed = {}
        for line in r.stdout.splitlines():
            if 'Failed password' in line or 'Invalid user' in line:
                match = re.search(r'from (\d+\.\d+\.\d+\.\d+)', line)
                if match:
                    ip = match.group(1)
                    failed[ip] = failed.get(ip, 0) + 1
        for ip, count in failed.items():
            if count >= 5:
                detail = f"{count} tentatives SSH échouées"
                save_security_event("BRUTE_FORCE_SSH", ip, detail, "HIGH")
                events.append({"type":"BRUTE_FORCE_SSH","ip":ip,"count":count,"severity":"HIGH"})
    except Exception:
        pass
    return events

def fingerprint_device(ip):
    try:
        r = subprocess.run(['nmap','-O','--osscan-guess','-T4',ip],
            capture_output=True, text=True, timeout=30)
        os_match = re.search(r'OS details: (.+)', r.stdout)
        return os_match.group(1) if os_match else "Inconnu"
    except Exception:
        return "Inconnu"

def save_security_event(event_type, ip, detail, severity="MEDIUM"):
    conn = sqlite3.connect(DB_PATH)
    existing = conn.execute(
        "SELECT id FROM security_events WHERE type=? AND ip=? AND timestamp>=datetime('now','-1 hour')",
        (event_type, ip)).fetchone()
    if not existing:
        ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conn.execute(
            "INSERT INTO security_events (timestamp,type,ip,detail,severity) VALUES (?,?,?,?,?)",
            (ts, event_type, ip, detail, severity))
        conn.commit()
    conn.close()

def get_security_events(limit=100):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM security_events ORDER BY timestamp DESC LIMIT ?",(limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def run_all_checks():
    events = []
    events += detect_arp_spoofing()
    events += detect_port_scan_attempts()
    return events
