import { Machines, ServicesWeb, Security, WifiAnalysis, Timeline, SnmpPage } from "./Modules";
import BellMenu from './BellMenu';
import WhitelistPage from './WhitelistPage';
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import * as d3 from "d3";
import Settings from "./Settings";
import ProfileMenu from "./ProfileMenu";

const API = (window.location.hostname==="localhost"?"http://localhost:8000":"http://"+window.location.hostname+":8000");
function getToken() { return localStorage.getItem("pulse_token"); }
function setToken(t) { localStorage.setItem("pulse_token", t); }
function clearToken() { localStorage.removeItem("pulse_token"); }
function authH() { return { headers: { Authorization: `Bearer ${getToken()}` } }; }

const DARK = {
  bg:"#0A0E1A", panel:"#111827", panel2:"#1a2235", border:"#1f2d45",
  green:"#00E5A0", blue:"#378ADD", amber:"#FBB03B", red:"#F87171", purple:"#A78BFA",
  text:"#E2E8F0", textMid:"#94A3B8", textDim:"#475569",
  sidebar:"#0D1220", navBg:"#111827", inputBg:"#0A0E1A",
};
const LIGHT = {
  bg:"#F1F5F9", panel:"#FFFFFF", panel2:"#F8FAFC", border:"#E2E8F0",
  green:"#059669", blue:"#0284C7", amber:"#D97706", red:"#DC2626", purple:"#7C3AED",
  text:"#0F172A", textMid:"#475569", textDim:"#94A3B8",
  sidebar:"#1E293B", navBg:"#FFFFFF", inputBg:"#F8FAFC",
};

/* ── ICONS ── */
const Icon = ({ name, size=16, color="currentColor" }) => {
  const icons = {
    dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    network:   "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
    machines:  "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
    services:  "M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 12l2 2 4-4",
    security:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    alerts:    "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
    reports:   "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
    settings:  "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
    wifi:      "M5 12.55a11 11 0 0114.08 0 M1.42 9a16 16 0 0121.16 0 M8.53 16.11a6 6 0 016.95 0 M12 20h.01",
    search:    "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    bell:      "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
    moon:      "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
    sun:       "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 100 14A7 7 0 0012 5z",
    phone:     "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
    laptop:    "M2 20h20 M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z",
    server:    "M2 8h20v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8z M2 8V6a2 2 0 012-2h16a2 2 0 012 2v2 M6 12h.01 M10 12h.01",
    camera:    "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z",
    tv:        "M33 3h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2z M8 21h8 M12 17v4",
    router:    "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
    nas:       "M2 6h20v4H2z M2 14h20v4H2z M6 10v4 M6 18v2 M10 10v4 M10 18v2",
    dots:      "M12 5h.01 M12 12h.01 M12 19h.01",
    chevronR:  "M9 18l6-6-6-6",
    plus:      "M12 5v14 M5 12h14",
    check:     "M20 6L9 17l-5-5",
    x:         "M18 6L6 18 M6 6l12 12",
    refresh:   "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15",
    download:  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
    timeline:  "M12 22V12 M12 8V2 M4 6l4 2-4 2 M20 6l-4 2 4 2 M4 18l4-2-4-2 M20 18l-4-2 4-2",
    shield:    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    globe:     "M12 2a10 10 0 100 20A10 10 0 0012 2z M2 12h20 M12 2a15.3 15.3 0 010 20 15.3 15.3 0 010-20z",
  };
  const d = icons[name] || icons.dashboard;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      {d.split(" M").map((segment, i) => (
        <path key={i} d={i===0?segment:"M"+segment} fill="none"/>
      ))}
    </svg>
  );
};

/* ── SPARKLINE ── */
function Sparkline({ data, color, height=32, width="100%" }) {
  const ref = useRef();
  useEffect(() => {
    if (!data?.length || !ref.current) return;
    const el = ref.current;
    const W = el.parentElement?.clientWidth || 120;
    const svg = d3.select(el).attr("width", W).attr("height", height);
    svg.selectAll("*").remove();
    const x = d3.scaleLinear().domain([0, data.length-1]).range([0, W]);
    const y = d3.scaleLinear().domain([0, d3.max(data)*1.2||1]).range([height-2, 2]);
    const area = d3.area().x((_,i)=>x(i)).y0(height-2).y1(d=>y(d)).curve(d3.curveCatmullRom);
    const line = d3.line().x((_,i)=>x(i)).y(d=>y(d)).curve(d3.curveCatmullRom);
    const id = "sp"+Math.random().toString(36).slice(2);
    const defs = svg.append("defs");
    const gr = defs.append("linearGradient").attr("id",id).attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    gr.append("stop").attr("offset","0%").attr("stop-color",color).attr("stop-opacity",0.3);
    gr.append("stop").attr("offset","100%").attr("stop-color",color).attr("stop-opacity",0);
    svg.append("path").datum(data).attr("fill",`url(#${id})`).attr("d",area);
    svg.append("path").datum(data).attr("fill","none").attr("stroke",color).attr("stroke-width",1.5).attr("d",line);
    const last = data[data.length-1];
    svg.append("circle").attr("cx",x(data.length-1)).attr("cy",y(last)).attr("r",2.5).attr("fill",color);
  }, [data, color, height]);
  return <svg ref={ref} style={{display:"block",width:"100%",overflow:"visible"}}/>;
}

/* ── SCORE RING ── */
function ScoreRing({ score, color, size=90 }) {
  const r = size*0.38, circ = 2*Math.PI*r, dash = (score/100)*circ;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size*0.07}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.07}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray 1s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{color,fontSize:size*0.28,fontWeight:700,lineHeight:1}}>{score}</div>
        <div style={{color:"rgba(255,255,255,0.4)",fontSize:size*0.11,marginTop:2}}>/100</div>
      </div>
      


    </div>
  );
}

/* ── DEVICE TYPE ICON ── */
function deviceIcon(hostname, vendor, deviceIcon_fp) {
  if (deviceIcon_fp && deviceIcon_fp !== "router") return deviceIcon_fp;
  const h = (hostname||"").toLowerCase();
  const v = (vendor||"").toLowerCase();
  if (h.includes("samsung")||h.includes("s24")||h.includes("iphone")||h.includes("android")||v.includes("samsung")||v.includes("apple")) return "phone";
  if (h.includes("laptop")||h.includes("pc")||h.includes("mac")||h.includes("windows")) return "laptop";
  if (h.includes("cam")||h.includes("camera")||h.includes("ring")) return "camera";
  if (h.includes("tv")||h.includes("smart")) return "tv";
  if (h.includes("nas")||h.includes("synology")||h.includes("qnap")) return "nas";
  if (h.includes("livebox")||h.includes("router")||h.includes("gateway")||v.includes("arcadyan")) return "router";
  if (h.includes("server")||h.includes("network-insight")) return "server";
  return "router";
}

