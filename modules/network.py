import nmap
import sqlite3
import datetime
import netifaces
import ipaddress
import subprocess
import threading
import sys
import manuf

sys.path.insert(0, '/root/pulse')
from ping3 import ping
from alerts import alert_anomalie, alert_intrus, alert_disparu, alert_nocturne
from config import LATENCY_SLOW, LATENCY_SPIKE, INSTABLE_MIN

DB_PATH    = "/root/pulse/pulse.db"
MAC_PARSER = manuf.MacParser()
ARP_TABLE  = {}

# Ports surveillés (SSH, HTTP, HTTPS, SMB, RDP, VNC, FTP, Telnet)
PORTS_TO_SCAN = "21,22,23,80,443,445,3389,5900,8080,8443"

# ══════════════════════════════════════════
# RÉSEAU
# ══════════════════════════════════════════

def get_all_networks():
    networks = []
    for iface in netifaces.interfaces():
        addrs = netifaces.ifaddresses(iface)
        if netifaces.AF_INET not in addrs:
            continue
        for addr in addrs[netifaces.AF_INET]:
            ip      = addr.get("addr", "")
            netmask = addr.get("netmask", "")
            if not ip or not netmask:
                continue
            if ip.startswith("127.") or ip.startswith("169.254."):
                continue
            try:
                network = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                if network.prefixlen < 16:
                    continue
                networks.append({"interface": iface, "ip": ip, "network": str(network)})
            except ValueError:
                continue
    return networks

def get_arp_table(hosts):
    """Ping chaque IP en parallele pour peupler la table ARP puis la lire."""
    def ping_host(ip):
        subprocess.run(['ping', '-c', '1', '-W', '1', ip], capture_output=True)
    threads = [threading.Thread(target=ping_host, args=(ip,)) for ip in hosts]
    for t in threads: t.start()
    for t in threads: t.join()
    arp = {}
    try:
        result = subprocess.run(['arp', '-n'], capture_output=True, text=True)
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 3 and ':' in parts[2]:
                arp[parts[0]] = parts[2]
    except Exception:
        pass
    return arp

def get_vendor(ip):
    mac = ARP_TABLE.get(ip, '')
    if not mac or mac == '<incomplete>':
        return "inconnu"
    try:
        vendor = MAC_PARSER.get_manuf(mac)
        return vendor if vendor else "inconnu"
    except Exception:
        return "inconnu"

# ══════════════════════════════════════════
# BASE DE DONNÉES
# ══════════════════════════════════════════

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, network TEXT, ip TEXT,
        hostname TEXT, status TEXT, latency_ms REAL,
        vendor TEXT)''')
    try:
        c.execute("ALTER TABLE scans ADD COLUMN vendor TEXT")
    except Exception:
        pass
    c.execute('''CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT, network TEXT, ip TEXT,
        hostname TEXT, event TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS devices_config (
        ip TEXT PRIMARY KEY,
        label TEXT,
        whitelisted INTEGER DEFAULT 1,
        notes TEXT,
        updated_at TEXT)''')
    # Nouvelle table ports
    c.execute('''CREATE TABLE IF NOT EXISTS ports (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT,
        ip          TEXT,
        port        INTEGER,
        protocol    TEXT,
        service     TEXT,
        state       TEXT)''')
    conn.commit()
    conn.close()

def get_last_scan_ips(network):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''SELECT DISTINCT ip FROM scans
        WHERE network = ? AND timestamp = (
            SELECT MAX(timestamp) FROM scans WHERE network = ?)''',
        (network, network))
    ips = {row[0] for row in c.fetchall()}
    conn.close()
    return ips

def get_last_seen(ip, network):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''SELECT timestamp FROM scans
        WHERE ip = ? AND network = ? AND status = 'up'
        ORDER BY timestamp DESC LIMIT 1''', (ip, network))
    row = c.fetchone()
    conn.close()
    return row[0] if row else "premiere apparition"

def save_scan(devices, network):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for d in devices:
        c.execute('INSERT INTO scans VALUES (NULL,?,?,?,?,?,?,?,?)',
            (ts, network, d["ip"], d["hostname"], d["status"],
             d["latency"], d.get("vendor", "inconnu"), d.get("device_type", None)))
    conn.commit()
    conn.close()

def save_event(network, ip, hostname, event):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    c.execute('INSERT INTO events VALUES (NULL,?,?,?,?,?)',
        (ts, network, ip, hostname, event))
    conn.commit()
    conn.close()

def get_device_history(ip, network, limit=10):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''SELECT latency_ms, status FROM scans
        WHERE ip = ? AND network = ?
        ORDER BY timestamp DESC LIMIT ?''', (ip, network, limit))
    rows = c.fetchall()
    conn.close()
    return rows

