import os as _os
import sys as _sys
_BASE_DIR = _os.path.dirname(_os.path.abspath(__file__))
_PULSE_DIR = _os.path.dirname(_BASE_DIR)  # dossier parent = racine pulse
_sys.path.insert(0, _PULSE_DIR)
DB_PATH = _os.path.join(_PULSE_DIR, "pulse.db")

import sqlite3, datetime, ssl, socket, requests, sys


def init_services_table():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, url TEXT, name TEXT,
        status_code INTEGER, response_ms REAL,
        ssl_expiry TEXT, ssl_days INTEGER, up INTEGER)''')
    conn.commit(); conn.close()

def check_ssl(hostname):
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
            s.settimeout(5)
            s.connect((hostname, 443))
            cert   = s.getpeercert()
            expiry = datetime.datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
            days   = (expiry - datetime.datetime.utcnow()).days
            return expiry.strftime('%Y-%m-%d'), days
    except Exception:
        return None, None

def check_service(url, name=None):
    init_services_table()
    name = name or url
    ssl_expiry, ssl_days = None, None
    status_code, response_ms, up = None, None, 0
    try:
        start = datetime.datetime.now()
        r = requests.get(url, timeout=5, allow_redirects=True, verify=False)
        response_ms = (datetime.datetime.now()-start).total_seconds()*1000
        status_code = r.status_code
        up = 1 if status_code < 400 else 0
        if url.startswith("https://"):
            hostname = url.split("/")[2]
            ssl_expiry, ssl_days = check_ssl(hostname)
    except Exception:
        up = 0
    conn = sqlite3.connect(DB_PATH)
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute("INSERT INTO services (timestamp,url,name,status_code,response_ms,ssl_expiry,ssl_days,up) VALUES (?,?,?,?,?,?,?,?)",
        (ts,url,name,status_code,response_ms,ssl_expiry,ssl_days,up))
    conn.commit(); conn.close()
    return {"url":url,"name":name,"status_code":status_code,"response_ms":round(response_ms or 0,1),"ssl_expiry":ssl_expiry,"ssl_days":ssl_days,"up":up}

def get_services():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """SELECT * FROM services WHERE timestamp=(
            SELECT MAX(timestamp) FROM services s2 WHERE s2.url=services.url
        ) ORDER BY url""").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_service_history(url, limit=50):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM services WHERE url=? ORDER BY timestamp DESC LIMIT ?",(url,limit)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# URLs à surveiller (modifiable)
DEFAULT_URLS = []  # ex: [("https://monsite.com","Mon Site")]