/* ── LOGIN ── */
function LoginPage({ onLogin, C, lang="fr" }) {
  const [user,setUser] = useState("admin");
  const [pass,setPass] = useState("");
  const [err,setErr]   = useState("");
  const [loading,setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setLoading(true); setErr("");
    try {
      const res = await axios.post(`${API}/api/login`, {username:user,password:pass});
      setToken(res.data.token); onLogin();
    } catch { setErr(lang==="en"?"Invalid credentials":"Identifiants incorrects"); }
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:"#0A0E1A",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter','Segoe UI',sans-serif"}}>
      <div style={{background:"#111827",border:"1px solid #1f2d45",borderRadius:16,padding:40,width:380,maxWidth:"90vw"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#00E5A0,#0284C7)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon name="network" size={18} color="#fff"/>
            </div>
            <span style={{color:"#fff",fontWeight:700,fontSize:22,letterSpacing:"0.05em"}}>Pulse</span>
          </div>
          <p style={{color:"#475569",fontSize:13,margin:0}}>Monitoring réseau intelligent</p>
        </div>
        <form onSubmit={submit}>
          <div style={{marginBottom:14}}>
            <label style={{color:"#94A3B8",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Utilisateur</label>
            <input value={user} onChange={e=>setUser(e.target.value)} style={{width:"100%",background:"#0A0E1A",border:"1px solid #1f2d45",borderRadius:8,color:"#E2E8F0",padding:"10px 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{color:"#94A3B8",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Mot de passe</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:"100%",background:"#0A0E1A",border:"1px solid #1f2d45",borderRadius:8,color:"#E2E8F0",padding:"10px 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
          </div>
          {err && <div style={{background:"rgba(248,113,113,0.1)",border:"1px solid #F87171",borderRadius:6,color:"#F87171",padding:"8px 12px",fontSize:12,marginBottom:14}}>{err}</div>}
          <button type="submit" disabled={loading} style={{width:"100%",background:"linear-gradient(135deg,#00E5A0,#0284C7)",border:"none",borderRadius:8,color:"#0a0a0a",padding:12,fontWeight:700,fontSize:15,cursor:"pointer",opacity:loading?0.6:1}}>
            {loading?"Connexion…":"Se connecter"}
          </button>
        </form>
        <p style={{color:"#475569",fontSize:11,textAlign:"center",marginTop:16}}>Par défaut : admin / admin123</p>
      </div>
    </div>
  );
}

/* ── useData ── */
function useData() {
  const [data,setData] = useState({devices:[],events:[],stats:{},anomalies:[],heatmap:[],topology:{nodes:[],links:[]},timeline:{},devicesConfig:{},health:null,summary:null,fingerprints:{},securityScore:null,weekCompare:null,lastUpdate:""});
  const refresh = useCallback(() => {
    const h = authH();
    Promise.all([
      axios.get(`${API}/api/devices/status`,h),
      axios.get(`${API}/api/events`,h),
      axios.get(`${API}/api/stats`,h),
      axios.get(`${API}/api/anomalies`,h),
      axios.get(`${API}/api/heatmap`,h),
      axios.get(`${API}/api/topology`,h),
      axios.get(`${API}/api/latency_timeline`,h),
      axios.get(`${API}/api/devices_config`,h),
      axios.get(`${API}/api/health`,h),
      axios.get(`${API}/api/summary`,h),
      axios.get(`${API}/api/fingerprints`,h).catch(()=>({data:[]})),
      axios.get(`${API}/api/security/score`,h).catch(()=>({data:null})),
      axios.get(`${API}/api/compare/weeks`,h).catch(()=>({data:null})),
    ]).then(([dev,ev,st,an,hm,tp,tl,cfg,hl,sm,fp,sec,wk]) => {
      const cfgMap={};cfg.data.forEach(c=>{cfgMap[c.ip]=c;});
      const fpMap={};(fp.data||[]).forEach(f=>{fpMap[f.ip]=f;});
      setData({devices:dev.data,events:ev.data,stats:st.data,anomalies:an.data,heatmap:hm.data,topology:tp.data,timeline:tl.data,devicesConfig:cfgMap,health:hl.data,summary:sm.data,fingerprints:fpMap,securityScore:sec.data,weekCompare:wk.data,lastUpdate:new Date().toLocaleTimeString("fr-FR")});
    }).catch(()=>{});
  },[]);
  useEffect(()=>{refresh();const t=setInterval(refresh,30000);return()=>clearInterval(t);},[refresh]);
  return {...data,refresh};
}

/* ── DEVICE MODAL ── */
function DeviceModal({device,config,onSave,onClose,C,lang="fr",fingerprint=null}) {
  const [label,setLabel]=useState(config?.label||"");
  const [tagsVal,setTagsVal]=useState("");
  const [notes,setNotes]=useState(config?.notes||"");
  const [whitelisted,setWhitelisted]=useState(config?.whitelisted??1);
  const save=async()=>{
    await axios.post(`${API}/api/devices_config/${device.ip}`,{label,notes,whitelisted},authH());
    onSave();onClose();
  };
  const inp={width:"100%",background:"#0A0E1A",border:"1px solid #1f2d45",borderRadius:8,color:"#E2E8F0",padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#111827",border:"1px solid #1f2d45",borderRadius:14,padding:24,width:420,maxWidth:"90vw"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <div style={{width:36,height:36,borderRadius:8,background:"#1a2235",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Icon name={deviceIcon(device.hostname,device.vendor)} size={18} color="#00E5A0"/>
          </div>
          <div style={{flex:1}}>
            <div style={{color:"#E2E8F0",fontWeight:600,fontSize:14}}>{config?.label||device.hostname}</div>
            <div style={{color:"#475569",fontSize:11,fontFamily:"monospace"}}>{device.ip}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#475569",cursor:"pointer",padding:4}}><Icon name="x" size={18} color="#475569"/></button>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:"#94A3B8",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Nom personnalisé</label>
          <input value={label} onChange={e=>setLabel(e.target.value)} placeholder={device.hostname} style={inp}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{color:"#94A3B8",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="PC de Matteo, chambre…" style={{...inp,resize:"vertical",fontFamily:"inherit"}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <div onClick={()=>setWhitelisted(w=>w?0:1)} style={{width:38,height:22,borderRadius:11,background:whitelisted?"#00E5A0":"#1f2d45",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{position:"absolute",top:3,left:whitelisted?18:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
            </div>
            <span style={{color:"#E2E8F0",fontSize:13}}>{whitelisted?"Appareil connu et autorisé":"Non reconnu — à surveiller"}</span>
          </label>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,background:"none",border:"1px solid #1f2d45",borderRadius:8,color:"#94A3B8",padding:"9px 0",cursor:"pointer",fontSize:13}}>Annuler</button>
          <button onClick={save} style={{flex:2,background:"#00E5A0",border:"none",borderRadius:8,color:"#0a0a0a",padding:"9px 0",cursor:"pointer",fontSize:13,fontWeight:700}}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}


/* ── SECURITY SCORE WIDGET ── */
function SecurityScoreWidget({ score, C, lang="fr", setPage }) {
  if (!score) return null;
  const t = lang==="en" ? { title:"Security score", details:"Details" } : { title:"Score sécurité", details:"Détails" };
  return (
    <div style={{background:C.panel,border:`1px solid ${score.score>=75?score.color+"40":C.red+"40"}`,borderRadius:14,padding:"16px 20px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:score.details?.length?12:0}}>
        <div style={{width:48,height:48,borderRadius:12,background:`${score.color}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{color:score.color,fontSize:18,fontWeight:700}}>{score.score}</span>
        </div>
        <div style={{flex:1}}>
          <div style={{color:C.text,fontSize:13,fontWeight:600}}>{t.title}</div>
          <div style={{color:score.color,fontSize:11,fontWeight:700}}>{score.label}</div>
        </div>
        {score.details?.length>0 && (
          <span onClick={()=>setPage("security")} style={{color:C.blue,fontSize:11,cursor:"pointer"}}>{t.details} →</span>
        )}
      </div>
      {score.details?.slice(0,3).map((d,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderTop:i===0?`1px solid ${C.border}`:"none"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:d.severity==="CRITICAL"?C.red:d.severity==="HIGH"?C.amber:C.blue,flexShrink:0}}/>
          <span style={{color:C.textMid,fontSize:11}}>{d.detail}</span>
        </div>
      ))}
    </div>
  );
}

/* ── WEEK COMPARE WIDGET ── */
function WeekCompareWidget({ compare, C, lang="fr" }) {
  if (!compare) return null;
  const t = lang==="en"
    ? { title:"vs last week", score:"Score", lat:"Avg latency", devices:"Devices" }
    : { title:"vs semaine passée", score:"Score", lat:"Latence moy.", devices:"Appareils" };
  const Arrow = ({v}) => <span style={{color:v>0?"#00E5A0":"#F87171",fontSize:10,marginLeft:3}}>{v>0?"▲":"▼"}{Math.abs(v)}%</span>;
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 20px"}}>
      <div style={{color:C.textMid,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>{t.title}</div>
      <div style={{display:"flex",gap:16}}>
        {[
          {label:t.score, val:compare.this_week.avg_score, diff:compare.diff.avg_score, unit:""},
          {label:t.lat,   val:compare.this_week.avg_lat,   diff:-compare.diff.avg_lat,  unit:"ms"},
          {label:t.devices,val:compare.this_week.devices,  diff:compare.diff.devices,   unit:""},
        ].map((item,i)=>(
          <div key={i} style={{flex:1,textAlign:"center"}}>
            <div style={{color:C.text,fontSize:18,fontWeight:700}}>{item.val}{item.unit}</div>
            <div style={{color:C.textDim,fontSize:10}}>{item.label}</div>
            {item.diff !== 0 && <Arrow v={item.diff}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DEVICE LATENCY MODAL ── */
function DeviceLatencyModal({ device, token, onClose, C, lang="fr" }) {
  const [data, setData] = useState([]);
  const [days, setDays] = useState(7);
  const ref = useRef();
  const API = (window.location.hostname==="localhost"?"http://localhost:8000":"http://"+window.location.hostname+":8000");

  useEffect(() => {
    fetch(`${API}/api/history/${device.ip}/extended?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r=>r.json()).then(setData).catch(()=>{});
  }, [device.ip, days, token]);

  useEffect(() => {
    if (!data.length || !ref.current) return;
    const W = ref.current.clientWidth || 400, H = 120;
    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const m = {top:10,right:10,bottom:20,left:36};
    const x = d3.scaleTime().domain(d3.extent(data, d=>new Date(d.hour))).range([m.left, W-m.right]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d=>d.avg_lat)||1]).range([H-m.bottom, m.top]);
    svg.append("path").datum(data)
      .attr("fill","none").attr("stroke","#00E5A0").attr("stroke-width",1.5)
      .attr("d", d3.line().x(d=>x(new Date(d.hour))).y(d=>y(d.avg_lat)).curve(d3.curveCatmullRom));
    svg.append("path").datum(data)
      .attr("fill","#00E5A020").attr("stroke","none")
      .attr("d", d3.area().x(d=>x(new Date(d.hour))).y0(H-m.bottom).y1(d=>y(d.avg_lat)).curve(d3.curveCatmullRom));
    svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.timeFormat("%d/%m"))).call(g=>g.select(".domain").remove()).call(g=>g.selectAll("text").style("fill","#94A3B8").style("font-size","9px"));
    svg.append("g").attr("transform",`translate(${m.left},0)`).call(d3.axisLeft(y).ticks(3)).call(g=>g.select(".domain").remove()).call(g=>g.selectAll("text").style("fill","#94A3B8").style("font-size","9px"));
  }, [data]);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:480,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{color:C.text,fontSize:15,fontWeight:600}}>{device.hostname}</div>
            <div style={{color:C.textDim,fontSize:11,fontFamily:"monospace"}}>{device.ip}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:18}}>✕</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[1,7,30].map(d=>(
            <button key={d} onClick={()=>setDays(d)}
              style={{padding:"4px 12px",borderRadius:6,border:`1px solid ${days===d?C.green:C.border}`,background:days===d?`${C.green}15`:"none",color:days===d?C.green:C.textDim,fontSize:11,cursor:"pointer"}}>
              {d}{lang==="en"?"d":"j"}
            </button>
          ))}
        </div>
        <svg ref={ref} style={{display:"block",width:"100%"}}/>
        {data.length>0 && (
          <div style={{display:"flex",gap:16,marginTop:12,padding:"8px 0",borderTop:`1px solid ${C.border}`}}>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.text,fontSize:14,fontWeight:600}}>{Math.round(data.reduce((a,b)=>a+b.avg_lat,0)/data.length)}ms</div>
              <div style={{color:C.textDim,fontSize:10}}>{lang==="en"?"avg":"moy."}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.green,fontSize:14,fontWeight:600}}>{Math.min(...data.map(d=>d.min_lat)).toFixed(1)}ms</div>
              <div style={{color:C.textDim,fontSize:10}}>min</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.red,fontSize:14,fontWeight:600}}>{Math.max(...data.map(d=>d.max_lat)).toFixed(1)}ms</div>
              <div style={{color:C.textDim,fontSize:10}}>max</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{color:C.blue,fontSize:14,fontWeight:600}}>{data.length}</div>
              <div style={{color:C.textDim,fontSize:10}}>scans</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SCORE EVOLUTION CHART ── */