def get_device_scan_count(ip, network):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT COUNT(*) FROM scans WHERE ip = ? AND network = ?', (ip, network))
    count = c.fetchone()[0]
    conn.close()
    return count

def is_whitelisted(ip):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT whitelisted FROM devices_config WHERE ip = ?', (ip,))
    row = c.fetchone()
    conn.close()
    if row is None:
        return True
    return bool(row[0])

# ══════════════════════════════════════════
# SCAN DE PORTS
# ══════════════════════════════════════════

def scan_ports(ip: str) -> list:
    """Scan les ports ouverts sur une IP avec nmap -sV."""
    nm = nmap.PortScanner()
    try:
        nm.scan(hosts=ip, arguments=f"-sV -p {PORTS_TO_SCAN} --open -T4")
    except Exception as e:
        print(f"  [ports] Erreur nmap sur {ip}: {e}")
        return []
    if ip not in nm.all_hosts():
        return []
    results = []
    for proto in nm[ip].all_protocols():
        for port in nm[ip][proto].keys():
            info = nm[ip][proto][port]
            if info["state"] == "open":
                results.append({
                    "port":     port,
                    "protocol": proto,
                    "service":  info.get("name", "inconnu"),
                    "state":    "open",
                })
    return results

def save_ports(ip: str, ports: list):
    """Sauvegarde les ports ouverts en base SQLite."""
    if not ports:
        return
    conn = sqlite3.connect(DB_PATH)
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    conn.executemany(
        "INSERT INTO ports (timestamp, ip, port, protocol, service, state) VALUES (?,?,?,?,?,?)",
        [(ts, ip, p["port"], p["protocol"], p["service"], p["state"]) for p in ports]
    )
    conn.commit()
    conn.close()

