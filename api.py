from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sqlite3, datetime, json, os, hashlib, secrets

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
DB_PATH     = _os.path.join(_BASE_DIR, "pulse.db")
CONFIG_PATH = _os.path.join(_BASE_DIR, "config.py")
AUTH_FILE   = _os.path.join(_BASE_DIR, "auth.json")
security    = HTTPBearer(auto_error=False)

# ── Auth ─────────────────────────────────────────────────────

def load_auth():
    if not os.path.exists(AUTH_FILE):
        pw = hashlib.sha256("admin123".encode()).hexdigest()
        with open(AUTH_FILE, "w") as f:
            json.dump({"username": "admin", "password": pw, "token": secrets.token_hex(32)}, f)
    with open(AUTH_FILE) as f:
        return json.load(f)

def get_token():
    return load_auth()["token"]

def require_auth(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds or creds.credentials != get_token():
        raise HTTPException(status_code=401, detail="Non autorisé")
    return True

@app.post("/api/login")
def login(data: dict):
    auth = load_auth()
    pw   = hashlib.sha256(data.get("password","").encode()).hexdigest()
    if data.get("username") != auth["username"] or pw != auth["password"]:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    return {"token": auth["token"], "username": auth["username"]}

@app.post("/api/change_password")
def change_password(data: dict, _=Depends(require_auth)):
    auth = load_auth()
    old  = hashlib.sha256(data.get("old_password","").encode()).hexdigest()
    if old != auth["password"]:
        raise HTTPException(status_code=401, detail="Ancien mot de passe incorrect")
    auth["password"] = hashlib.sha256(data.get("new_password","").encode()).hexdigest()
    auth["token"]    = secrets.token_hex(32)
    with open(AUTH_FILE, "w") as f:
        json.dump(auth, f)
    return {"ok": True, "token": auth["token"]}

# ── DB ───────────────────────────────────────────────────────

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ── Config ───────────────────────────────────────────────────

CONFIG_KEYS = {
    "SCAN_INTERVAL":  {"type":"int",   "label":"Intervalle scan (s)",  "min":60,  "max":3600},
    "LATENCY_SLOW":   {"type":"int",   "label":"Seuil lent (ms)",      "min":50,  "max":2000},
    "LATENCY_SPIKE":  {"type":"float", "label":"Multiplicateur spike", "min":1.5, "max":10},
    "INSTABLE_MIN":   {"type":"int",   "label":"Déco. min. instable",  "min":2,   "max":20},
    "NTFY_ENABLED":   {"type":"bool",  "label":"Alertes Ntfy activées"},
    "NTFY_TOPIC":     {"type":"str",   "label":"Topic Ntfy"},
    "ALERT_ANOMALIE": {"type":"bool",  "label":"Alerter anomalies"},
    "ALERT_INTRUS":   {"type":"bool",  "label":"Alerter intrus"},
    "ALERT_DISPARU":  {"type":"bool",  "label":"Alerter disparus"},
    "ALERT_NOCTURNE": {"type":"bool",  "label":"Alerter activité nocturne"},
}

def read_config():
    values = {}
    with open(CONFIG_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"): continue
            for key in CONFIG_KEYS:
                if line.startswith(key+" ") or line.startswith(key+"="):
                    parts = line.split("=",1)
                    if len(parts)==2:
                        raw = parts[1].strip().split("#")[0].strip()
                        t = CONFIG_KEYS[key]["type"]
                        try:
                            if t=="int":   values[key]=int(raw)
                            elif t=="float": values[key]=float(raw)
                            elif t=="bool":  values[key]=raw=="True"
                            else:            values[key]=raw.strip('"').strip("'")
                        except: values[key]=raw
    return values

def write_config(updates):
    with open(CONFIG_PATH) as f: lines=f.readlines()
    new_lines=[]
    for line in lines:
        written=False
        for key,val in updates.items():
            if line.strip().startswith(key+" ") or line.strip().startswith(key+"="):
                t=CONFIG_KEYS[key]["type"]
                if t=="bool": py_val="True" if val else "False"
                elif t=="str": py_val=f'"{val}"'
                else: py_val=str(val)
                comment=""
                if "#" in line: comment="  # "+line.split("#",1)[1].rstrip()
                new_lines.append(f"{key:<16}= {py_val}{comment}\n")
                written=True; break
        if not written: new_lines.append(line)
    if "NTFY_TOPIC" in updates:
        new_lines=[f'NTFY_URL        = f"https://ntfy.sh/{{NTFY_TOPIC}}"\n' if l.strip().startswith("NTFY_URL") else l for l in new_lines]
    with open(CONFIG_PATH,"w") as f: f.writelines(new_lines)

@app.get("/api/config")
def get_config(_=Depends(require_auth)):
    values=read_config()
    return {k:{**m,"value":values.get(k)} for k,m in CONFIG_KEYS.items()}

@app.post("/api/config")
def set_config(data:dict, _=Depends(require_auth)):
    allowed={k:v for k,v in data.items() if k in CONFIG_KEYS}
    if not allowed: return {"ok":False,"error":"Aucune clé valide"}
    for key,val in allowed.items():
        meta=CONFIG_KEYS[key]
        if meta["type"] in ("int","float"):
            if "min" in meta and val<meta["min"]: return {"ok":False,"error":f"{key} min {meta['min']}"}
            if "max" in meta and val>meta["max"]: return {"ok":False,"error":f"{key} max {meta['max']}"}
    write_config(allowed)
    return {"ok":True,"updated":list(allowed.keys())}

# ── Devices ──────────────────────────────────────────────────

@app.get("/api/devices")
def get_devices(_=Depends(require_auth)):
    c=db().cursor()
    c.execute('''SELECT s.ip,s.hostname,s.status,s.latency_ms,s.timestamp,s.network,
        COALESCE(s.vendor,'inconnu') as vendor,
        (SELECT timestamp FROM scans s2 WHERE s2.ip=s.ip AND s2.status='up'
         ORDER BY s2.timestamp DESC LIMIT 1) as last_seen_up
        FROM scans s WHERE s.timestamp=(SELECT MAX(timestamp) FROM scans) ORDER BY s.ip''')
    return [dict(r) for r in c.fetchall()]

@app.get("/api/history/{ip}")
def history(ip:str, limit:int=100, _=Depends(require_auth)):
    c=db().cursor()
    c.execute('SELECT timestamp,latency_ms,status FROM scans WHERE ip=? ORDER BY timestamp DESC LIMIT ?',(ip,limit))
    return [dict(r) for r in c.fetchall()]

@app.get("/api/events")
def events(_=Depends(require_auth)):
    c=db().cursor()
    c.execute('SELECT timestamp,ip,hostname,event,network FROM events ORDER BY timestamp DESC LIMIT 200')
    return [dict(r) for r in c.fetchall()]

@app.get("/api/stats")
def stats(_=Depends(require_auth)):
    c=db().cursor()
    c.execute("SELECT COUNT(DISTINCT ip) FROM scans"); total=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM scans WHERE status='up' AND timestamp=(SELECT MAX(timestamp) FROM scans)"); online=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM events WHERE event='NOUVEAU' AND timestamp>=datetime('now','-24 hours')"); new24=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM events WHERE event='DISPARU' AND timestamp>=datetime('now','-24 hours')"); gone24=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM scans WHERE timestamp>=datetime('now','-1 hour')"); scans1h=c.fetchone()[0]
    c.execute("SELECT ROUND(AVG(latency_ms),2) FROM scans WHERE status='up' AND timestamp=(SELECT MAX(timestamp) FROM scans)"); avg_lat=c.fetchone()[0]
    return {"total":total,"online":online,"new24":new24,"gone24":gone24,"scans1h":scans1h,"avg_lat":avg_lat}

