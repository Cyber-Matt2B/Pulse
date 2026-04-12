import os as _os
import sys as _sys
_BASE_DIR = _os.path.dirname(_os.path.abspath(__file__))
_PULSE_DIR = _os.path.dirname(_BASE_DIR)  # dossier parent = racine pulse
_sys.path.insert(0, _PULSE_DIR)
DB_PATH = _os.path.join(_PULSE_DIR, "pulse.db")

import subprocess, sqlite3, datetime, threading


def init_snmp_table():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS snmp_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, ip TEXT, oid TEXT, value TEXT)''')
    conn.commit(); conn.close()

def snmp_get(ip, oid, community="public"):
    try:
        r = subprocess.run(["snmpget","-v2c","-c",community,"-Oqv", ip, oid],
            capture_output=True, text=True, timeout=3)
        return r.stdout.strip() if r.returncode==0 else None
    except Exception:
        return None

def snmp_walk(ip, oid, community="public"):
    try:
        r = subprocess.run(["snmpwalk","-v2c","-c",community,"-Oqn", ip, oid],
            capture_output=True, text=True, timeout=5)
        return r.stdout.strip().splitlines() if r.returncode==0 else []
    except Exception:
        return []

def scan_snmp(ip, community="public"):
    init_snmp_table()
    results = {}
    oids = {
        "sysDescr":    "1.3.6.1.2.1.1.1.0",
        "sysUpTime":   "1.3.6.1.2.1.1.3.0",
        "sysName":     "1.3.6.1.2.1.1.5.0",
        "ifInOctets":  "1.3.6.1.2.1.2.2.1.10.1",
        "ifOutOctets": "1.3.6.1.2.1.2.2.1.16.1",
    }
    for name, oid in oids.items():
        val = snmp_get(ip, oid, community)
        if val:
            results[name] = val
    if results:
        conn = sqlite3.connect(DB_PATH)
        ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        for k, v in results.items():
            conn.execute("INSERT INTO snmp_data (timestamp,ip,oid,value) VALUES (?,?,?,?)", (ts,ip,k,v))
        conn.commit(); conn.close()
    return results

def get_snmp_data(ip=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if ip:
        rows = conn.execute(
            "SELECT * FROM snmp_data WHERE ip=? ORDER BY timestamp DESC LIMIT 100",(ip,)).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM snmp_data WHERE timestamp=(SELECT MAX(timestamp) FROM snmp_data) ORDER BY ip").fetchall()
    conn.close()
    return [dict(r) for r in rows]