def get_previous_ports(ip: str) -> set:
    """Retourne les ports ouverts lors du dernier scan de cette IP."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        """SELECT DISTINCT port FROM ports
           WHERE ip = ?
           AND timestamp = (SELECT MAX(timestamp) FROM ports WHERE ip = ?)""",
        (ip, ip)
    ).fetchall()
    conn.close()
    return {r[0] for r in rows}

def check_new_ports(ip: str, current_ports: list) -> list:
    """Retourne les nouveaux ports apparus depuis le dernier scan."""
    previous = get_previous_ports(ip)
    current  = {p["port"] for p in current_ports}
    return list(current - previous)

def run_port_scan(ip: str, hostname: str):
    """Lance le scan de ports en arrière-plan et alerte si nouveau port."""
    ports = scan_ports(ip)
    if not ports:
        return
    new_ports = check_new_ports(ip, ports)
    save_ports(ip, ports)
    ports_str = ", ".join(
        f"{p['port']}/{p['service']}" for p in ports
    )
    print(f"  [ports] {ip} ({hostname}) — {ports_str}")
    if new_ports:
        from alerts import send_alert
        ports_label = ", ".join(str(p) for p in new_ports)
        send_alert(
            f"⚠️ Nouveau port — {hostname or ip}",
            f"Port(s) {ports_label} détecté(s) sur {ip} ({hostname})"
        )
        print(f"  [ports] ⚠️  Nouveau(x) port(s) sur {ip} : {ports_label}")

# ══════════════════════════════════════════
# DÉTECTION
# ══════════════════════════════════════════

def detect_changes(current_devices, last_ips, network):
    current_ips = {d["ip"] for d in current_devices}
    events = []
    for d in current_devices:
        if d["ip"] in current_ips - last_ips:
            events.append((d["ip"], d["hostname"], "NOUVEAU"))
            save_event(network, d["ip"], d["hostname"], "NOUVEAU")
            if d["hostname"] == "inconnu" and not is_whitelisted(d["ip"]):
                alert_intrus(d["ip"], network)
    for ip in last_ips - current_ips:
        events.append((ip, "inconnu", "DISPARU"))
        save_event(network, ip, "inconnu", "DISPARU")
        alert_disparu("inconnu", ip)
    return events

def analyze_device(ip, hostname, current_latency, network):
    alerts = []
    history = get_device_history(ip, network, limit=10)
    if len(history) < 2:
        return alerts
    latencies = [row[0] for row in history if row[0] is not None]
    statuses  = [row[1] for row in history]
    if latencies:
        avg = sum(latencies) / len(latencies)
        if current_latency and current_latency > avg * LATENCY_SPIKE and current_latency > 50:
            alerts.append(f"Spike : {current_latency}ms vs moy. {round(avg,1)}ms")
        if avg > LATENCY_SLOW:
            alerts.append(f"Lent en moyenne : {round(avg,1)}ms")
    if statuses.count("down") >= INSTABLE_MIN:
        alerts.append(f"Instable : {statuses.count('down')} deconnexions")
    if get_device_scan_count(ip, network) <= 2 and hostname == "inconnu":
        alerts.append("Inconnu recent — a identifier")
    return alerts

def check_nocturnal_activity():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''SELECT COUNT(*) FROM events
        WHERE event='NOUVEAU'
        AND strftime('%H', timestamp) BETWEEN '01' AND '05'
        AND timestamp >= datetime('now', '-24 hours')''')
    count = c.fetchone()[0]
    conn.close()
    if count > 0:
        alert_nocturne(count)

def get_latency(ip):
    try:
        result = ping(ip, timeout=1)
        return round(result * 1000, 2) if result else None
    except Exception:
        return None

# ══════════════════════════════════════════
# SCAN
# ══════════════════════════════════════════

def scan_network(network_info):
    global ARP_TABLE
    scanner = nmap.PortScanner()
    network = network_info["network"]
    iface   = network_info["interface"]

    print(f"\n  Interface : {iface} ({network_info['ip']})")
    print(f"  Reseau    : {network}")
    print(f"  {'─'*55}")

    scanner.scan(hosts=network, arguments="-sn")

    hosts     = list(scanner.all_hosts())
    ARP_TABLE = get_arp_table(hosts)

    last_ips = get_last_scan_ips(network)

    devices = []
    for host in hosts:
        try:
            fp = fingerprint_device(host, scanner[host].hostname() or "inconnu", get_vendor(host))
        except NameError:
            fp = {"type":"Inconnu","os":"?","icon":"router"}
        devices.append({
            "ip":         host,
            "hostname":   scanner[host].hostname() or "inconnu",
            "status":     scanner[host].state(),
            "latency":    get_latency(host),
            "vendor":     get_vendor(host),
            "device_type": fp["type"],
            "device_os":   fp["os"],
            "device_icon": fp["icon"],
        })

    if not devices:
        print("  Aucun appareil detecte.")
        return

    print(f"\n  {'IP':<18} {'Hostname':<25} {'Fabricant':<15} {'Latence':<12} {'Derniere UP'}")
    print(f"  {'-'*18} {'-'*25} {'-'*15} {'-'*12} {'-'*18}")

    all_alerts = []
    port_threads = []

    for d in devices:
        latence = f"{d['latency']} ms" if d["latency"] else "N/A"
        last    = get_last_seen(d["ip"], network)
        vendor  = (d["vendor"] or "inconnu")[:14]
        print(f"  {d['ip']:<18} {d['hostname']:<25} {vendor:<15} {latence:<12} {last}")
        alerts = analyze_device(d["ip"], d["hostname"], d["latency"], network)
        if alerts:
            all_alerts.append((d["ip"], d["hostname"], d["vendor"], alerts))

        # Scan de ports en arrière-plan (uniquement les hosts UP)
        if d["status"] == "up":
            t = threading.Thread(
                target=run_port_scan,
                args=(d["ip"], d["hostname"]),
                daemon=True
            )
            t.start()
            port_threads.append(t)

    events = detect_changes(devices, last_ips, network)
    if events:
        print(f"\n  --- Evenements ---")
        for ip, hostname, event in events:
            print(f"    {event} : {ip} ({hostname})")

    if all_alerts:
        print(f"\n  --- Anomalies ---")
        for ip, hostname, vendor, alerts in all_alerts:
            print(f"\n    {ip} ({hostname}) [{vendor}]")
            for alert in alerts:
                print(f"      {alert}")
            alert_anomalie(hostname, alerts)
    else:
        print(f"\n  Aucune anomalie detectee")

    save_scan(devices, network)
    # Sauvegarder les fingerprints
    conn = sqlite3.connect(DB_PATH)
    ts = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    for d in devices:
        if d.get("device_type") and d["device_type"] != "Inconnu":
            conn.execute("""INSERT INTO fingerprints (ip, type, os, icon, updated_at)
                VALUES (?,?,?,?,?) ON CONFLICT(ip) DO UPDATE SET
                type=excluded.type, os=excluded.os, icon=excluded.icon, updated_at=excluded.updated_at""",
                (d["ip"], d["device_type"], d["device_os"], d["device_icon"], ts))
    conn.commit()
    conn.close()

    # Attendre la fin des scans de ports
    print(f"\n  --- Ports ouverts ---")
    for t in port_threads:
        t.join(timeout=30)

    print(f"\n  {len(devices)} appareil(s) analyses\n")

# ══════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════

def main():
    init_db()
    print(f"\n{'='*55}")
    print(f"  Pulse — Scanner reseau")
    print(f"  {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print(f"{'='*55}")

    networks = get_all_networks()
    if not networks:
        print("\n  Aucun reseau detecte.")
        return

    print(f"\n  {len(networks)} reseau(x) detecte(s) :\n")
    for n in networks:
        print(f"  {n['interface']} -> {n['network']}")

    for network_info in networks:
        scan_network(network_info)

    check_nocturnal_activity()
    print(f"{'='*55}\n")

if __name__ == "__main__":
    main()

# ══════════════════════════════════════════
# FINGERPRINTING
# ══════════════════════════════════════════

def fingerprint_device(ip, hostname, vendor, open_ports=None):
    """
    Identifie le type d'appareil via TTL + hostname + vendor + ports.
    Retourne un dict {type, os, icon}
    """
    h = (hostname or "").lower()
    v = (vendor or "").lower()
    p = set(open_ports or [])

    # Via hostname
    if any(x in h for x in ["iphone","ipad"]): return {"type":"iPhone/iPad","os":"iOS","icon":"phone"}
    if any(x in h for x in ["samsung","s24","s23","galaxy","android"]): return {"type":"Android","os":"Android","icon":"phone"}
    if any(x in h for x in ["macbook","imac","mac-"]): return {"type":"Mac","os":"macOS","icon":"laptop"}
    if any(x in h for x in ["laptop","pc-","desktop","windows"]): return {"type":"PC Windows","os":"Windows","icon":"laptop"}
    if any(x in h for x in ["raspberrypi","raspberry"]): return {"type":"Raspberry Pi","os":"Linux","icon":"server"}
    if any(x in h for x in ["livebox","bbox","freebox","sfr","routeur","router","gateway"]): return {"type":"Routeur","os":"firmware","icon":"router"}
    if any(x in h for x in ["nas","synology","qnap","diskstation"]): return {"type":"NAS","os":"DSM","icon":"nas"}
    if any(x in h for x in ["cam","camera","nvr","dahua","hikvision","ring"]): return {"type":"Caméra IP","os":"firmware","icon":"camera"}
    if any(x in h for x in ["tv","smart-tv","samsung-tv","lg-tv","appletv","chromecast","firetv"]): return {"type":"TV connectée","os":"SmartTV","icon":"tv"}
    if any(x in h for x in ["printer","epson","canon","hp-","brother"]): return {"type":"Imprimante","os":"firmware","icon":"server"}
    if any(x in h for x in ["network-insight","pulse","server","srv"]): return {"type":"Serveur","os":"Linux","icon":"server"}

    # Via vendor MAC
    if any(x in v for x in ["apple"]): return {"type":"Apple","os":"iOS/macOS","icon":"phone"}
    if any(x in v for x in ["samsung"]): return {"type":"Samsung","os":"Android","icon":"phone"}
    if any(x in v for x in ["arcadyan","sagemcom","technicolor","sercomm"]): return {"type":"Routeur/Box","os":"firmware","icon":"router"}
    if any(x in v for x in ["synology","qnap","buffalo"]): return {"type":"NAS","os":"firmware","icon":"nas"}
    if any(x in v for x in ["micro-star","msi","asus","gigabyte","intel","amd"]): return {"type":"PC","os":"Windows/Linux","icon":"laptop"}
    if any(x in v for x in ["raspberry"]): return {"type":"Raspberry Pi","os":"Linux","icon":"server"}
    if any(x in v for x in ["hikvision","dahua","axis","hanwha"]): return {"type":"Caméra IP","os":"firmware","icon":"camera"}

    # Via ports ouverts
    if 3389 in p: return {"type":"PC Windows","os":"Windows","icon":"laptop"}
    if 548 in p or 5009 in p: return {"type":"Mac","os":"macOS","icon":"laptop"}
    if 22 in p and 80 in p: return {"type":"Serveur Linux","os":"Linux","icon":"server"}
    if 445 in p: return {"type":"PC Windows","os":"Windows","icon":"laptop"}
    if 9100 in p: return {"type":"Imprimante","os":"firmware","icon":"server"}

    # Via TTL (si disponible)
    try:
        r = subprocess.run(['ping','-c','1','-W','1',ip], capture_output=True, text=True)
        for line in r.stdout.splitlines():
            if 'ttl=' in line.lower():
                ttl = int(line.lower().split('ttl=')[1].split()[0])
                if ttl <= 64: return {"type":"Linux/Android","os":"Linux","icon":"server"}
                if ttl <= 128: return {"type":"PC Windows","os":"Windows","icon":"laptop"}
    except Exception:
        pass

    return {"type":"Inconnu","os":"?","icon":"router"}