@app.get("/api/anomalies")
def anomalies(_=Depends(require_auth)):
    c=db().cursor()
    c.execute('''SELECT ip,hostname,ROUND(AVG(latency_ms),1) as avg_lat,
        ROUND(MAX(latency_ms),1) as max_lat,COUNT(*) as scans,
        SUM(CASE WHEN status='down' THEN 1 ELSE 0 END) as downs
        FROM scans WHERE timestamp>=datetime('now','-24 hours')
        GROUP BY ip HAVING avg_lat>200 OR downs>=2 OR max_lat>500 ORDER BY avg_lat DESC''')
    return [dict(r) for r in c.fetchall()]

@app.get("/api/heatmap")
def heatmap(_=Depends(require_auth)):
    c=db().cursor()
    c.execute('''SELECT ip,hostname,strftime('%H',timestamp) as hour,
        COUNT(*) as total,SUM(CASE WHEN status='up' THEN 1 ELSE 0 END) as up
        FROM scans WHERE timestamp>=datetime('now','-7 days')
        GROUP BY ip,hour ORDER BY ip,hour''')
    return [dict(r) for r in c.fetchall()]

@app.get("/api/topology")
def topology(_=Depends(require_auth)):
    c=db().cursor()
    c.execute('SELECT DISTINCT ip,hostname,status,latency_ms FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans)')
    devs=c.fetchall()
    nodes=[{"id":d["ip"],"hostname":d["hostname"],"status":d["status"],"latency":d["latency_ms"]} for d in devs]
    links=[{"source":"192.168.1.1","target":d["ip"]} for d in devs if d["ip"]!="192.168.1.1"]
    return {"nodes":nodes,"links":links}

@app.get("/api/latency_timeline")
def latency_timeline(_=Depends(require_auth)):
    c=db().cursor()
    c.execute('''SELECT ip,hostname,timestamp,latency_ms FROM scans
        WHERE timestamp>=datetime('now','-6 hours') AND status='up' ORDER BY timestamp ASC''')
    rows=c.fetchall(); result={}
    for r in rows:
        if r["ip"] not in result: result[r["ip"]]={"hostname":r["hostname"],"data":[]}
        result[r["ip"]]["data"].append({"t":r["timestamp"],"v":r["latency_ms"]})
    return result

@app.get("/api/devices_config")
def get_devices_config(_=Depends(require_auth)):
    c=db().cursor(); c.execute("SELECT * FROM devices_config")
    return [dict(r) for r in c.fetchall()]

@app.post("/api/devices_config/{ip}")
def set_device_config(ip:str, data:dict, _=Depends(require_auth)):
    conn=db(); c=conn.cursor()
    ts=datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    c.execute('''INSERT INTO devices_config (ip,label,whitelisted,notes,updated_at) VALUES (?,?,?,?,?)
        ON CONFLICT(ip) DO UPDATE SET label=excluded.label,whitelisted=excluded.whitelisted,
        notes=excluded.notes,updated_at=excluded.updated_at''',
        (ip,data.get("label",""),data.get("whitelisted",1),data.get("notes",""),ts))
    conn.commit(); return {"ok":True}

@app.delete("/api/devices_config/{ip}")
def delete_device_config(ip:str, _=Depends(require_auth)):
    conn=db(); c=conn.cursor()
    c.execute("DELETE FROM devices_config WHERE ip=?",(ip,)); conn.commit()
    return {"ok":True}

@app.get("/api/health")
def health_score(_=Depends(require_auth)):
    conn=db(); c=conn.cursor(); score=100; details=[]
    c.execute("SELECT ip,hostname,latency_ms,status FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans)")
    for d in c.fetchall():
        if d["latency_ms"] and d["latency_ms"]>200:
            score-=15; details.append({"icon":"🐢","msg":f"{d['hostname']} lent ({round(d['latency_ms'])}ms)","pts":-15})
    c.execute("SELECT ip,hostname,COUNT(*) as downs FROM scans WHERE status='down' AND timestamp>=datetime('now','-24 hours') GROUP BY ip HAVING downs>=2")
    for d in c.fetchall():
        score-=10; details.append({"icon":"📡","msg":f"{d['hostname']} instable ({d['downs']} déco.)","pts":-10})
    c.execute('''SELECT DISTINCT s.ip,s.hostname FROM scans s LEFT JOIN devices_config dc ON s.ip=dc.ip
        WHERE s.timestamp=(SELECT MAX(timestamp) FROM scans)
        AND (dc.whitelisted=0 OR (dc.ip IS NULL AND s.hostname='inconnu'))''')
    for d in c.fetchall():
        score-=8; details.append({"icon":"🔍","msg":f"Inconnu : {d['ip']}","pts":-8})
    c.execute('''SELECT COUNT(*) as cnt FROM scans s WHERE timestamp>=datetime('now','-1 hour')
        AND latency_ms>(SELECT AVG(latency_ms)*3 FROM scans s2 WHERE s2.ip=s.ip AND latency_ms IS NOT NULL) AND latency_ms>50''')
    spikes=c.fetchone()["cnt"]
    if spikes>0: score-=min(spikes*5,20); details.append({"icon":"⚡","msg":f"{spikes} spike(s)","pts":-min(spikes*5,20)})
    c.execute("SELECT COUNT(*) as cnt FROM events WHERE event='DISPARU' AND timestamp>=datetime('now','-1 hour')")
    disparus=c.fetchone()["cnt"]
    if disparus>0: score-=min(disparus*3,15); details.append({"icon":"👋","msg":f"{disparus} disparu(s)","pts":-min(disparus*3,15)})
    score=max(0,score)
    label="Excellent" if score>=90 else "Bon" if score>=75 else "Moyen" if score>=50 else "Critique"
    color="#00E5A0" if score>=90 else "#38BDF8" if score>=75 else "#FBB03B" if score>=50 else "#F87171"
    conn.close(); return {"score":score,"label":label,"color":color,"details":details}

