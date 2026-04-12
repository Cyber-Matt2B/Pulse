"""
Pulse — Initialisation automatique de la base de données
Appelé au démarrage de l'API et du script d'install Windows
"""
import sqlite3, os

def get_db_path():
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "pulse.db")

def init_db():
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.executescript("""
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT, ip TEXT, hostname TEXT,
    status TEXT, latency_ms REAL,
    vendor TEXT, mac TEXT, device_type TEXT
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT, ip TEXT, hostname TEXT,
    event TEXT, network TEXT
);
CREATE TABLE IF NOT EXISTS devices_config (
    ip TEXT PRIMARY KEY, label TEXT,
    whitelisted INTEGER DEFAULT 1,
    notes TEXT, tags TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS fingerprints (
    ip TEXT PRIMARY KEY, type TEXT, os TEXT,
    icon TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT, score INTEGER
);
CREATE TABLE IF NOT EXISTS ports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT, port INTEGER, service TEXT, timestamp TEXT
);
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT, hostname TEXT, cpu_percent REAL,
    ram_percent REAL, disk_percent REAL,
    uptime TEXT, os TEXT, timestamp TEXT
);
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, url TEXT, status TEXT,
    latency_ms REAL, ssl_expiry TEXT, timestamp TEXT
);
CREATE TABLE IF NOT EXISTS wifi_scan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ssid TEXT, bssid TEXT, signal INTEGER,
    channel INTEGER, security TEXT, timestamp TEXT
);
CREATE TABLE IF NOT EXISTS snmp_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT, oid TEXT, value TEXT, timestamp TEXT
);
CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, ip TEXT, detail TEXT, timestamp TEXT
);
    """)
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("✓ Base de données initialisée:", get_db_path())
