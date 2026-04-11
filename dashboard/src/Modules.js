import React, { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';

const API = "http://192.168.1.16:8000";

function authH(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/* ── TIMELINE ── */
export function Timeline({ token, C, lang="fr" }) {
  const [events, setEvents]   = useState([]);
  const [filter, setFilter]   = useState("ALL");
  const [search, setSearch]   = useState("");
  const [range, setRange]     = useState("all");
  const [loading, setLoading] = useState(true);
  const svgRef = useRef();

  const RANGES = lang==="en"
    ? [["1h","1 hour"],["6h","6 hours"],["24h","24 hours"],["7d","7 days"],["all","All"]]
    : [["1h","1 heure"],["6h","6 heures"],["24h","24 heures"],["7d","7 jours"],["all","Tout"]];

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/timeline?limit=1000`, authH(token))
      .then(r => r.json())
      .then(data => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const now = Date.now();
  const rangeMs = { "1h":3600000, "6h":21600000, "24h":86400000, "7d":604800000, "all": Infinity };

  const filtered = events.filter(e => {
    const ms = rangeMs[range] || Infinity;
    if (ms !== Infinity && (now - new Date(e.timestamp)) > ms) return false;
    if (filter !== "ALL" && e.event !== filter) return false;
    if (search && !e.ip?.includes(search) && !(e.label||e.hostname||"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // D3 mini-chart : distribution des événements dans le temps
  useEffect(() => {
    if (!filtered.length || !svgRef.current) return;
    const W = svgRef.current.parentElement?.clientWidth || 600;
    const H = 60;
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const times = filtered.map(e => new Date(e.timestamp));
    const x = d3.scaleTime().domain(d3.extent(times)).range([0, W]);
    const bins = d3.bin().value(d => d).thresholds(d3.timeMinute.every(30))(times);
    const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)||1]).range([H-4, 4]);
    svg.selectAll("rect").data(bins).join("rect")
      .attr("x", b => x(b.x0)+1)
      .attr("y", b => y(b.length))
      .attr("width", b => Math.max(0, x(b.x1)-x(b.x0)-2))
      .attr("height", b => H-4-y(b.length))
      .attr("rx", 2)
      .attr("fill", b => b.some(t => {
        const ev = filtered.find(e => new Date(e.timestamp).getTime()===t.getTime());
        return ev?.event==="NOUVEAU";
      }) ? C.green : C.amber)
      .attr("opacity", 0.7);
  }, [filtered, C]);

  const inp = { background:C.inputBg||C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, padding:"6px 10px", fontSize:12, outline:"none" };
  const labels = lang==="en" ? { all:"All", new:"NEW", gone:"GONE", events:"events" } : { all:"Tous", new:"NOUVEAU", gone:"DISPARU", events:"événements" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Contrôles */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <span style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>Timeline</span>
        <input placeholder={lang==="en"?"Search IP or name…":"Rechercher IP ou nom…"} value={search} onChange={e=>setSearch(e.target.value)} style={{...inp, width:180}}/>
        {["ALL","NOUVEAU","DISPARU"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background:filter===f?`${C.green}20`:"none", border:`1px solid ${filter===f?C.green:C.border}`, borderRadius:6, color:filter===f?C.green:C.textMid, padding:"4px 10px", fontSize:11, cursor:"pointer" }}>
            {f==="ALL"?labels.all:f==="NOUVEAU"?labels.new:labels.gone}
          </button>
        ))}
        <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
          {RANGES.map(([v,l]) => (
            <button key={v} onClick={() => setRange(v)}
              style={{ background:range===v?`${C.blue}20`:"none", border:`1px solid ${range===v?C.blue:C.border}`, borderRadius:6, color:range===v?C.blue:C.textDim, padding:"4px 8px", fontSize:11, cursor:"pointer" }}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ color:C.textDim, fontSize:11 }}>{filtered.length} {labels.events}</span>
      </div>

      {/* Mini chart D3 */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px 6px" }}>
        <div style={{ color:C.textDim, fontSize:10, marginBottom:4 }}>{lang==="en"?"Event distribution":"Distribution des événements"}</div>
        <svg ref={svgRef} style={{ display:"block", width:"100%" }}/>
      </div>

      {/* Liste */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:32, textAlign:"center", color:C.textDim }}>
            {lang==="en"?"Loading…":"Chargement…"}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:32, textAlign:"center", color:C.textDim }}>
            {lang==="en"?"No events":"Aucun événement"}
          </div>
        ) : (
          <div style={{ maxHeight:500, overflowY:"auto" }}>
            {filtered.map((e, i) => {
              const isNew = e.event === "NOUVEAU";
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:isNew?`${C.green}04`:`${C.amber}04` }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:isNew?C.green:C.amber }}/>
                  <div style={{ color:C.textDim, fontSize:11, fontFamily:"monospace", width:130, flexShrink:0 }}>{e.timestamp?.slice(0,16)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ color:C.text, fontSize:12, fontWeight:500 }}>{e.label || e.hostname}</span>
                    <span style={{ color:C.textDim, fontSize:11, marginLeft:8 }}>{e.ip}</span>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, color:isNew?C.green:C.amber, background:isNew?`${C.green}15`:`${C.amber}15`, border:`1px solid ${isNew?C.green:C.amber}40`, flexShrink:0 }}>
                    {isNew?labels.new:labels.gone}
                  </span>
                  <span style={{ color:C.textDim, fontSize:10, flexShrink:0 }}>{e.network}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── MACHINES ── */
export function Machines({ token, C , lang="fr"}) {
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/machines`, authH(token))
      .then(r => r.json()).then(setMachines).catch(() => {});
  }, []);

  const Bar = ({ value, color }) => (
    <div style={{ flex:1, background:C.border, borderRadius:4, height:6, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(value||0,100)}%`, height:"100%", background:value>90?C.red:value>70?C.amber:color, borderRadius:4, transition:"width 0.5s" }}/>
    </div>
  );

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
        <span style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>🖥️ Machines</span>
      </div>
      {machines.length === 0 ? (
        <div style={{ padding:32, textAlign:"center", color:C.textDim, fontSize:13 }}>Aucune machine supervisée</div>
      ) : machines.map((m, i) => (
        <div key={i} style={{ padding:"14px 16px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:C.green }}/>
            <span style={{ color:C.text, fontWeight:600, fontSize:13 }}>{m.hostname}</span>
            <span style={{ color:C.textDim, fontSize:11, fontFamily:"monospace" }}>{m.ip}</span>
            <span style={{ color:C.textDim, fontSize:11, marginLeft:"auto" }}>{m.os}</span>
            <span style={{ color:C.textDim, fontSize:10 }}>↑ {m.uptime}</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[
              { label:"CPU",    value:m.cpu_percent,  color:C.blue },
              { label:"RAM",    value:m.ram_percent,  color:C.purple },
              { label:"Disque", value:m.disk_percent, color:C.amber },
            ].map(s => (
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color:C.textDim, fontSize:11, width:40 }}>{s.label}</span>
                <Bar value={s.value} color={s.color}/>
                <span style={{ color:s.value>90?C.red:s.value>70?C.amber:C.text, fontSize:12, fontWeight:600, width:40, textAlign:"right" }}>{s.value?.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── SERVICES WEB ── */
export function ServicesWeb({ token, C , lang="fr"}) {
  const [services, setServices] = useState([]);
  const [newUrl, setNewUrl]     = useState("");
  const [newName, setNewName]   = useState("");
  const [checking, setChecking] = useState(false);

  const load = () => {
    fetch(`${API}/api/services`, authH(token))
      .then(r => r.json()).then(setServices).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const check = async () => {
    if (!newUrl) return;
    setChecking(true);
    await fetch(`${API}/api/services/check`, { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body: JSON.stringify({url:newUrl, name:newName||newUrl}) });
    setNewUrl(""); setNewName(""); setChecking(false); load();
  };

  const inp = { background:C.inputBg||C.bg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, padding:"7px 10px", fontSize:12, outline:"none" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>🌐 Services web surveillés</span>
        </div>
        {services.length === 0 ? (
          <div style={{ padding:24, textAlign:"center", color:C.textDim, fontSize:13 }}>Aucun service configuré — ajoutez une URL ci-dessous</div>
        ) : services.map((s, i) => {
          const sslWarn = s.ssl_days !== null && s.ssl_days < 30;
          return (
            <div key={i} style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", flexShrink:0, background:s.up?C.green:C.red, boxShadow:`0 0 6px ${s.up?C.green:C.red}` }}/>
              <div style={{ flex:1 }}>
                <div style={{ color:C.text, fontSize:13, fontWeight:500 }}>{s.name}</div>
                <div style={{ color:C.textDim, fontSize:11 }}>{s.url}</div>
              </div>
              <div style={{ display:"flex", gap:16, alignItems:"center" }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ color:s.response_ms>1000?C.red:s.response_ms>500?C.amber:C.green, fontSize:13, fontWeight:600 }}>{s.response_ms ? `${Math.round(s.response_ms)}ms` : "N/A"}</div>
                  <div style={{ color:C.textDim, fontSize:10 }}>Réponse</div>
                </div>
                {s.ssl_expiry && (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ color:sslWarn?C.red:C.green, fontSize:13, fontWeight:600 }}>{s.ssl_days}j</div>
                    <div style={{ color:C.textDim, fontSize:10 }}>SSL</div>
                  </div>
                )}
                <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, color:s.up?C.green:C.red, background:s.up?`${C.green}15`:`${C.red}15`, border:`1px solid ${s.up?C.green:C.red}40` }}>
                  {s.up ? "UP" : "DOWN"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ajouter service */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
        <div style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{lang==="en"?"Add service":"Ajouter un service"}</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input placeholder="https://monsite.com" value={newUrl} onChange={e=>setNewUrl(e.target.value)} style={{...inp, flex:2, minWidth:200}}/>
          <input placeholder="Nom (optionnel)" value={newName} onChange={e=>setNewName(e.target.value)} style={{...inp, flex:1, minWidth:120}}/>
          <button onClick={check} disabled={checking||!newUrl}
            style={{ background:C.green, border:"none", borderRadius:6, color:"#0a0a0a", padding:"7px 16px", fontWeight:700, fontSize:13, cursor:"pointer", opacity:checking?0.6:1 }}>
            {checking?"...":"Vérifier"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SÉCURITÉ ── */
export function Security({ token, C , lang="fr"}) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/security`, authH(token))
      .then(r => r.json()).then(setEvents).catch(() => {});
  }, []);

  const sevColor = s => s==="HIGH"?C.red:s==="MEDIUM"?C.amber:C.textMid;

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:events.length?C.red:C.green, boxShadow:events.length?`0 0 8px ${C.red}`:"none" }}/>
        <span style={{ color:events.length?C.red:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>
          🛡️ Sécurité réseau — {events.length} événement(s)
        </span>
      </div>
      {events.length === 0 ? (
        <div style={{ padding:32, textAlign:"center", color:C.green, fontSize:13 }}>✓ Aucune menace détectée</div>
      ) : events.map((e, i) => (
        <div key={i} style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0, background:sevColor(e.severity) }}/>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:sevColor(e.severity), fontSize:12, fontWeight:700 }}>{e.type.replace(/_/g," ")}</span>
              <span style={{ color:C.textDim, fontSize:11, fontFamily:"monospace" }}>{e.ip}</span>
            </div>
            <div style={{ color:C.textDim, fontSize:11, marginTop:2 }}>{e.detail}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:sevColor(e.severity), fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${sevColor(e.severity)}15`, border:`1px solid ${sevColor(e.severity)}40` }}>{e.severity}</div>
            <div style={{ color:C.textDim, fontSize:10, marginTop:4 }}>{e.timestamp?.slice(0,16)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── WIFI ── */
export function WifiAnalysis({ token, C , lang="fr"}) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/wifi`, authH(token))
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color:C.textDim, padding:32, textAlign:"center" }}>Scan WiFi en cours…</div>;
  if (!data)   return <div style={{ color:C.textDim, padding:32, textAlign:"center" }}>nmcli non disponible sur cette machine</div>;

  const satColor = s => s==="Élevée"?C.red:s==="Moyenne"?C.amber:C.green;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Canaux */}
      {data.analysis && (
        <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
          <div style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>📶 Saturation des canaux</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
            {data.analysis.channels?.map(ch => (
              <div key={ch.channel} style={{ background:C.bg, border:`1px solid ${satColor(ch.saturation)}40`, borderRadius:8, padding:"10px 14px", minWidth:100 }}>
                <div style={{ color:satColor(ch.saturation), fontSize:18, fontWeight:700, textAlign:"center" }}>Ch. {ch.channel}</div>
                <div style={{ color:C.textMid, fontSize:11, textAlign:"center" }}>{ch.networks} réseau(x)</div>
                <div style={{ color:satColor(ch.saturation), fontSize:10, fontWeight:600, textAlign:"center", marginTop:4 }}>{ch.saturation}</div>
              </div>
            ))}
          </div>
          {data.analysis.best_free?.length > 0 && (
            <div style={{ background:`${C.green}10`, border:`1px solid ${C.green}30`, borderRadius:6, padding:"8px 12px" }}>
              <span style={{ color:C.green, fontSize:12 }}>→ Canaux libres recommandés : <strong>{data.analysis.best_free.join(", ")}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Réseaux détectés */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>Réseaux WiFi détectés ({data.networks?.length || 0})</span>
        </div>
        {(data.networks||[]).map((n, i) => (
          <div key={i} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <span style={{ color:C.text, fontSize:13, fontWeight:500 }}>{n.ssid}</span>
              <span style={{ color:C.textDim, fontSize:10, marginLeft:8, fontFamily:"monospace" }}>{n.bssid}</span>
            </div>
            <span style={{ color:C.textDim, fontSize:11 }}>Ch. {n.channel}</span>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              {[1,2,3,4,5].map(bar => (
                <div key={bar} style={{ width:4, height:4+bar*3, borderRadius:2, background:n.signal>=(bar*20)?C.green:C.border }}/>
              ))}
              <span style={{ color:C.textMid, fontSize:11, marginLeft:4 }}>{n.signal}%</span>
            </div>
            <span style={{ color:C.textDim, fontSize:10, padding:"2px 6px", border:`1px solid ${C.border}`, borderRadius:4 }}>{n.security||"Open"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SnmpPage({ token, C, lang="fr" }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const API = "http://192.168.1.16:8000";
  const h = { headers: { Authorization: `Bearer ${token}` } };
  const t = lang==="en" ? {
    title:"SNMP Scanner", scan:"Scan now", available:"Available",
    unavailable:"Unavailable", noData:"No SNMP data — click Scan",
    uptime:"Uptime", in:"In", out:"Out"
  } : {
    title:"Scanner SNMP", scan:"Lancer le scan", available:"Disponible",
    unavailable:"Non disponible", noData:"Aucune donnée — cliquez sur Scan",
    uptime:"Uptime", in:"Entrant", out:"Sortant"
  };

  const scan = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/snmp/scan`, { headers: h.headers });
      setResults(await r.json());
    } catch(e) {}
    setLoading(false);
  };

  const available = results.filter(r => r.available);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h2 style={{ color:C.text, margin:0, fontSize:18, fontWeight:600 }}>{t.title}</h2>
          <p style={{ color:C.textMid, margin:"4px 0 0", fontSize:13 }}>
            {available.length}/{results.length} {lang==="en"?"devices responding":"appareils répondent"}
          </p>
        </div>
        <button onClick={scan} disabled={loading}
          style={{ background:C.green, border:"none", borderRadius:8, color:"#0a0a0a", padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight:700, opacity:loading?0.6:1 }}>
          {loading ? "..." : t.scan}
        </button>
      </div>

      {results.length === 0 ? (
        <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, padding:40, textAlign:"center", color:C.textDim }}>
          {t.noData}
        </div>
      ) : results.map((r, i) => (
        <div key={i} style={{ background:C.panel, border:`1px solid ${r.available?C.green:C.border}`, borderRadius:14, padding:"16px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:r.available?12:0 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:r.available?C.green:C.textDim, flexShrink:0 }}/>
            <span style={{ color:C.text, fontWeight:600, fontSize:14 }}>{r.ip}</span>
            <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, background:r.available?`${C.green}15`:`${C.border}30`, color:r.available?C.green:C.textDim, border:`1px solid ${r.available?C.green:C.border}40` }}>
              {r.available ? t.available : t.unavailable}
            </span>
            {r.sysName && <span style={{ color:C.blue, fontSize:12 }}>{r.sysName}</span>}
          </div>
          {r.available && (
            <div style={{ display:"flex", flexDirection:"column", gap:6, paddingLeft:18 }}>
              {r.sysDescr && <div style={{ color:C.textMid, fontSize:12 }}>{r.sysDescr.slice(0,100)}</div>}
              <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                {r.sysUpTime && <span style={{ color:C.textDim, fontSize:11 }}>{t.uptime}: <span style={{ color:C.text }}>{r.sysUpTime}</span></span>}
                {r.ifInOctets && <span style={{ color:C.textDim, fontSize:11 }}>{t.in}: <span style={{ color:C.green }}>{(parseInt(r.ifInOctets)/1024/1024).toFixed(1)} MB</span></span>}
                {r.ifOutOctets && <span style={{ color:C.textDim, fontSize:11 }}>{t.out}: <span style={{ color:C.blue }}>{(parseInt(r.ifOutOctets)/1024/1024).toFixed(1)} MB</span></span>}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