@app.get("/api/summary")
def summary(_=Depends(require_auth)):
    conn=db(); c=conn.cursor()
    c.execute("SELECT COUNT(DISTINCT ip) FROM scans"); total=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM scans WHERE status='up' AND timestamp=(SELECT MAX(timestamp) FROM scans)"); online=c.fetchone()[0]
    c.execute('''SELECT s.ip,COALESCE(dc.label,s.hostname) as name,ROUND(AVG(s.latency_ms),1) as avg_lat,
        COUNT(*) as scans,SUM(CASE WHEN s.status='down' THEN 1 ELSE 0 END) as downs
        FROM scans s LEFT JOIN devices_config dc ON s.ip=dc.ip
        WHERE s.timestamp>=datetime('now','-6 hours') GROUP BY s.ip ORDER BY avg_lat DESC''')
    all_devices=c.fetchall()
    c.execute('''SELECT s.ip,COALESCE(dc.label,s.hostname) as name,strftime('%H:%M',s.timestamp) as heure
        FROM scans s LEFT JOIN devices_config dc ON s.ip=dc.ip
        WHERE s.timestamp=(SELECT MAX(timestamp) FROM scans)
        AND (dc.whitelisted=0 OR (dc.ip IS NULL AND s.hostname='inconnu'))''')
    intrus=c.fetchall()
    c.execute('''SELECT s.ip,COALESCE(dc.label,s.hostname) as name FROM events e
        LEFT JOIN devices_config dc ON e.ip=dc.ip LEFT JOIN scans s ON e.ip=s.ip
        WHERE e.event='DISPARU' AND e.timestamp>=datetime('now','-8 hours')
        GROUP BY e.ip HAVING COUNT(*)>=5''')
    instables=c.fetchall(); conn.close()
    phrases=[]; recommandations=[]
    if online==total: phrases.append(f"Tous les {total} appareils sont en ligne.")
    elif online==0: phrases.append("Aucun appareil détecté.")
    else: phrases.append(f"{online}/{total} appareils en ligne.")
    slow=[d for d in all_devices if d["avg_lat"] and d["avg_lat"]>200]
    if slow:
        for d in slow:
            name=d["name"].split(".")[0]
            recommandations.append({"niveau":"warning","icon":"🐢","titre":f"Lent — {name}","detail":f"{d['avg_lat']} ms","action":"Rapprocher du routeur ou passer en Ethernet."})
    else: phrases.append("Latence normale.")
    for i in intrus:
        phrases.append(f"Appareil inconnu : {i['ip']}.")
        recommandations.append({"niveau":"danger","icon":"🔍","titre":f"Inconnu — {i['ip']}","detail":"Non whitelisté.","action":"Identifier ou bloquer depuis le routeur."})
    if not intrus: phrases.append("Aucun appareil inconnu.")
    for d in instables:
        recommandations.append({"niveau":"warning","icon":"📡","titre":f"Instable — {d['name']}","detail":"Déconnexions fréquentes.","action":"Vérifier le signal WiFi."})
    c2=db().cursor()
    c2.execute("SELECT COUNT(*) FROM events WHERE event='NOUVEAU' AND strftime('%H',timestamp) BETWEEN '01' AND '05' AND timestamp>=datetime('now','-24 hours')")
    nuit=c2.fetchone()[0]
    if nuit>0:
        phrases.append(f"{nuit} connexion(s) nocturne(s).")
        recommandations.append({"niveau":"warning","icon":"🌙","titre":"Activité nocturne","detail":f"{nuit} connexion(s) entre 1h-5h.","action":"Vérifier le journal."})
    if not recommandations:
        recommandations.append({"niveau":"success","icon":"✓","titre":"Réseau en bonne santé","detail":"Aucun problème.","action":"Aucune action requise."})
    return {"phrases":phrases,"recommandations":recommandations,"generated_at":datetime.datetime.now().strftime('%H:%M')}

@app.get("/api/ports")
def get_ports(ip:str=None, _=Depends(require_auth)):
    c=db().cursor()
    if ip:
        c.execute("SELECT ip,port,protocol,service,timestamp FROM ports WHERE ip=? ORDER BY timestamp DESC LIMIT 200",(ip,))
    else:
        try:
            c.execute("SELECT ip,port,protocol,service,timestamp FROM ports WHERE timestamp=(SELECT MAX(timestamp) FROM ports) ORDER BY ip,port")
        except: return []
    return [dict(r) for r in c.fetchall()]

# ── PDF Report ───────────────────────────────────────────────

