import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function WhitelistPage({ token, C, API, lang = "fr" }) {
  const [devices, setDevices]     = useState([]);
  const [filter, setFilter]       = useState("all");
  const [toast, setToast]         = useState(null);
  const [editing, setEditing]     = useState(null);
  const [editData, setEditData]   = useState({ label:"", notes:"" });
  const [showAdd, setShowAdd]     = useState(false);
  const [newDevice, setNewDevice] = useState({ ip:"", label:"", hostname:"", notes:"" });

  const h = { headers: { Authorization: `Bearer ${token}` } };

  const t = lang === "en" ? {
    title:"Whitelist", sub:"Manage authorized devices.",
    unknown:"unknown device(s).", all:"All", auth:"Authorized", unauth:"Unknown",
    cleanup:"Clean old", add:"Add device", authorized:"Authorized", blocked:"Blocked",
    save:"Save", cancel:"Cancel", name:"Custom name", notes:"Notes",
    delete:"Delete", ip:"IP address", hostname:"Hostname",
    confirmDel:"Delete this device?", confirmClean:"Delete devices absent 7+ days?",
    saved:"✓ Saved", deleted:"✓ Deleted", added:"✓ Device added",
    cleaned:"cleaned", noDevices:"No devices",
  } : {
    title:"Liste blanche", sub:"Gérez les appareils autorisés sur votre réseau.",
    unknown:"appareil(s) non reconnu(s).", all:"Tous", auth:"Autorisés", unauth:"Non reconnus",
    cleanup:"Nettoyer les anciens", add:"Ajouter un appareil", authorized:"Autorisé", blocked:"Bloqué",
    save:"Sauvegarder", cancel:"Annuler", name:"Nom personnalisé", notes:"Notes",
    delete:"Supprimer", ip:"Adresse IP", hostname:"Nom d'hôte",
    confirmDel:"Supprimer cet appareil de la base ?", confirmClean:"Supprimer les appareils absents depuis +7 jours ?",
    saved:"✓ Sauvegardé", deleted:"✓ Supprimé", added:"✓ Appareil ajouté",
    cleaned:"supprimé(s)", noDevices:"Aucun appareil",
  };

  const load = () => {
    axios.get(`${API}/api/whitelist`, h).then(r => setDevices(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, ok=true) => {
    setToast({msg,ok});
    setTimeout(() => setToast(null), 3000);
  };

  const toggleWhitelist = async (d) => {
    const newVal = d.whitelisted === 1 ? 0 : 1;
    await axios.post(`${API}/api/whitelist/${d.ip}`, {
      whitelisted: newVal, label: d.label||"", notes: d.notes||""
    }, h);
    showToast(newVal ? t.authorized : t.blocked);
    load();
  };

  const saveEdit = async (d) => {
    await axios.post(`${API}/api/whitelist/${d.ip}`, {
      whitelisted: d.whitelisted, label: editData.label, notes: editData.notes
    }, h);
    setEditing(null);
    showToast(t.saved);
    load();
  };

  const deleteDevice = async (ip) => {
    if (!window.confirm(t.confirmDel)) return;
    await axios.delete(`${API}/api/devices/${ip}`, h);
    showToast(t.deleted);
    load();
  };

  const cleanup = async () => {
    if (!window.confirm(t.confirmClean)) return;
    const r = await axios.post(`${API}/api/devices/cleanup`, {}, h);
    showToast(`${r.data.removed} ${t.cleaned}`);
    load();
  };

  const addDevice = async () => {
    if (!newDevice.ip) return;
    const r = await axios.post(`${API}/api/devices/add`, newDevice, h);
    if (r.data.ok) {
      showToast(t.added);
      setNewDevice({ ip:"", label:"", hostname:"", notes:"" });
      setShowAdd(false);
      load();
    }
  };

  const unknown  = devices.filter(d => d.whitelisted !== 1).length;
  const filtered = devices.filter(d => {
    if (filter === "unknown") return d.whitelisted !== 1;
    if (filter === "known")   return d.whitelisted === 1;
    return true;
  });

  const inp = {
    background: C.inputBg||C.bg, border:`1px solid ${C.border}`,
    borderRadius:6, color:C.text, padding:"6px 10px",
    fontSize:12, outline:"none", width:"100%", boxSizing:"border-box"
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Header */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <h2 style={{ color:C.text, margin:0, fontSize:18, fontWeight:600 }}>{t.title}</h2>
            <p style={{ color:C.textMid, margin:"4px 0 0", fontSize:13 }}>
              {t.sub} {unknown > 0 && <span style={{ color:C.red, fontWeight:600 }}>{unknown} {t.unknown}</span>}
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setShowAdd(!showAdd)}
              style={{ background:`${C.green}15`, border:`1px solid ${C.green}40`, borderRadius:8, color:C.green, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
              + {t.add}
            </button>
            <button onClick={cleanup}
              style={{ background:`${C.red}15`, border:`1px solid ${C.red}30`, borderRadius:8, color:C.red, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
              {t.cleanup}
            </button>
          </div>
        </div>

        {/* Formulaire ajout manuel */}
        {showAdd && (
          <div style={{ background:C.bg, borderRadius:10, padding:14, marginBottom:14, border:`1px solid ${C.green}30` }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10 }}>
              <div style={{ flex:1, minWidth:120 }}>
                <label style={{ color:C.textDim, fontSize:10, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{t.ip} *</label>
                <input value={newDevice.ip} onChange={e=>setNewDevice(x=>({...x,ip:e.target.value}))}
                  placeholder="192.168.1.50" style={inp}/>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <label style={{ color:C.textDim, fontSize:10, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{t.name}</label>
                <input value={newDevice.label} onChange={e=>setNewDevice(x=>({...x,label:e.target.value}))}
                  placeholder={lang==="en"?"My device":"Mon appareil"} style={inp}/>
              </div>
              <div style={{ flex:1, minWidth:120 }}>
                <label style={{ color:C.textDim, fontSize:10, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{t.hostname}</label>
                <input value={newDevice.hostname} onChange={e=>setNewDevice(x=>({...x,hostname:e.target.value}))}
                  placeholder="device.local" style={inp}/>
              </div>
              <div style={{ flex:2, minWidth:180 }}>
                <label style={{ color:C.textDim, fontSize:10, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{t.notes}</label>
                <input value={newDevice.notes} onChange={e=>setNewDevice(x=>({...x,notes:e.target.value}))}
                  placeholder={lang==="en"?"Ex: Matteo's PC, bedroom":"Ex: PC de Matteo, chambre"} style={inp}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={addDevice}
                style={{ background:C.green, border:"none", borderRadius:6, color:"#0a0a0a", padding:"7px 16px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                {t.save}
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.textMid, padding:"7px 12px", cursor:"pointer", fontSize:12 }}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div style={{ display:"flex", gap:8 }}>
          {[["all",t.all,devices.length],["known",t.auth,devices.length-unknown],["unknown",t.unauth,unknown]].map(([f,l,n]) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${filter===f?C.green:C.border}`, background:filter===f?`${C.green}15`:"none", color:filter===f?C.green:C.textMid, fontSize:12, cursor:"pointer", fontWeight:filter===f?600:400 }}>
              {l} <span style={{ marginLeft:4, fontWeight:700 }}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding:32, textAlign:"center", color:C.textDim }}>{t.noDevices}</div>
        ) : filtered.map((d, i) => (
          <div key={d.ip}>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                background:d.status==="up"?C.green:C.textDim,
                boxShadow:d.status==="up"?`0 0 6px ${C.green}`:"none" }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ color:C.text, fontSize:13, fontWeight:500 }}>
                    {d.label || d.hostname}
                  </span>
                  {d.device_type && d.device_type !== "Inconnu" && (
                    <span style={{ color:C.blue, fontSize:10, padding:"1px 6px", borderRadius:10, background:`${C.blue}15`, border:`1px solid ${C.blue}30` }}>
                      {d.device_type}
                    </span>
                  )}
                  {d.whitelisted !== 1 && (
                    <span style={{ color:C.red, fontSize:10, padding:"1px 6px", borderRadius:10, background:`${C.red}15`, border:`1px solid ${C.red}30`, fontWeight:700 }}>
                      INCONNU
                    </span>
                  )}
                </div>
                <div style={{ color:C.textDim, fontSize:11, fontFamily:"monospace", marginTop:2 }}>
                  {d.ip} · {d.vendor||"—"}
                  {d.notes && <span style={{ color:C.textMid, marginLeft:8 }}>· {d.notes}</span>}
                </div>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                <button onClick={() => { setEditing(editing===d.ip?null:d.ip); setEditData({label:d.label||"",notes:d.notes||""}); }}
                  style={{ background:editing===d.ip?`${C.green}15`:"none", border:`1px solid ${editing===d.ip?C.green:C.border}`, borderRadius:6, color:editing===d.ip?C.green:C.textDim, padding:"4px 10px", cursor:"pointer", fontSize:11 }}>
                  ✎
                </button>
                <div onClick={() => toggleWhitelist(d)} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:38, height:22, borderRadius:11, background:d.whitelisted===1?C.green:"#475569", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                    <div style={{ position:"absolute", top:3, left:d.whitelisted===1?18:3, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                  </div>
                  <span style={{ color:d.whitelisted===1?C.green:C.textDim, fontSize:11, minWidth:58 }}>
                    {d.whitelisted===1?t.authorized:t.blocked}
                  </span>
                </div>
                <button onClick={() => deleteDevice(d.ip)}
                  style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.textDim, padding:"4px 8px", cursor:"pointer", fontSize:11 }}>
                  ✕
                </button>
              </div>
            </div>

            {editing === d.ip && (
              <div style={{ background:C.panel2||C.bg, borderBottom:`1px solid ${C.border}`, padding:"12px 20px 14px 36px" }}>
                <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ color:C.textDim, fontSize:10, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{t.name}</label>
                    <input value={editData.label} onChange={e=>setEditData(x=>({...x,label:e.target.value}))}
                      placeholder={d.hostname} style={inp} autoFocus/>
                  </div>
                  <div style={{ flex:2 }}>
                    <label style={{ color:C.textDim, fontSize:10, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4 }}>{t.notes}</label>
                    <input value={editData.notes} onChange={e=>setEditData(x=>({...x,notes:e.target.value}))}
                      placeholder={lang==="en"?"Ex: Matteo's PC, bedroom":"Ex: PC de Matteo, chambre"} style={inp}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => saveEdit(d)}
                    style={{ background:C.green, border:"none", borderRadius:6, color:"#0a0a0a", padding:"6px 16px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                    {t.save}
                  </button>
                  <button onClick={() => setEditing(null)}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, color:C.textMid, padding:"6px 12px", cursor:"pointer", fontSize:12 }}>
                    {t.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:toast.ok?"#065f46":"#7f1d1d", color:"#fff", padding:"12px 20px", borderRadius:8, fontWeight:500, fontSize:14, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