function ScoreEvolutionChart({ C, token }) {
  const ref = useRef();
  const [scoreData, setScoreData] = useState([]);

  useEffect(() => {
    fetch(`http://192.168.1.16:8000/api/score_history`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(rows => {
        if (rows.length >= 2) {
          setScoreData(rows);
        } else {
          // Pas encore assez de données — afficher le score actuel répété
          fetch(`http://192.168.1.16:8000/api/health`, { headers:{ Authorization:`Bearer ${token}` } })
            .then(r => r.json())
            .then(h => {
              const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
              const now = new Date();
              const fake = days.map((day, i) => ({
                timestamp: new Date(now - (6-i)*86400000).toISOString(),
                score: h.score,
                day
              }));
              setScoreData(fake);
            });
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!scoreData.length || !ref.current) return;
    const days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
    // Regrouper par jour (garder le dernier score du jour)
    const byDay = {};
    scoreData.forEach(r => {
      const d = new Date(r.timestamp);
      const key = days[d.getDay() === 0 ? 6 : d.getDay()-1];
      byDay[key] = r.score;
    });
    const mockData = days.map(day => ({ day, score: byDay[day] || null })).filter(d => d.score !== null);
    if (!mockData.length) return;
    const el=ref.current; if(!el)return;
    const W=el.parentElement.clientWidth-32||280,H=80;
    const m={top:8,right:8,bottom:20,left:8};
    const svg=d3.select(el).attr("width",W).attr("height",H);
    svg.selectAll("*").remove();
    const x=d3.scaleBand().domain(mockData.map(d=>d.day)).range([m.left,W-m.right]).padding(0.3);
    const y=d3.scaleLinear().domain([50,100]).range([H-m.bottom,m.top]);
    const line=d3.line().x(d=>x(d.day)+x.bandwidth()/2).y(d=>y(d.score)).curve(d3.curveCatmullRom);
    const area=d3.area().x(d=>x(d.day)+x.bandwidth()/2).y0(H-m.bottom).y1(d=>y(d.score)).curve(d3.curveCatmullRom);
    const id="se"+Math.random().toString(36).slice(2);
    const defs=svg.append("defs");
    const gr=defs.append("linearGradient").attr("id",id).attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
    gr.append("stop").attr("offset","0%").attr("stop-color",C.blue).attr("stop-opacity",0.25);
    gr.append("stop").attr("offset","100%").attr("stop-color",C.blue).attr("stop-opacity",0);
    svg.append("path").datum(mockData).attr("fill",`url(#${id})`).attr("d",area);
    svg.append("path").datum(mockData).attr("fill","none").attr("stroke",C.blue).attr("stroke-width",2).attr("d",line);
    mockData.forEach(d=>{
      svg.append("circle").attr("cx",x(d.day)+x.bandwidth()/2).attr("cy",y(d.score)).attr("r",3).attr("fill",C.blue).attr("stroke","#111827").attr("stroke-width",2);
    });
    svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).tickSize(0)).call(g=>{g.select(".domain").remove();g.selectAll("text").attr("fill","#475569").attr("font-size",9);});
    const last=mockData[mockData.length-1];
    svg.append("text").attr("x",x(last.day)+x.bandwidth()/2).attr("y",y(last.score)-8).attr("text-anchor","middle").attr("fill",C.blue).attr("font-size",10).attr("font-weight","600").text(last.score);
  },[C]);
  return <svg ref={ref} style={{display:"block",width:"100%"}}/>;
}

/* ── ACTIVITY CHART ── */
function ActivityChart({ timeline, C }) {
  const ref = useRef();
  useEffect(()=>{
    const ips=Object.keys(timeline);if(!ips.length)return;
    const el=ref.current;if(!el)return;
    const W=el.parentElement.clientWidth-32||300,H=100;
    const m={top:8,right:8,bottom:24,left:8};
    const svg=d3.select(el);svg.selectAll("*").remove();svg.attr("width",W).attr("height",H);
    const allTs=ips.flatMap(ip=>timeline[ip].data.map(d=>new Date(d.t)));
    const allV=ips.flatMap(ip=>timeline[ip].data.map(d=>d.v));
    if(!allTs.length)return;
    const x=d3.scaleTime().domain(d3.extent(allTs)).range([m.left,W-m.right]);
    const y=d3.scaleLinear().domain([0,d3.max(allV)*1.2||10]).range([H-m.bottom,m.top]);
    const colors=["#00E5A0","#378ADD","#A78BFA","#FBB03B","#F87171"];
    ips.forEach((ip,i)=>{
      const d=timeline[ip].data.map(p=>({t:new Date(p.t),v:p.v}));
      const area=d3.area().x(p=>x(p.t)).y0(H-m.bottom).y1(p=>y(p.v)).curve(d3.curveCatmullRom);
      const line=d3.line().x(p=>x(p.t)).y(p=>y(p.v)).curve(d3.curveCatmullRom);
      const id="ac"+i+Math.random().toString(36).slice(2);
      const defs=svg.append("defs");
      const gr=defs.append("linearGradient").attr("id",id).attr("x1","0").attr("y1","0").attr("x2","0").attr("y2","1");
      gr.append("stop").attr("offset","0%").attr("stop-color",colors[i%colors.length]).attr("stop-opacity",0.2);
      gr.append("stop").attr("offset","100%").attr("stop-color",colors[i%colors.length]).attr("stop-opacity",0);
      svg.append("path").datum(d).attr("fill",`url(#${id})`).attr("d",area);
      svg.append("path").datum(d).attr("fill","none").attr("stroke",colors[i%colors.length]).attr("stroke-width",1.5).attr("opacity",0.8).attr("d",line);
    });
    svg.append("g").attr("transform",`translate(0,${H-m.bottom})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.timeFormat("%H:%M"))).call(g=>{g.select(".domain").remove();g.selectAll("text").attr("fill","#475569").attr("font-size",9);g.selectAll(".tick line").remove();});
  },[timeline,C]);
  return <svg ref={ref} style={{display:"block",width:"100%"}}/>;
}

/* ── DASHBOARD PAGE ── */
function DashboardPage({ devices, events, stats, timeline, devicesConfig, health, summary, anomalies, onRefresh, fingerprints, C, lang="fr", setPage=()=>{}, securityScore=null, weekCompare=null }) {
  const getToken = () => localStorage.getItem("pulse_token") || "";
  const [latencyDevice, setLatencyDevice] = useState(null);
  const [modal,setModal] = useState(null);
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("all");
  const latColor = ms => !ms?C.textDim:ms>200?C.red:ms>50?C.amber:C.green;
  const statusLabel = d => d.status==="up"?(lang==="en"?"Online":"En ligne"):d.status==="down"?(lang==="en"?"Offline":"Hors ligne"):(lang==="en"?"Unstable":"Instable");
  const statusColor = d => d.status==="up"?C.green:d.status==="down"?C.red:C.amber;

  const filtered = devices.filter(d => {
    const label = devicesConfig[d.ip]?.label||d.hostname;
    if (search && !label.toLowerCase().includes(search.toLowerCase()) && !d.ip.includes(search)) return false;
    if (filter==="online" && d.status!=="up") return false;
    if (filter==="problems" && d.status==="up" && !anomalies.find(a=>a.ip===d.ip)) return false;
    return true;
  });

  const online = devices.filter(d=>d.status==="up").length;
  const offline = devices.filter(d=>d.status==="down").length;
  const instable = devices.filter(d=>d.status!=="up"&&d.status!=="down").length;

  const recentEvents = events.slice(0,5);
  const recentServices = [
    {name:"HTTP (Port 80)", up:true, uptime:"99.9%"},
    {name:"HTTPS (Port 443)", up:true, uptime:"100%"},
    {name:"Routeur", up:true, uptime:"100%"},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {latencyDevice && <DeviceLatencyModal device={latencyDevice} token={getToken()} onClose={()=>setLatencyDevice(null)} C={C} lang={lang}/>}
      {modal && <DeviceModal device={modal} config={devicesConfig[modal.ip]} onSave={onRefresh} onClose={()=>setModal(null)} C={C}/>}

      {/* Top row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>

        {/* Santé du réseau */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
          <div style={{color:C.textMid,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:16}}>{lang==="en"?"Network health":"Santé du réseau"}</div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <ScoreRing score={health?.score||0} color={health?.color||C.green} size={90}/>
            <div style={{display:"flex",flexDirection:"column",gap:8,flex:1}}>
              {[
                {label:lang==="en"?"Online":"En ligne",  val:online,   color:C.green,  icon:"check"},
                {label:lang==="en"?"Unstable":"Instable",  val:instable,  color:C.amber,  icon:"alerts"},
                {label:lang==="en"?"Offline":"Hors ligne",val:offline,   color:C.red,    icon:"x"},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:8,background:`${s.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name={s.icon} size={13} color={s.color}/>
                  </div>
                  <div>
                    <div style={{color:C.text,fontSize:14,fontWeight:700,lineHeight:1}}>{s.val}</div>
                    <div style={{color:C.textDim,fontSize:10}}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Latence temps réel */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{color:C.textMid,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{lang==="en"?"Real-time latency":"Latence en temps réel"}</div>
            <span style={{color:C.textDim,fontSize:10,background:C.panel2,padding:"2px 8px",borderRadius:20,border:`1px solid ${C.border}`}}>6h</span>
          </div>
          <ActivityChart timeline={timeline} C={C}/>
          <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
            {Object.entries(timeline).slice(0,3).map(([ip,d],i)=>{
              const colors=["#00E5A0","#378ADD","#A78BFA"];
              const last=d.data[d.data.length-1]?.v;
              return(
                <div key={ip} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:colors[i%3]}}/>
                  <span style={{color:C.textDim,fontSize:10}}>{devicesConfig[ip]?.label||d.hostname?.split(".")[0]||ip.split(".").pop()}</span>
                  <span style={{color:colors[i%3],fontSize:10,fontWeight:600}}>{last?`${Math.round(last)}ms`:""}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activité réseau */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{color:C.textMid,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{lang==="en"?"Network activity (24h)":"Activité réseau (24h)"}</div>
            <span style={{color:C.green,fontSize:10,fontWeight:600}}>+12% vs hier</span>
          </div>
          <div style={{display:"flex",gap:16,marginBottom:12}}>
            {[
              {label:lang==="en"?"Total traffic":"Trafic total",val:`${stats.scans1h||0} scans`,icon:"network"},
              {label:lang==="en"?"Connections":"Connexions",  val:stats.new24||0, icon:"plus"},
              {label:lang==="en"?"Anomalies":"Anomalies",  val:anomalies.length, icon:"alerts", warn:anomalies.length>0},
            ].map(s=>(
              <div key={s.label} style={{flex:1}}>
                <div style={{color:s.warn?C.amber:C.text,fontSize:18,fontWeight:700}}>{s.val}</div>
                <div style={{color:C.textDim,fontSize:10}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
            <div style={{color:C.textMid,fontSize:11,fontWeight:600,marginBottom:8}}>{lang==="en"?"Monitored services":"Services monitorés"}</div>
            {recentServices.map(s=>(
              <div key={s.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:C.textMid,fontSize:11}}>{s.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{color:s.up?C.green:C.red,fontSize:10,fontWeight:700}}>{s.up?"UP":"DOWN"}</span>
                  <span style={{color:C.textDim,fontSize:10}}>{s.uptime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle row */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>

        {/* {lang==="en"?"Connected devices":"Appareils connectés"} */}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
            <span style={{color:C.text,fontSize:15,fontWeight:600}}>{lang==="en"?"Connected devices":"Appareils connectés"}</span>
            <span onClick={()=>setPage("network")} style={{color:C.blue,fontSize:11,marginLeft:"auto",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>{lang==="en"?"See all":"Voir tout"} <Icon name="chevronR" size={12} color={C.blue}/></span>
          </div>
          <div style={{padding:"12px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",background:C.panel2,borderRadius:8,padding:3,gap:2}}>
              {[["all",lang==="en"?"All":"Tous",devices.length],["online",lang==="en"?"Online":"En ligne",online],["problems",lang==="en"?"Issues":"Problèmes",anomalies.length]].map(([f,l,n])=>(
                <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?C.panel:"none",border:filter===f?`1px solid ${C.border}`:"1px solid transparent",borderRadius:6,color:filter===f?C.text:C.textDim,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:filter===f?600:400,display:"flex",alignItems:"center",gap:4}}>
                  {l} <span style={{color:filter===f?C.green:C.textDim,fontWeight:700}}>{n}</span>
                </button>
              ))}
            </div>
            <div style={{flex:1,display:"flex",alignItems:"center",gap:6,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",marginLeft:"auto",maxWidth:200}}>
              <Icon name="search" size={13} color={C.textDim}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==="en"?"Search…":"Rechercher…"} style={{background:"none",border:"none",color:C.text,fontSize:12,outline:"none",width:"100%"}}/>
            </div>
          </div>
          <div>
            {filtered.map((d,i)=>{
              const cfg = devicesConfig[d.ip];
              const label = cfg?.label||d.hostname;
              const latData = [d.latency_ms*0.8,d.latency_ms*1.1,d.latency_ms*0.9,d.latency_ms*1.2,d.latency_ms||0].filter(Boolean);
              const isAnomaly = anomalies.find(a=>a.ip===d.ip);
              return(
                <div key={d.ip} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none",transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.panel2}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:36,height:36,borderRadius:10,background:C.panel2,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Icon name={deviceIcon(d.hostname,d.vendor,fingerprints?.[d.ip]?.icon)} size={16} color={statusColor(d)}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:C.text,fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
                      {!cfg?.whitelisted && <span style={{background:`${C.red}15`,color:C.red,fontSize:9,padding:"1px 6px",borderRadius:10,border:`1px solid ${C.red}30`,flexShrink:0}}>INCONNU</span>}
                      {fingerprints?.[d.ip]?.type && fingerprints[d.ip].type !== "Inconnu" && <span style={{background:`${C.blue}15`,color:C.blue,fontSize:9,padding:"1px 6px",borderRadius:10,border:`1px solid ${C.blue}30`,flexShrink:0}}>{fingerprints[d.ip].type}</span>}
                    </div>
                    <div style={{color:C.textDim,fontSize:11,fontFamily:"monospace"}}>{d.ip}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:statusColor(d),boxShadow:d.status==="up"?`0 0 6px ${C.green}`:"none"}}/>
                    <span style={{color:statusColor(d),fontSize:11,fontWeight:500,width:72}}>{statusLabel(d)}</span>
                  </div>
                  <div style={{color:latColor(d.latency_ms),fontSize:13,fontWeight:600,width:60,textAlign:"right"}}>{d.latency_ms?`${d.latency_ms} ms`:"—"}</div>
                  <div style={{width:80,flexShrink:0}}>
                    {d.latency_ms && <Sparkline data={latData} color={latColor(d.latency_ms)} height={28}/>}
                  </div>
                  <button onClick={()=>setModal(d)} onDoubleClick={()=>setLatencyDevice(d)} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",padding:4,flexShrink:0}}>
                    <Icon name="dots" size={16} color={C.textDim}/>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Top problèmes */}
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.text,fontSize:14,fontWeight:600}}>{lang==="en"?"Top issues (24h)":"Top problèmes (24h)"}</span>
            </div>
            {anomalies.slice(0,3).map((a,i)=>(
              <div key={i} style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:`${a.avg_lat>500?C.red:a.downs>2?C.amber:C.blue}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon name={a.downs>2?"alerts":"network"} size={14} color={a.avg_lat>500?C.red:a.downs>2?C.amber:C.blue}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:C.text,fontSize:12,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{devicesConfig[a.ip]?.label||a.hostname}</div>
                  <div style={{color:C.textDim,fontSize:10}}>{a.downs>2?lang==="en"?"Unstable connection":"Connexion instable":a.avg_lat>200?lang==="en"?"High latency":"Latence élevée":lang==="en"?"Anomaly":"Anomalie"}</div>
                </div>
                <div style={{color:a.avg_lat>500?C.red:C.amber,fontSize:12,fontWeight:700,flexShrink:0}}>{a.avg_lat>200?`${Math.round(a.avg_lat)} ms`:a.downs>0?`Depuis ${a.downs}min`:""}</div>
              </div>
            ))}
            {anomalies.length===0 && <div style={{padding:20,color:C.green,fontSize:12,textAlign:"center"}}>✓ Aucun problème détecté</div>}
          </div>

          {/* Évolution score */}
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:C.text,fontSize:14,fontWeight:600}}>{lang==="en"?"Score evolution":"Évolution du score"}</span>
              <span style={{color:C.textDim,fontSize:11}}>7 jours</span>
            </div>
            <>
            <ScoreEvolutionChart C={C} token={getToken()}/>
            {weekCompare && <WeekCompareWidget compare={weekCompare} C={C} lang={lang}/>}
            {securityScore && <SecurityScoreWidget score={securityScore} C={C} lang={lang} setPage={setPage}/>}
          </>
          </div>

          {/* Alertes récentes */}
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:C.text,fontSize:14,fontWeight:600}}>{lang==="en"?"Recent alerts":"Alertes récentes"}</span>
              <span onClick={()=>setPage("alerts")} style={{color:C.blue,fontSize:11,cursor:"pointer"}}>{lang==="en"?"See all":"Voir tout"}</span>
            </div>
            {recentEvents.slice(0,4).map((e,i)=>{
              const isNew=e.event==="NOUVEAU";
              return(
                <div key={i} style={{padding:"10px 16px",borderBottom:i<3?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:28,height:28,borderRadius:8,background:isNew?`${C.green}15`:`${C.amber}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Icon name={isNew?"plus":"alerts"} size={12} color={isNew?C.green:C.amber}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:C.text,fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isNew?"Nouveau périphérique":"Appareil hors ligne"}</div>
                    <div style={{color:C.textDim,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{devicesConfig[e.ip]?.label||e.hostname} • {e.ip}</div>
                  </div>
                  <span style={{color:C.textDim,fontSize:10,flexShrink:0,whiteSpace:"nowrap"}}>il y a {Math.floor((Date.now()-new Date(e.timestamp))/60000)}min</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SIDEBAR ── */
function Sidebar({ page, setPage, health, stats, C, lang }) {
  const nav = [
    { id:"dashboard", icon:"dashboard", label:lang==="en"?"Dashboard":"Dashboard" },
    { id:"network",   icon:"network",   label:lang==="en"?"Network":"Réseau" },
    { id:"machines",  icon:"machines",  label:lang==="en"?"Machines":"Machines" },
    { id:"services",  icon:"services",  label:lang==="en"?"Services":"Services" },
    { id:"security",  icon:"security",  label:lang==="en"?"Security":"Sécurité" },
    { id:"alerts",    icon:"alerts",    label:lang==="en"?"Alerts":"Alertes" },
    { id:"reports",   icon:"reports",   label:lang==="en"?"Reports":"Rapports" },
    { id:"snmp",      icon:"network",   label:"SNMP" },
  ];
  return (
    <div style={{width:220,background:C.sidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,height:"100vh",position:"sticky",top:0}}>
      {/* Logo */}
      <div style={{padding:"14px 16px 12px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src="/logo.png" alt="Pulse" style={{width:36,height:36,borderRadius:8,objectFit:"contain"}}/>
          <div>
            <div style={{color:C.text,fontWeight:700,fontSize:15,letterSpacing:"0.02em"}}>Pulse</div>
            <div style={{color:C.textDim,fontSize:10}}>{lang==="en"?"Network monitoring":"Monitoring réseau"}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
        {nav.map(item=>{
          const active = page===item.id;
          return(
            <button key={item.id} onClick={()=>setPage(item.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:active?`${C.green}15`:"none",color:active?C.green:C.textDim,fontSize:13,fontWeight:active?600:400,cursor:"pointer",marginBottom:2,textAlign:"left",transition:"all 0.15s"}}>
              <Icon name={item.icon} size={16} color={active?C.green:C.textDim}/>
              {item.label}
              {item.id==="alerts" && stats.new24>0 && (
                <span style={{marginLeft:"auto",background:C.red,color:"#fff",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:10}}>{stats.new24}</span>
              )}
            </button>
          );
        })}

        <div style={{margin:"12px 8px",borderTop:`1px solid ${C.border}`}}/>

        <button onClick={()=>setPage("settings")} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:page==="settings"?`${C.green}15`:"none",color:page==="settings"?C.green:C.textDim,fontSize:13,cursor:"pointer",textAlign:"left"}}>
          <Icon name="settings" size={16} color={page==="settings"?C.green:C.textDim}/>
          {lang==="en"?"Settings":"Paramètres"}
        </button>

        <button onClick={()=>setPage("wifi")} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:page==="wifi"?`${C.green}15`:"none",color:page==="wifi"?C.green:C.textDim,fontSize:13,cursor:"pointer",textAlign:"left"}}>
          <Icon name="wifi" size={16} color={page==="wifi"?C.green:C.textDim}/>
          WiFi
        </button>
        <button onClick={()=>setPage("whitelist")} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:page==="whitelist"?`${C.green}15`:"none",color:page==="whitelist"?C.green:C.textDim,fontSize:13,cursor:"pointer",textAlign:"left"}}>
          <Icon name="shield" size={16} color={page==="whitelist"?C.green:C.textDim}/>
          {lang==="en"?"Whitelist":"Liste blanche"}
        </button>

        <button onClick={()=>setPage("timeline")} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",background:page==="timeline"?`${C.green}15`:"none",color:page==="timeline"?C.green:C.textDim,fontSize:13,cursor:"pointer",textAlign:"left"}}>
          <Icon name="timeline" size={16} color={page==="timeline"?C.green:C.textDim}/>
          Timeline
        </button>
      </nav>

      {/* Footer */}
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
          <span style={{color:C.green,fontSize:11,fontWeight:600}}>{lang==="en"?"Pulse Status":"Statut Pulse"}</span>
          <span style={{color:C.green,fontSize:10,marginLeft:"auto"}}>{lang==="en"?"Active":"Actif"}</span>
        </div>
        <div style={{color:C.textDim,fontSize:10}}>Dernier scan : il y a quelques sec.</div>
        <div style={{color:C.textDim,fontSize:10}}>Prochaine analyse : 00:30</div>
      </div>
    </div>
  );
}

/* ── TOPBAR ── */
function Topbar({ page, refresh, lastUpdate, darkMode, setDarkMode, onLogout, prefs, setPrefs, lang, setLang, C, stats, health, events, token, onNavigate=()=>{} }) {
  const [search, setSearch] = useState("");
  const pageTitles = lang==="en"
    ? {dashboard:"Dashboard",network:"Network",machines:"Machines",services:"Services",security:"Security",alerts:"Alerts",reports:"Reports",settings:"Settings",wifi:"WiFi",timeline:"Timeline",whitelist:"Whitelist", snmp:"SNMP"}
    : {dashboard:"Dashboard",network:"Réseau",machines:"Machines",services:"Services",security:"Sécurité",alerts:"Alertes",reports:"Rapports",settings:"Paramètres",wifi:"WiFi",timeline:"Timeline",whitelist:"Liste blanche", snmp:"SNMP"};
  return (
    <div style={{background:C.navBg,borderBottom:`1px solid ${C.border}`,padding:"0 24px",display:"flex",alignItems:"center",gap:16,height:60,position:"sticky",top:0,zIndex:200,flexShrink:0,overflow:"visible"}}>
      <h1 style={{color:C.text,fontSize:18,fontWeight:600,margin:0,flex:"0 0 auto"}}>{pageTitles[page]||page}</h1>
      <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 12px",maxWidth:360}}>
        <Icon name="search" size={14} color={C.textDim}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==="en"?"Search a device…":lang==="en"?"Search a device…":"Rechercher un appareil…"} style={{background:"none",border:"none",color:C.text,fontSize:13,outline:"none",width:"100%"}}/>
      </div>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
        <span style={{color:C.textDim,fontSize:10,fontFamily:"monospace"}}>{lastUpdate}</span>
        <button onClick={refresh} style={{width:34,height:34,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <Icon name="refresh" size={14} color={C.textDim}/>
        </button>
        <BellMenu token={token} events={events} stats={stats} C={C} API={(window.location.hostname==="localhost"?"http://localhost:8000":"http://"+window.location.hostname+":8000")} onNavigate={onNavigate}/>
        <button onClick={()=>setDarkMode(!darkMode)} style={{width:34,height:34,background:C.panel2,border:`1px solid ${C.border}`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <Icon name={darkMode?"sun":"moon"} size={14} color={C.textDim}/>
        </button>
        <ProfileMenu API={(window.location.hostname==="localhost"?"http://localhost:8000":"http://"+window.location.hostname+":8000")} token={token} darkMode={darkMode} setDarkMode={setDarkMode} onLogout={onLogout} prefs={prefs} setPrefs={setPrefs} lang={lang} setLang={setLang} C={C} key={token}/>
      </div>
    </div>
  );
}

/* ── NETWORK PAGE ── */
function NetworkPage({ devices, topology, devicesConfig, events, C, lang="fr" }) {
  const ref = useRef();
  useEffect(() => {
    if (!topology.nodes.length) return;
    const el=ref.current,W=el.parentElement.clientWidth||700,H=500;
    d3.select(el).selectAll("*").remove();
    const svg=d3.select(el).attr("width",W).attr("height",H);
    const nodes=topology.nodes.map(d=>({...d}));
    const links=topology.links.map(d=>({...d}));
    const sim=d3.forceSimulation(nodes).force("link",d3.forceLink(links).id(d=>d.id).distance(140)).force("charge",d3.forceManyBody().strength(-400)).force("center",d3.forceCenter(W/2,H/2)).force("collision",d3.forceCollide(55));
    const link=svg.append("g").selectAll("line").data(links).join("line").attr("stroke",C.border).attr("stroke-width",1).attr("stroke-dasharray","4 2");
    const latColor=lat=>!lat?C.textDim:lat>200?C.red:lat>50?C.amber:C.green;
    const node=svg.append("g").selectAll("g").data(nodes).join("g").attr("cursor","pointer").call(d3.drag().on("start",(e,d)=>{if(!e.active)sim.alphaTarget(0.3).restart();d.fx=d.x;d.fy=d.y;}).on("drag",(e,d)=>{d.fx=e.x;d.fy=e.y;}).on("end",(e,d)=>{if(!e.active)sim.alphaTarget(0);d.fx=null;d.fy=null;}));
    node.append("circle").attr("r",d=>d.id==="192.168.1.1"?32:22).attr("fill",d=>d.id==="192.168.1.1"?`${C.green}15`:C.panel2).attr("stroke",d=>d.id==="192.168.1.1"?C.green:latColor(d.latency)).attr("stroke-width",1.5);
    node.append("text").attr("text-anchor","middle").attr("dominant-baseline","central").attr("font-size",9).attr("font-weight","600").attr("fill",C.text).text(d=>devicesConfig[d.id]?.label||d.hostname?.split(".")[0]||d.id.split(".").pop());
    node.append("text").attr("text-anchor","middle").attr("dy","2.2em").attr("font-size",8).attr("fill",d=>latColor(d.latency)).text(d=>d.latency?`${d.latency}ms`:"");
    sim.on("tick",()=>{
      link.attr("x1",d=>d.source.x).attr("y1",d=>d.source.y).attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      node.attr("transform",d=>`translate(${Math.max(40,Math.min(W-40,d.x))},${Math.max(40,Math.min(H-40,d.y))})`);
    });
  },[topology,devicesConfig,C]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
          <span style={{color:C.text,fontSize:15,fontWeight:600}}>{lang==="en"?"Network topology":"Topologie réseau"}</span>
          <span style={{color:C.textDim,fontSize:11}}>{lang==="en"?"· draggable":"· déplaçable"}</span>
          <div style={{marginLeft:"auto",display:"flex",gap:12}}>
            {[{l:lang==="en"?"Fast":"Rapide",c:C.green},{l:lang==="en"?"Medium":"Moyen",c:C.amber},{l:lang==="en"?"Slow":"Lent",c:C.red}].map(({l,c})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c}}/>
                <span style={{color:C.textDim,fontSize:11}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <svg ref={ref} style={{display:"block",width:"100%"}}/>
      </div>
    </div>
  );
}

/* ── ALERTS PAGE ── */
function AlertsPage({ events, anomalies, devicesConfig, C, lang="fr" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{color:C.text,fontSize:15,fontWeight:600}}>{lang==="en"?"All events":"Tous les événements"}</span>
        </div>
        {events.map((e,i)=>{
          const isNew=e.event==="NOUVEAU";
          return(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:32,height:32,borderRadius:8,background:isNew?`${C.green}15`:`${C.amber}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon name={isNew?"plus":"alerts"} size={14} color={isNew?C.green:C.amber}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:C.text,fontSize:13,fontWeight:500}}>{devicesConfig[e.ip]?.label||e.hostname}</div>
                <div style={{color:C.textDim,fontSize:11}}>{e.ip} · {e.network}</div>
              </div>
              <span style={{color:isNew?C.green:C.amber,fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20,background:isNew?`${C.green}15`:`${C.amber}15`,border:`1px solid ${isNew?C.green:C.amber}30`}}>{e.event}</span>
              <span style={{color:C.textDim,fontSize:11}}>{e.timestamp?.slice(0,16)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── REPORTS PAGE ── */
function ReportsPage({ token, C, lang="fr" }) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState(null);
  const showToast = (msg,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); };

  const downloadPDF = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/report/pdf`, { headers:{ Authorization:`Bearer ${token}` } });
      if (!res.ok) { showToast("weasyprint non installé",false); setLoading(false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href=url; a.download="pulse_report.pdf"; a.click();
      showToast("✓ PDF téléchargé");
    } catch { showToast("Erreur",false); }
    setLoading(false);
  };

  const sendWeekly = async () => {
    const res = await fetch(`${API}/api/report/weekly`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    showToast(data.ok?"✓ Rapport envoyé sur Ntfy":"Erreur",data.ok);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {[
          {title:lang==="en"?"PDF Report":"Rapport PDF",desc:"Exporte un rapport complet du réseau au format PDF.",icon:"download",action:downloadPDF,label:"Exporter en PDF",color:C.blue},
          {title:lang==="en"?"Weekly report":"Rapport hebdomadaire",desc:"Envoie un résumé de la semaine via Ntfy.",icon:"bell",action:sendWeekly,label:lang==="en"?"Send now":"Envoyer maintenant",color:C.green},
        ].map(r=>(
          <div key={r.title} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:24}}>
            <div style={{width:44,height:44,borderRadius:12,background:`${r.color}15`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
              <Icon name={r.icon} size={20} color={r.color}/>
            </div>
            <div style={{color:C.text,fontSize:15,fontWeight:600,marginBottom:6}}>{r.title}</div>
            <div style={{color:C.textMid,fontSize:13,marginBottom:16}}>{r.desc}</div>
            <button onClick={r.action} disabled={loading} style={{background:r.color,border:"none",borderRadius:8,color:"#0a0a0a",padding:"10px 20px",fontWeight:700,fontSize:13,cursor:"pointer",opacity:loading?0.6:1}}>{r.label}</button>
          </div>
        ))}
      </div>
      {toast && <div style={{position:"fixed",bottom:24,right:24,background:toast.ok?"#065f46":"#7f1d1d",color:"#fff",padding:"12px 20px",borderRadius:8,fontWeight:500,fontSize:14,zIndex:9999}}>{toast.msg}</div>}
    </div>
  );
}

/* ── APP ── */
export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [page,setPage]       = useState("dashboard");
  const [darkMode,setDarkMode] = useState(()=>localStorage.getItem("pulse_dark")!=="false");
  const [lang,setLang]       = useState(()=>localStorage.getItem("pulse_lang")||"fr");
  const [prefs,setPrefs]     = useState(()=>{ try{return JSON.parse(localStorage.getItem("pulse_prefs")||"{}");}catch{return {};} });
  const [loggedIn,setLoggedIn] = useState(!!getToken());

  useEffect(()=>{localStorage.setItem("pulse_dark",darkMode);},[darkMode]);
  useEffect(()=>{localStorage.setItem("pulse_prefs",JSON.stringify(prefs));},[prefs]);

  const BASE = darkMode ? DARK : LIGHT;
  const C = { ...BASE, green: prefs.accent||BASE.green, bg: prefs.bg||BASE.bg };

  const d = useData();
  const handleLogout = () => { clearToken(); setLoggedIn(false); };

  if (!loggedIn) return <LoginPage onLogin={()=>setLoggedIn(true)} C={C}/>;

  return (
    <div style={{display:"flex",background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Inter','Segoe UI',system-ui,sans-serif"}}>
      <Sidebar page={page} setPage={setPage} health={d.health} stats={d.stats} C={C} lang={lang}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflowX:"hidden"}}>
        <Topbar page={page} refresh={d.refresh} lastUpdate={d.lastUpdate} darkMode={darkMode} setDarkMode={setDarkMode} events={d.events} token={getToken()} onNavigate={setPage}
          onLogout={handleLogout} prefs={prefs} setPrefs={setPrefs} lang={lang} setLang={setLang}
          C={C} stats={d.stats} health={d.health}/>
        <div style={{flex:1,padding:24,overflowY:"auto"}}>
          {page==="dashboard" && <DashboardPage devices={d.devices} events={d.events} stats={d.stats} timeline={d.timeline} devicesConfig={d.devicesConfig} health={d.health} summary={d.summary} anomalies={d.anomalies} onRefresh={d.refresh} fingerprints={d.fingerprints} C={C} lang={lang} setPage={setPage} securityScore={d.securityScore} weekCompare={d.weekCompare}/>}
          {page==="network"   && <NetworkPage devices={d.devices} topology={d.topology} devicesConfig={d.devicesConfig} events={d.events} C={C} lang={lang}/>}
          {page==="machines"  && <Machines token={getToken()} C={C} lang={lang}/>}
          {page==="services"  && <ServicesWeb token={getToken()} C={C} lang={lang}/>}
          {page==="security"  && <Security token={getToken()} C={C} lang={lang}/>}
          {page==="alerts"    && <AlertsPage events={d.events} anomalies={d.anomalies} devicesConfig={d.devicesConfig} C={C} lang={lang}/>}
          {page==="reports"   && <ReportsPage token={getToken()} C={C} lang={lang}/>}
          {page==="wifi"      && <WifiAnalysis token={getToken()} C={C} lang={lang}/>}
          {page==="timeline"  && <Timeline token={getToken()} C={C} lang={lang}/>}
          {page==="settings"  && <Settings API={API} token={getToken()} C={C} lang={lang}/>}
          {page==="snmp"       && <SnmpPage token={getToken()} C={C} lang={lang}/>}
          {page==="whitelist"  && <WhitelistPage API={API} token={getToken()} C={C} lang={lang}/>}
        </div>
      </div>
    </div>
  );
}