@app.get("/api/report/pdf")
def generate_pdf(_=Depends(require_auth)):
    try:
        import weasyprint, tempfile
    except ImportError:
        raise HTTPException(status_code=500, detail="weasyprint non installé. Faire: pip install weasyprint")

    conn=db(); c=conn.cursor()
    c.execute("SELECT COUNT(DISTINCT ip) FROM scans"); total=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM scans WHERE status='up' AND timestamp=(SELECT MAX(timestamp) FROM scans)"); online=c.fetchone()[0]
    c.execute("SELECT ROUND(AVG(latency_ms),1) FROM scans WHERE status='up' AND timestamp=(SELECT MAX(timestamp) FROM scans)"); avg_lat=c.fetchone()[0]
    c.execute("SELECT ip,hostname,status,latency_ms,vendor FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans) ORDER BY ip")
    devices=c.fetchall()
    c.execute("SELECT ip,hostname,event,timestamp FROM events ORDER BY timestamp DESC LIMIT 20")
    events=c.fetchall()
    conn.close()

    now=datetime.datetime.now().strftime('%d/%m/%Y à %H:%M')
    rows="".join(f"""<tr>
        <td><span class='dot {"up" if d["status"]=="up" else "down"}'></span></td>
        <td>{d["ip"]}</td><td>{d["hostname"]}</td>
        <td>{d["vendor"] or "—"}</td>
        <td>{f'{d["latency_ms"]} ms' if d["latency_ms"] else "N/A"}</td>
    </tr>""" for d in devices)
    evt_rows="".join(f"<tr><td>{e['timestamp'][:16]}</td><td>{e['ip']}</td><td>{e['hostname']}</td><td class='{'new' if e['event']=='NOUVEAU' else 'gone'}'>{e['event']}</td></tr>" for e in events)

    html=f"""<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{{font-family:Arial,sans-serif;color:#1e293b;margin:0;padding:0;}}
      .cover{{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:white;padding:60px 48px;}}
      .cover h1{{font-size:36px;margin:0;letter-spacing:2px;}}
      .cover p{{color:#94a3b8;margin:8px 0 0;}}
      .content{{padding:40px 48px;}}
      .stats{{display:flex;gap:16px;margin:24px 0;}}
      .stat{{flex:1;background:#f8fafc;border-radius:8px;padding:16px;text-align:center;border:1px solid #e2e8f0;}}
      .stat .val{{font-size:28px;font-weight:700;color:#0f172a;}}
      .stat .lbl{{font-size:11px;color:#64748b;text-transform:uppercase;margin-top:4px;}}
      h2{{color:#0f172a;font-size:16px;margin:32px 0 12px;border-bottom:2px solid #00E5A0;padding-bottom:6px;}}
      table{{width:100%;border-collapse:collapse;font-size:12px;}}
      th{{background:#f1f5f9;padding:8px 12px;text-align:left;color:#475569;font-weight:600;text-transform:uppercase;font-size:10px;}}
      td{{padding:8px 12px;border-bottom:1px solid #f1f5f9;}}
      .dot{{display:inline-block;width:8px;height:8px;border-radius:50%;}}
      .up{{background:#00E5A0;}}.down{{background:#F87171;}}
      .new{{color:#00A370;font-weight:700;}}.gone{{color:#d97706;font-weight:700;}}
      .footer{{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:10px;text-align:center;}}
    </style></head><body>
    <div class="cover">
      <h1>PULSE</h1>
      <p>Rapport de monitoring réseau · {now}</p>
    </div>
    <div class="content">
      <div class="stats">
        <div class="stat"><div class="val">{total}</div><div class="lbl">Appareils connus</div></div>
        <div class="stat"><div class="val">{online}</div><div class="lbl">En ligne</div></div>
        <div class="stat"><div class="val">{avg_lat or "N/A"} ms</div><div class="lbl">Latence moy.</div></div>
        <div class="stat"><div class="val">{total-online}</div><div class="lbl">Hors ligne</div></div>
      </div>
      <h2>Appareils du dernier scan</h2>
      <table><thead><tr><th></th><th>IP</th><th>Hostname</th><th>Fabricant</th><th>Latence</th></tr></thead>
      <tbody>{rows}</tbody></table>
      <h2>Événements récents</h2>
      <table><thead><tr><th>Date</th><th>IP</th><th>Hostname</th><th>Événement</th></tr></thead>
      <tbody>{evt_rows}</tbody></table>
      <div class="footer">Généré par Pulse · {now}</div>
    </div></body></html>"""

    from fastapi.responses import Response
    pdf=weasyprint.HTML(string=html).write_pdf()
    filename=f"pulse_report_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return Response(content=pdf, media_type="application/pdf",
        headers={"Content-Disposition":f"attachment; filename={filename}"})

# ── Weekly report ─────────────────────────────────────────────

@app.get("/api/report/weekly")
def weekly_report(_=Depends(require_auth)):
    conn=db(); c=conn.cursor()
    c.execute("SELECT COUNT(DISTINCT ip) FROM scans WHERE timestamp>=datetime('now','-7 days')"); total=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM events WHERE event='NOUVEAU' AND timestamp>=datetime('now','-7 days')"); nouveaux=c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM events WHERE event='DISPARU' AND timestamp>=datetime('now','-7 days')"); disparus=c.fetchone()[0]
    c.execute("SELECT ROUND(AVG(latency_ms),1) FROM scans WHERE status='up' AND timestamp>=datetime('now','-7 days')"); avg_lat=c.fetchone()[0]
    conn.close()
    from alerts import send_alert
    msg=f"Résumé semaine :\n• {total} appareils vus\n• {nouveaux} nouvelles connexions\n• {disparus} déconnexions\n• Latence moy. : {avg_lat} ms"
    send_alert("📊 Pulse — Rapport hebdomadaire", msg, priority="default", tags="chart_with_upwards_trend")
    return {"ok":True,"message":msg}

# ── Users ─────────────────────────────────────────────────────

def load_users():
    if not os.path.exists(AUTH_FILE):
        load_auth()
    with open(AUTH_FILE) as f:
        data = json.load(f)
    if "users" not in data:
        data["users"] = [{"username": data["username"], "role": "admin"}]
        with open(AUTH_FILE, "w") as f:
            json.dump(data, f)
    return data

def save_users(data):
    with open(AUTH_FILE, "w") as f:
        json.dump(data, f)

@app.post("/api/login")
def login_unified(body: dict):
    data = load_users()
    pw   = hashlib.sha256(body.get("password", "").encode()).hexdigest()
    # Check main admin
    if body.get("username") == data["username"] and pw == data["password"]:
        return {"token": data["token"], "username": data["username"], "role": "admin"}
    # Check other users
    for u in data.get("users", []):
        if u["username"] == body.get("username") and pw == u.get("password", ""):
            return {"token": u["token"], "username": u["username"], "role": u["role"]}
    raise HTTPException(status_code=401, detail="Identifiants incorrects")

# ── Modules endpoints ─────────────────────────────────────────

import sys
sys.path.insert(0, '/root/pulse')

@app.get("/api/snmp/{ip}")
def api_snmp(ip: str, _=Depends(require_auth)):
    from modules.snmp import scan_snmp
    return scan_snmp(ip)

@app.get("/api/snmp")
def api_snmp_all(_=Depends(require_auth)):
    from modules.snmp import get_snmp_data
    return get_snmp_data()

@app.get("/api/machines")
def api_machines(_=Depends(require_auth)):
    from modules.machines import get_machines, collect_local
    collect_local()
    return get_machines()

@app.get("/api/machines/{ip}")
def api_machine(ip: str, _=Depends(require_auth)):
    from modules.machines import get_machines
    return get_machines(ip)

@app.get("/api/services")
def api_services(_=Depends(require_auth)):
    from modules.services import get_services
    return get_services()

@app.post("/api/services/check")
def api_check_service(data: dict, _=Depends(require_auth)):
    from modules.services import check_service
    return check_service(data.get("url"), data.get("name"))

@app.get("/api/services/history")
def api_service_history(url: str, _=Depends(require_auth)):
    from modules.services import get_service_history
    return get_service_history(url)

@app.get("/api/security")
def api_security(_=Depends(require_auth)):
    from modules.security import get_security_events, run_all_checks
    run_all_checks()
    return get_security_events()

