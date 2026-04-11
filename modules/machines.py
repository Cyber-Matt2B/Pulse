import sqlite3, datetime, subprocess, sys, socket, re
sys.path.insert(0, '/root/pulse')

DB_PATH = "/root/pulse/pulse.db"

def get_real_ip():
    """Retourne la vraie IP réseau (pas 127.x.x.x)."""
    try:
        # Méthode fiable : ouvrir un socket UDP vers l'extérieur
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def init_machines_table():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, ip TEXT, hostname TEXT,
        cpu_percent REAL, ram_percent REAL, disk_percent REAL,
        uptime TEXT, os TEXT)''')
    conn.commit(); conn.close()

def collect_local():
    init_machines_table()
    try:
        import psutil, platform
        cpu  = psutil.cpu_percent(interval=1)
        ram  = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent
        boot = datetime.datetime.fromtimestamp(psutil.boot_time())
        up   = str(datetime.datetime.now() - boot).split('.')[0]
        os_name  = f"{platform.system()} {platform.release()}"
        ip       = get_real_ip()
        hostname = socket.gethostname()
        conn = sqlite3.connect(DB_PATH)
        ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        conn.execute(
            "INSERT INTO machines (timestamp,ip,hostname,cpu_percent,ram_percent,disk_percent,uptime,os) VALUES (?,?,?,?,?,?,?,?)",
            (ts, ip, hostname, cpu, ram, disk, up, os_name))
        conn.commit(); conn.close()
        return {"ip":ip,"hostname":hostname,"cpu":cpu,"ram":ram,"disk":disk,"uptime":up,"os":os_name}
    except ImportError:
        return {"error":"psutil non installé — faire: pip install psutil"}

def get_machines(ip=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if ip:
        rows = conn.execute(
            "SELECT * FROM machines WHERE ip=? ORDER BY timestamp DESC LIMIT 50",(ip,)).fetchall()
    else:
        rows = conn.execute('''
            SELECT * FROM machines WHERE timestamp=(
                SELECT MAX(timestamp) FROM machines m2 WHERE m2.ip=machines.ip
            ) ORDER BY cpu_percent DESC''').fetchall()
    conn.close()
    return [dict(r) for r in rows]