@app.get("/api/wifi")
def api_wifi(_=Depends(require_auth)):
    from modules.wifi import scan_wifi, analyze_channels, get_wifi_history
    networks = scan_wifi()
    if not networks:
        networks = get_wifi_history()
    analysis = analyze_channels(networks)
    return {"networks": networks, "analysis": analysis}

@app.get("/api/timeline")
def api_timeline(limit: int=200, _=Depends(require_auth)):
    c = db().cursor()
    c.execute('''SELECT e.timestamp, e.ip, e.hostname, e.event, e.network,
        COALESCE(dc.label, e.hostname) as label
        FROM events e LEFT JOIN devices_config dc ON e.ip=dc.ip
        ORDER BY e.timestamp DESC LIMIT ?''', (limit,))
    return [dict(r) for r in c.fetchall()]

@app.get("/api/health/save")
def save_health_score(_=Depends(require_auth)):
    """Sauvegarde le score actuel en base — appelé par cron toutes les heures."""
    conn = db()
    c = conn.cursor()
    score = 100
    c.execute("SELECT ip, hostname, latency_ms FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans)")
    for d in c.fetchall():
        if d["latency_ms"] and d["latency_ms"] > 200: score -= 15
    c.execute("SELECT COUNT(*) as cnt FROM scans WHERE status='down' AND timestamp>=datetime('now','-24 hours')")
    if c.fetchone()["cnt"] >= 2: score -= 10
    score = max(0, score)
    label = "Excellent" if score>=90 else "Bon" if score>=75 else "Moyen" if score>=50 else "Critique"
    color = "#00E5A0" if score>=90 else "#38BDF8" if score>=75 else "#FBB03B" if score>=50 else "#F87171"
    ts = __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute("INSERT INTO score_history (timestamp, score, label, color) VALUES (?,?,?,?)", (ts, score, label, color))
    conn.commit()
    conn.close()
    return {"ok": True, "score": score}

@app.get("/api/score_history")
def get_score_history(_=Depends(require_auth)):
    """Retourne l'historique des scores sur 7 jours (1 point par heure)."""
    conn = db()
    rows = conn.execute(
        """SELECT timestamp, score, label, color FROM score_history
           WHERE timestamp >= datetime('now', '-7 days')
           ORDER BY timestamp ASC"""
    ).fetchall()
    conn.close()
    # Si pas encore assez de données, compléter avec le score actuel
    return [dict(r) for r in rows]

@app.get("/api/fingerprints")
def get_fingerprints(_=Depends(require_auth)):
    """Retourne les fingerprints connus de tous les appareils."""
    conn = db()
    rows = conn.execute("SELECT * FROM fingerprints ORDER BY ip").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/fingerprint/scan")
def trigger_fingerprint_scan(_=Depends(require_auth)):
    """Déclenche un fingerprint immédiat sur tous les appareils connus."""
    import subprocess as sp
    conn = db()
    ips = [r[0] for r in conn.execute("SELECT DISTINCT ip FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans)").fetchall()]
    conn.close()
    sys.path.insert(0, '/root/pulse')
    from modules.network import fingerprint_device, ARP_TABLE
    results = []
    for ip in ips:
        from modules.network import get_vendor
        fp = fingerprint_device(ip, "", get_vendor(ip))
        results.append({"ip": ip, **fp})
    return results

# ── Agent push endpoint ───────────────────────────────────────

@app.post("/api/agent/push")
async def agent_push(data: dict):
    """Reçoit les métriques d'un agent Pulse installé sur une machine distante."""
    import datetime
    conn = db()
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    ip       = data.get("ip", "")
    hostname = data.get("hostname", "inconnu")
    cpu      = data.get("cpu_percent", 0)
    ram      = data.get("ram_percent", 0)
    disk     = data.get("disk_percent", 0)
    uptime   = data.get("uptime", "")
    os_name  = data.get("os", "")
    if not ip:
        return {"ok": False, "error": "IP manquante"}
    conn.execute('''INSERT INTO machines (timestamp,ip,hostname,cpu_percent,ram_percent,disk_percent,uptime,os)
        VALUES (?,?,?,?,?,?,?,?)''', (ts,ip,hostname,cpu,ram,disk,uptime,os_name))
    conn.commit()
    conn.close()
    return {"ok": True, "received": ts}

# Servir les fichiers agent
from fastapi.responses import FileResponse, PlainTextResponse
import os as _os

@app.get("/agent/agent.py")
def serve_agent_py():
    return FileResponse(_os.path.join(_BASE_DIR, "agent", "agent.py"), media_type="text/plain")

@app.get("/agent/install")
def serve_install_sh():
    return FileResponse(_os.path.join(_BASE_DIR, "agent", "install_linux.sh"), media_type="text/plain")

@app.get("/agent/install.ps1")
def serve_install_ps1():
    return FileResponse(_os.path.join(_BASE_DIR, "agent", "install_windows.ps1"), media_type="text/plain")

# ── Whitelist rapide ──────────────────────────────────────────

@app.get("/api/whitelist")
def get_whitelist(_=Depends(require_auth)):
    """Retourne tous les appareils avec leur statut whitelist."""
    conn = db()
    c = conn.cursor()
    c.execute('''
        SELECT s.ip, s.hostname, COALESCE(s.vendor,"inconnu") as vendor,
               s.status, s.latency_ms, s.timestamp,
               COALESCE(dc.label,"") as label,
               COALESCE(dc.whitelisted,1) as whitelisted,
               COALESCE(dc.notes,"") as notes,
               f.type as device_type
        FROM scans s
        LEFT JOIN devices_config dc ON s.ip=dc.ip
        LEFT JOIN fingerprints f ON s.ip=f.ip
        WHERE s.timestamp=(SELECT MAX(timestamp) FROM scans)
        ORDER BY dc.whitelisted ASC, s.ip ASC
    ''')
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/whitelist/{ip}")
def set_whitelist(ip: str, data: dict, _=Depends(require_auth)):
    """Ajoute/modifie un appareil dans la whitelist."""
    conn = db()
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute('''INSERT INTO devices_config (ip,label,whitelisted,notes,updated_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(ip) DO UPDATE SET
        label=COALESCE(excluded.label,label),
        whitelisted=excluded.whitelisted,
        notes=COALESCE(excluded.notes,notes),
        updated_at=excluded.updated_at''',
        (ip, data.get("label",""), data.get("whitelisted",1), data.get("notes",""), ts))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/devices/{ip}")
def delete_device(ip: str, _=Depends(require_auth)):
    """Supprime un appareil de la base (hors ligne depuis longtemps)."""
    conn = db()
    conn.execute("DELETE FROM scans WHERE ip=?", (ip,))
    conn.execute("DELETE FROM devices_config WHERE ip=?", (ip,))
    conn.execute("DELETE FROM events WHERE ip=?", (ip,))
    conn.execute("DELETE FROM ports WHERE ip=?", (ip,))
    conn.execute("DELETE FROM fingerprints WHERE ip=?", (ip,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/devices/status")
def devices_with_status(_=Depends(require_auth)):
    """
    Retourne les appareils avec statut calculé intelligent :
    - UP   : vu dans le dernier scan
    - DOWN : absent du dernier scan mais vu récemment
    - GONE : absent depuis plus de 24h (candidat à la suppression)
    """
    conn = db()
    c = conn.cursor()
    last_scan_ts = c.execute("SELECT MAX(timestamp) FROM scans").fetchone()[0]
    c.execute('''
        SELECT s.ip, s.hostname, COALESCE(s.vendor,"inconnu") as vendor,
               s.status, s.latency_ms, s.timestamp,
               COALESCE(dc.label,"") as label,
               COALESCE(dc.whitelisted,1) as whitelisted,
               COALESCE(dc.notes,"") as notes,
               (SELECT MAX(timestamp) FROM scans s2 WHERE s2.ip=s.ip AND s2.status="up") as last_seen_up,
               f.type as device_type, f.icon as device_icon
        FROM scans s
        LEFT JOIN devices_config dc ON s.ip=dc.ip
        LEFT JOIN fingerprints f ON s.ip=f.ip
        WHERE s.timestamp=(SELECT MAX(timestamp) FROM scans)
        ORDER BY s.status DESC, s.ip ASC
    ''')
    current = {r["ip"]: dict(r) for r in c.fetchall()}
    # Appareils absents du dernier scan mais vus dans les 24h
    c.execute('''
        SELECT DISTINCT ip, hostname, COALESCE(vendor,"inconnu") as vendor,
               MAX(timestamp) as last_seen
        FROM scans
        WHERE ip NOT IN (SELECT ip FROM scans WHERE timestamp=?)
        AND timestamp >= datetime("now","-24 hours")
        GROUP BY ip
    ''', (last_scan_ts,))
    for r in c.fetchall():
        if r["ip"] not in current:
            cfg = c.execute("SELECT label,whitelisted,notes FROM devices_config WHERE ip=?", (r["ip"],)).fetchone()
            current[r["ip"]] = {
                "ip": r["ip"], "hostname": r["hostname"], "vendor": r["vendor"],
                "status": "down", "latency_ms": None, "timestamp": r["last_seen"],
                "label": cfg["label"] if cfg else "", "whitelisted": cfg["whitelisted"] if cfg else 1,
                "notes": cfg["notes"] if cfg else "", "last_seen_up": r["last_seen"],
                "device_type": None, "device_icon": None
            }
    conn.close()
    return list(current.values())

@app.post("/api/devices/cleanup")
def cleanup_old_devices(_=Depends(require_auth)):
    """Supprime les appareils absents depuis plus de 7 jours."""
    conn = db()
    c = conn.cursor()
    c.execute('''SELECT DISTINCT ip FROM scans
        WHERE ip NOT IN (
            SELECT DISTINCT ip FROM scans
            WHERE timestamp >= datetime("now","-7 days")
        )''')
    old_ips = [r[0] for r in c.fetchall()]
    for ip in old_ips:
        conn.execute("DELETE FROM scans WHERE ip=?", (ip,))
        conn.execute("DELETE FROM events WHERE ip=?", (ip,))
        conn.execute("DELETE FROM ports WHERE ip=?", (ip,))
        conn.execute("DELETE FROM fingerprints WHERE ip=?", (ip,))
    conn.commit()
    conn.close()
    return {"ok": True, "removed": len(old_ips), "ips": old_ips}

# ── Heartbeat agent ───────────────────────────────────────────

import threading as _threading
_agent_heartbeats = {}

@app.post("/api/agent/ping")
async def agent_ping(data: dict):
    """Heartbeat léger depuis l'agent — juste IP + timestamp."""
    ip = data.get("ip","")
    if ip:
        _agent_heartbeats[ip] = __import__('time').time()
    return {"ok": True}

@app.get("/api/agent/status")
def agent_status(_=Depends(require_auth)):
    """Retourne les agents et leur statut (actif si ping < 10 min)."""
    now = __import__('time').time()
    return [
        {"ip": ip, "active": (now - ts) < 600, "last_seen_ago": int(now - ts)}
        for ip, ts in _agent_heartbeats.items()
    ]

# ── Email notifications ───────────────────────────────────────

@app.post("/api/config/email")
def set_email_config(data: dict, _=Depends(require_auth)):
    """Configure les notifications email."""
    cfg_path = _os.path.join(_BASE_DIR, "email_config.json")
    import json as _json
    with open(cfg_path, "w") as f:
        _json.dump(data, f)
    return {"ok": True}

@app.get("/api/config/email")
def get_email_config(_=Depends(require_auth)):
    import json as _json, os as _os
    cfg_path = _os.path.join(_BASE_DIR, "email_config.json")
    if not _os.path.exists(cfg_path):
        return {"enabled": False, "smtp_host": "", "smtp_port": 587, "user": "", "password": "", "to": ""}
    with open(cfg_path) as f:
        return _json.load(f)

@app.post("/api/test/email")
def test_email(_=Depends(require_auth)):
    """Envoie un email de test."""
    import json as _json, smtplib as _smtp, os as _os
    from email.mime.text import MIMEText
    cfg_path = _os.path.join(_BASE_DIR, "email_config.json")
    if not _os.path.exists(cfg_path):
        return {"ok": False, "error": "Email non configuré"}
    with open(cfg_path) as f:
        cfg = _json.load(f)
    try:
        msg = MIMEText("Test de notification Pulse — tout fonctionne !")
        msg["Subject"] = "Pulse — Test notification"
        msg["From"] = cfg["user"]
        msg["To"] = cfg["to"]
        with _smtp.SMTP(cfg["smtp_host"], cfg["smtp_port"]) as s:
            s.starttls()
            s.login(cfg["user"], cfg["password"])
            s.sendmail(cfg["user"], cfg["to"], msg.as_string())
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ── Backup auto ───────────────────────────────────────────────

@app.get("/api/backup")
def create_backup(_=Depends(require_auth)):
    """Crée un backup de la base SQLite et config.py."""
    import shutil as _shutil, os as _os
    ts = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = _os.path.join(_BASE_DIR, "backups")
    _os.makedirs(backup_dir, exist_ok=True)
    db_backup  = f"{backup_dir}/pulse_{ts}.db"
    cfg_backup = f"{backup_dir}/config_{ts}.py"
    _shutil.copy2(DB_PATH, db_backup)
    _shutil.copy2(CONFIG_PATH, cfg_backup)
    # Garder seulement les 7 derniers backups
    backups = sorted([f for f in _os.listdir(backup_dir) if f.endswith('.db')])
    for old in backups[:-7]:
        _os.remove(f"{backup_dir}/{old}")
        try: _os.remove(f"{backup_dir}/{old.replace('pulse_','config_').replace('.db','.py')}")
        except: pass
    return {"ok": True, "file": db_backup, "timestamp": ts}

@app.get("/api/backups")
def list_backups(_=Depends(require_auth)):
    import os as _os
    backup_dir = _os.path.join(_BASE_DIR, "backups")
    if not _os.path.exists(backup_dir):
        return []
    files = sorted([f for f in _os.listdir(backup_dir) if f.endswith('.db')], reverse=True)
    return [{"name": f, "size": _os.path.getsize(f"{backup_dir}/{f}")} for f in files]

@app.get("/api/snmp/scan")
def snmp_full_scan(_=Depends(require_auth)):
    """Scan SNMP sur tous les appareils connus et retourne les données."""
    import subprocess as sp
    conn = db()
    ips = [r[0] for r in conn.execute(
        "SELECT DISTINCT ip FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans)"
    ).fetchall()]
    conn.close()
    results = []
    for ip in ips:
        try:
            oids = {
                "sysDescr":  "1.3.6.1.2.1.1.1.0",
                "sysUpTime": "1.3.6.1.2.1.1.3.0",
                "sysName":   "1.3.6.1.2.1.1.5.0",
                "ifInOctets":"1.3.6.1.2.1.2.2.1.10.1",
                "ifOutOctets":"1.3.6.1.2.1.2.2.1.16.1",
            }
            data = {"ip": ip, "available": False}
            for key, oid in oids.items():
                r = sp.run(["snmpget","-v2c","-c","public","-t","1","-r","0",ip,oid],
                    capture_output=True, text=True, timeout=2)
                if r.returncode == 0 and "=" in r.stdout:
                    val = r.stdout.split("=",1)[1].strip()
                    val = val.split(":",1)[1].strip() if ":" in val else val
                    data[key] = val.strip('"')
                    data["available"] = True
            results.append(data)
        except Exception:
            results.append({"ip": ip, "available": False})
    return results

@app.get("/api/users")
def get_users(_=Depends(require_auth)):
    import json as _json, os as _os
    auth = load_auth()
    result = [{"username": auth["username"], "role": "admin"}]
    # Charger les utilisateurs supplémentaires si fichier users.json existe
    users_path = _os.path.join(_BASE_DIR, "users.json")
    if _os.path.exists(users_path):
        with open(users_path) as f:
            extra = _json.load(f)
        for u in extra:
            if u["username"] != auth["username"]:
                result.append({"username": u["username"], "role": u.get("role","readonly")})
    return result

@app.post("/api/users")
def create_user_v2(body: dict, _=Depends(require_auth)):
    import json as _json, os as _os, hashlib as _hl
    username = body.get("username","").strip()
    password = body.get("password","")
    role     = body.get("role","readonly")
    if not username or not password:
        return {"ok": False, "error": "Champs manquants"}
    users_path = _os.path.join(_BASE_DIR, "users.json")
    users = []
    if _os.path.exists(users_path):
        with open(users_path) as f:
            users = _json.load(f)
    if any(u["username"]==username for u in users):
        return {"ok": False, "error": "Utilisateur existant"}
    pw_hash = _hl.sha256(password.encode()).hexdigest()
    users.append({"username": username, "password": pw_hash, "role": role})
    with open(users_path, "w") as f:
        _json.dump(users, f)
    return {"ok": True}

@app.delete("/api/users/{username}")
def delete_user_v2(username: str, _=Depends(require_auth)):
    import json as _json, os as _os
    auth = load_auth()
    if username == auth["username"]:
        return {"ok": False, "error": "Impossible de supprimer l'admin"}
    users_path = _os.path.join(_BASE_DIR, "users.json")
    if not _os.path.exists(users_path):
        return {"ok": False, "error": "Utilisateur non trouvé"}
    with open(users_path) as f:
        users = _json.load(f)
    users = [u for u in users if u["username"] != username]
    with open(users_path, "w") as f:
        _json.dump(users, f)
    return {"ok": True}
# ── WebSocket temps réel ──────────────────────────────────────
from fastapi import WebSocket, WebSocketDisconnect
import asyncio as _asyncio

_ws_clients = set()

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _ws_clients.add(ws)
    try:
        while True:
            await _asyncio.sleep(30)
            try:
                conn = db()
                stats = conn.execute("""
                    SELECT COUNT(DISTINCT ip) as total,
                    SUM(CASE WHEN status='up' THEN 1 ELSE 0 END) as online
                    FROM scans WHERE timestamp=(SELECT MAX(timestamp) FROM scans)
                """).fetchone()
                health = conn.execute("SELECT score FROM score_history ORDER BY timestamp DESC LIMIT 1").fetchone()
                conn.close()
                await ws.send_json({
                    "type": "stats",
                    "total": stats["total"] if stats else 0,
                    "online": stats["online"] if stats else 0,
                    "score": health["score"] if health else 0,
                    "timestamp": __import__('datetime').datetime.now().isoformat()
                })
            except Exception:
                break
    except WebSocketDisconnect:
        _ws_clients.discard(ws)

async def broadcast_event(event_type: str, data: dict):
    """Broadcast un événement à tous les clients WebSocket connectés."""
    dead = set()
    for ws in _ws_clients.copy():
        try:
            await ws.send_json({"type": event_type, **data})
        except Exception:
            dead.add(ws)
    _ws_clients -= dead

@app.post("/api/devices/add")
def add_device_manually(data: dict, _=Depends(require_auth)):
    """Ajoute manuellement un appareil à la whitelist sans scan."""
    import datetime as _dt
    ip       = data.get("ip","").strip()
    label    = data.get("label","").strip()
    notes    = data.get("notes","").strip()
    hostname = data.get("hostname", label or "manuel").strip()
    if not ip:
        return {"ok": False, "error": "IP manquante"}
    conn = db()
    ts = _dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    # Insérer dans scans si pas déjà là
    existing = conn.execute("SELECT ip FROM scans WHERE ip=? LIMIT 1", (ip,)).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO scans VALUES (NULL,?,?,?,?,?,?,?,?)",
            (ts, "manuel", ip, hostname, "unknown", None, "inconnu", None)
        )
    # Insérer dans devices_config
    conn.execute("""INSERT INTO devices_config (ip, label, whitelisted, notes, updated_at)
        VALUES (?,?,1,?,?) ON CONFLICT(ip) DO UPDATE SET
        label=excluded.label, whitelisted=1, notes=excluded.notes, updated_at=excluded.updated_at""",
        (ip, label, notes, ts))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/history/{ip}/extended")
def history_extended(ip: str, days: int = 7, _=Depends(require_auth)):
    """Historique latence sur N jours avec agrégation horaire."""
    conn = db()
    rows = conn.execute("""
        SELECT strftime('%Y-%m-%d %H:00', timestamp) as hour,
               AVG(latency_ms) as avg_lat,
               MIN(latency_ms) as min_lat,
               MAX(latency_ms) as max_lat,
               COUNT(*) as scans,
               SUM(CASE WHEN status='up' THEN 1 ELSE 0 END) as up_count
        FROM scans
        WHERE ip=? AND timestamp >= datetime('now', '-' || ? || ' days')
        GROUP BY hour ORDER BY hour ASC
    """, (ip, days)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/security/score")
def security_score(_=Depends(require_auth)):
    """Score de sécurité 0-100 séparé du score réseau."""
    conn = db()
    score = 100
    details = []
    # Ports critiques ouverts
    critical_ports = [23, 3389, 5900, 445]
    for port in critical_ports:
        r = conn.execute(
            "SELECT COUNT(*) as cnt FROM ports WHERE port=? AND timestamp >= datetime('now','-24 hours')",
            (port,)
        ).fetchone()
        if r and r['cnt'] > 0:
            score -= 15
            details.append({"type": "port", "detail": f"Port {port} ouvert", "severity": "HIGH"})
    # Événements ARP spoofing
    arp = conn.execute(
        "SELECT COUNT(*) as cnt FROM security_events WHERE type='arp_spoofing' AND timestamp >= datetime('now','-24 hours')"
    ).fetchone()
    if arp and arp['cnt'] > 0:
        score -= 30
        details.append({"type": "arp", "detail": f"{arp['cnt']} attaque(s) ARP détectée(s)", "severity": "CRITICAL"})
    # Brute force SSH
    bf = conn.execute(
        "SELECT COUNT(*) as cnt FROM security_events WHERE type='brute_force' AND timestamp >= datetime('now','-24 hours')"
    ).fetchone()
    if bf and bf['cnt'] > 0:
        score -= 20
        details.append({"type": "bruteforce", "detail": f"{bf['cnt']} tentative(s) SSH", "severity": "HIGH"})
    # Appareils inconnus non whitelistés
    unknown = conn.execute("""
        SELECT COUNT(*) as cnt FROM scans s
        LEFT JOIN devices_config dc ON s.ip=dc.ip
        WHERE s.timestamp=(SELECT MAX(timestamp) FROM scans)
        AND (dc.whitelisted IS NULL OR dc.whitelisted=0)
    """).fetchone()
    if unknown and unknown['cnt'] > 0:
        score -= unknown['cnt'] * 5
        details.append({"type": "unknown", "detail": f"{unknown['cnt']} appareil(s) inconnu(s)", "severity": "MEDIUM"})
    conn.close()
    score = max(0, min(100, score))
    label = "Excellent" if score>=90 else "Bon" if score>=75 else "Moyen" if score>=50 else "Critique"
    color = "#00E5A0" if score>=90 else "#378ADD" if score>=75 else "#FBB03B" if score>=50 else "#F87171"
    return {"score": score, "label": label, "color": color, "details": details}

@app.get("/api/compare/weeks")
def compare_weeks(_=Depends(require_auth)):
    """Comparaison cette semaine vs semaine dernière."""
    conn = db()
    def week_stats(offset):
        r = conn.execute(f"""
            SELECT
                COUNT(DISTINCT ip) as devices,
                AVG(latency_ms) as avg_lat,
                COUNT(DISTINCT CASE WHEN event='NOUVEAU' THEN ip END) as new_devices
            FROM scans s
            LEFT JOIN events e ON s.ip=e.ip
            WHERE s.timestamp >= datetime('now', '-{7+offset} days')
            AND s.timestamp < datetime('now', '-{offset} days')
        """).fetchone()
        score_r = conn.execute(f"""
            SELECT AVG(score) as avg_score FROM score_history
            WHERE timestamp >= datetime('now', '-{7+offset} days')
            AND timestamp < datetime('now', '-{offset} days')
        """).fetchone()
        return {
            "devices": r['devices'] if r else 0,
            "avg_lat": round(r['avg_lat'] or 0, 2),
            "new_devices": r['new_devices'] if r else 0,
            "avg_score": round(score_r['avg_score'] or 0, 1) if score_r else 0
        }
    this_week = week_stats(0)
    last_week = week_stats(7)
    conn.close()
    def diff(a, b):
        if b == 0: return 0
        return round(((a - b) / b) * 100, 1)
    return {
        "this_week": this_week,
        "last_week": last_week,
        "diff": {
            "devices": diff(this_week['devices'], last_week['devices']),
            "avg_lat": diff(this_week['avg_lat'], last_week['avg_lat']),
            "avg_score": diff(this_week['avg_score'], last_week['avg_score']),
        }
    }

@app.get("/api/devices/{ip}/tags")
def get_device_tags(ip: str, _=Depends(require_auth)):
    conn = db()
    r = conn.execute("SELECT tags FROM devices_config WHERE ip=?", (ip,)).fetchone()
    conn.close()
    if r and r['tags']:
        import json
        try: return json.loads(r['tags'])
        except: return []
    return []

@app.post("/api/devices/{ip}/tags")
def set_device_tags(ip: str, data: dict, _=Depends(require_auth)):
    import json, datetime as _dt
    conn = db()
    tags = json.dumps(data.get("tags", []))
    ts = _dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.execute("""INSERT INTO devices_config (ip, tags, updated_at)
        VALUES (?,?,?) ON CONFLICT(ip) DO UPDATE SET tags=excluded.tags, updated_at=excluded.updated_at""",
        (ip, tags, ts))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/webhook/test")
def test_webhook(_=Depends(require_auth)):
    import json as _json, os as _os, requests as _req
    cfg_path = _os.path.join(_BASE_DIR, "webhook_config.json")
    if not _os.path.exists(cfg_path):
        return {"ok": False, "error": "Webhook non configuré"}
    with open(cfg_path) as f:
        cfg = _json.load(f)
    try:
        _req.post(cfg["url"], json={"text": "Test Pulse webhook — tout fonctionne !"}, timeout=5)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/api/webhook/config")
def set_webhook_config(data: dict, _=Depends(require_auth)):
    import json as _json
    with open(_os.path.join(_BASE_DIR, "webhook_config.json"), "w") as f:
        _json.dump(data, f)
    return {"ok": True}
