import React, { useState, useRef, useEffect } from 'react';

const LANGS = { fr: "🇫🇷 Français", en: "🇬🇧 English" };
const ACCENTS = [
  { label:"Vert",    value:"#00E5A0" },
  { label:"Bleu",    value:"#38BDF8" },
  { label:"Violet",  value:"#A78BFA" },
  { label:"Orange",  value:"#FB923C" },
  { label:"Rose",    value:"#F472B6" },
];
const CURVE_STYLES = [
  { label:"Smooth",  value:"catmullRom" },
  { label:"Linear",  value:"linear" },
  { label:"Stepped", value:"step" },
];
const BG_PRESETS = [
  { label:"Nuit",      value:"#060C12" },
  { label:"Ardoise",   value:"#0F172A" },
  { label:"Gris foncé",value:"#111827" },
  { label:"Blanc",     value:"#F1F5F9" },
  { label:"Crème",     value:"#FAFAF5" },
];

export const T = {
  fr: {
    profile:"Profil",
    theme:"Apparence",
    darkMode:"Mode sombre",
    lightMode:"Mode clair",
    accentColor:"Couleur d'accent",
    bgColor:"Fond d'écran",
    curveStyle:"Style des courbes",
    language:"Langue",
    accounts:"Comptes",
    addUser:"Ajouter un utilisateur",
    username:"Nom d'utilisateur",
    password:"Mot de passe",
    role:"Rôle",
    admin:"Admin",
    readonly:"Lecture seule",
    create:"Créer",
    delete:"Supprimer",
    changePassword:"Changer le mot de passe",
    oldPassword:"Ancien mot de passe",
    newPassword:"Nouveau mot de passe",
    confirm:"Confirmer",
    logout:"Déconnexion",
    cancel:"Annuler",
    save:"Sauvegarder",
    saved:"✓ Sauvegardé",
    error:"✗ Erreur",
  },
  en: {
    profile:"Profile",
    theme:"Appearance",
    darkMode:"Dark mode",
    lightMode:"Light mode",
    accentColor:"Accent color",
    bgColor:"Background",
    curveStyle:"Curve style",
    language:"Language",
    accounts:"Accounts",
    addUser:"Add user",
    username:"Username",
    password:"Password",
    role:"Role",
    admin:"Admin",
    readonly:"Read only",
    create:"Create",
    delete:"Delete",
    changePassword:"Change password",
    oldPassword:"Old password",
    newPassword:"New password",
    confirm:"Confirm",
    logout:"Logout",
    cancel:"Cancel",
    save:"Save",
    saved:"✓ Saved",
    error:"✗ Error",
  }
};

export default function ProfileMenu({ API, token, darkMode, setDarkMode, onLogout, prefs, setPrefs, lang, setLang, C }) {
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState("theme");
  const [users, setUsers]       = useState([]);
  const [newUser, setNewUser]   = useState({ username:"", password:"", role:"readonly" });
  const [pwForm, setPwForm]     = useState({ old:"", new1:"", new2:"" });
  const [toast, setToast]       = useState(null);
  const ref = useRef();
  const t = T[lang] || T.fr;

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && tab === "accounts") {
      setTimeout(loadUsers, 300);
    }
  }, [open, tab]);

  const loadUsers = async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data && typeof data === 'object') {
        // Fallback si retourne un objet
        setUsers([{ username: data.username || 'admin', role: data.role || 'admin' }]);
      }
    } catch(e) {
      console.error('loadUsers error:', e);
    }
  };

  const showToast = (msg, ok=true) => {
    setToast({msg,ok});
    setTimeout(() => setToast(null), 3000);
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) return;
    const res  = await fetch(`${API}/api/users`, { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body: JSON.stringify(newUser) });
    const data = await res.json();
    if (data.ok) { showToast(t.saved); setNewUser({username:"",password:"",role:"readonly"}); loadUsers(); }
    else showToast(`${t.error}: ${data.error}`, false);
  };

  const deleteUser = async (username) => {
    if (!window.confirm(`Supprimer ${username} ?`)) return;
    const res  = await fetch(`${API}/api/users/${username}`, { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    if (data.ok) { showToast(t.saved); loadUsers(); }
    else showToast(t.error, false);
  };

  const changePassword = async () => {
    if (pwForm.new1 !== pwForm.new2) { showToast("✗ Mots de passe différents", false); return; }
    const res  = await fetch(`${API}/api/change_password`, { method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body: JSON.stringify({old_password:pwForm.old, new_password:pwForm.new1}) });
    const data = await res.json();
    if (data.ok) { showToast(t.saved); setTimeout(() => { localStorage.removeItem("pulse_token"); window.location.reload(); }, 1500); }
    else showToast(`${t.error}: ${data.error}`, false);
  };

  const inp = { background:C.inputBg, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, padding:"7px 10px", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" };
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{ background:"none", border:"none", cursor:"pointer", padding:"8px 14px", fontSize:12, fontWeight:tab===id?700:400, color:tab===id?C.green:C.textMid, borderBottom:tab===id?`2px solid ${C.green}`:"2px solid transparent", whiteSpace:"nowrap" }}>
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:20, color:C.text, padding:"5px 14px", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ width:22, height:22, borderRadius:"50%", background:C.green, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#0a0a0a" }}>A</span>
        <span>admin</span>
        <span style={{ color:C.textDim, fontSize:10 }}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 8px)", width:400, background:C.panel, border:`1px solid ${C.border}`, borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,0.4)", zIndex:999, overflow:"hidden" }}>
          
          {/* Header */}
          <div style={{ background:C.bg, padding:"14px 16px", display:"flex", alignItems:"center", gap:10, borderBottom:`1px solid ${C.border}` }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:C.green, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#0a0a0a" }}>A</div>
            <div>
              <div style={{ color:C.text, fontWeight:600, fontSize:13 }}>admin</div>
              <div style={{ color:C.textDim, fontSize:11 }}>Administrateur · Pulse</div>
            </div>
            <button onClick={onLogout} style={{ marginLeft:"auto", background:"none", border:`1px solid ${C.red}30`, borderRadius:6, color:C.red, padding:"4px 10px", cursor:"pointer", fontSize:11 }}>{t.logout}</button>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
            {tabBtn("theme",    "🎨 " + t.theme)}
            {tabBtn("language", "🌍 " + t.language)}
            {tabBtn("accounts", "👥 " + t.accounts)}
            {tabBtn("password", "🔑 " + t.changePassword)}
          </div>

          <div style={{ padding:"16px", maxHeight:400, overflowY:"auto" }}>

            {/* THEME */}
            {tab === "theme" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {/* Dark/Light */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ color:C.textMid, fontSize:13 }}>{darkMode ? t.darkMode : t.lightMode}</span>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={darkMode} onChange={e=>setDarkMode(e.target.checked)} style={{ display:"none" }}/>
                    <span style={{ position:"relative", width:44, height:24, borderRadius:12, background:darkMode?C.green:C.border, transition:"background 0.2s", display:"inline-block" }}>
                      <span style={{ position:"absolute", top:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"transform 0.2s", transform:darkMode?"translateX(22px)":"translateX(2px)" }}/>
                    </span>
                  </label>
                </div>

                {/* Accent color */}
                <div>
                  <div style={{ color:C.textMid, fontSize:13, marginBottom:8 }}>{t.accentColor}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {ACCENTS.map(a => (
                      <button key={a.value} onClick={() => setPrefs(p=>({...p, accent:a.value}))} title={a.label}
                        style={{ width:28, height:28, borderRadius:"50%", background:a.value, border:prefs.accent===a.value?`3px solid ${C.text}`:"3px solid transparent", cursor:"pointer", outline:"none" }}/>
                    ))}
                    <input type="color" value={prefs.accent||C.green} onChange={e=>setPrefs(p=>({...p,accent:e.target.value}))}
                      style={{ width:28, height:28, borderRadius:"50%", border:"none", cursor:"pointer", background:"none" }} title="Couleur personnalisée"/>
                  </div>
                </div>

                {/* Background */}
                <div>
                  <div style={{ color:C.textMid, fontSize:13, marginBottom:8 }}>{t.bgColor}</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {BG_PRESETS.map(b => (
                      <button key={b.value} onClick={() => setPrefs(p=>({...p, bg:b.value}))} title={b.label}
                        style={{ padding:"4px 10px", borderRadius:6, background:b.value, border:prefs.bg===b.value?`2px solid ${C.green}`:`2px solid ${C.border}`, color:b.value==="#F1F5F9"||b.value==="#FAFAF5"?"#0f172a":"#e2e8f0", fontSize:11, cursor:"pointer" }}>
                        {b.label}
                      </button>
                    ))}
                    <input type="color" value={prefs.bg||"#060C12"} onChange={e=>setPrefs(p=>({...p,bg:e.target.value}))}
                      style={{ width:32, height:28, borderRadius:6, border:`1px solid ${C.border}`, cursor:"pointer" }} title="Couleur personnalisée"/>
                  </div>
                </div>

                {/* Curve style */}
                <div>
                  <div style={{ color:C.textMid, fontSize:13, marginBottom:8 }}>{t.curveStyle}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {CURVE_STYLES.map(s => (
                      <button key={s.value} onClick={() => setPrefs(p=>({...p, curve:s.value}))}
                        style={{ flex:1, padding:"6px", borderRadius:6, background:prefs.curve===s.value?`${C.green}20`:"none", border:`1px solid ${prefs.curve===s.value?C.green:C.border}`, color:prefs.curve===s.value?C.green:C.textMid, fontSize:12, cursor:"pointer" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* LANGUAGE */}
            {tab === "language" && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {Object.entries(LANGS).map(([code, label]) => (
                  <button key={code} onClick={() => { setLang(code); localStorage.setItem('pulse_lang', code); setOpen(false); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, background:lang===code?`${C.green}15`:"none", border:`1px solid ${lang===code?C.green:C.border}`, color:lang===code?C.green:C.text, fontSize:14, cursor:"pointer", textAlign:"left" }}>
                    <span style={{ fontSize:20 }}>{label.split(" ")[0]}</span>
                    <span>{label.split(" ").slice(1).join(" ")}</span>
                    {lang===code && <span style={{ marginLeft:"auto", color:C.green }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            {tab === "accounts" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ color:C.textDim, fontSize:11, marginBottom:4 }}>
                  {users.length === 0 ? "Chargement..." : `${users.length} compte(s)`}
                </div>
                <div>
                  {users.length === 0 && (
                    <div style={{ padding:"12px 0", color:C.textDim, fontSize:12 }}>
                      Aucun compte trouvé — <span style={{color:C.green,cursor:"pointer"}} onClick={loadUsers}>Réessayer</span>
                    </div>
                  )}
                  {users.map(u => (
                    <div key={u.username} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:u.role==="admin"?C.green:C.blue, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#0a0a0a", flexShrink:0 }}>
                        {(u.username||"?")[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ color:C.text, fontSize:13, fontWeight:500 }}>{u.username}</div>
                        <div style={{ color:u.role==="admin"?C.green:C.blue, fontSize:11 }}>{u.role==="admin"?t.admin:t.readonly}</div>
                      </div>
                      {u.username !== "admin" && (
                        <button onClick={() => deleteUser(u.username)} style={{ background:"none", border:`1px solid ${C.red}40`, borderRadius:4, color:C.red, padding:"3px 8px", cursor:"pointer", fontSize:11 }}>{t.delete}</button>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ background:C.bg, borderRadius:8, padding:"12px", border:`1px solid ${C.border}` }}>
                  <div style={{ color:C.green, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{t.addUser}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <input placeholder={t.username} value={newUser.username} onChange={e=>setNewUser(u=>({...u,username:e.target.value}))} style={inp}/>
                    <input type="password" placeholder={t.password} value={newUser.password} onChange={e=>setNewUser(u=>({...u,password:e.target.value}))} style={inp}/>
                    <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))} style={{...inp,appearance:"none"}}>
                      <option value="readonly">{t.readonly}</option>
                      <option value="admin">{t.admin}</option>
                    </select>
                    <button onClick={createUser} style={{ background:C.green, border:"none", borderRadius:6, color:"#0a0a0a", padding:"8px", fontWeight:700, fontSize:13, cursor:"pointer" }}>{t.create}</button>
                  </div>
                </div>
              </div>
            )}

            {/* PASSWORD */}
            {tab === "password" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input type="password" placeholder={t.oldPassword} value={pwForm.old} onChange={e=>setPwForm(f=>({...f,old:e.target.value}))} style={inp}/>
                <input type="password" placeholder={t.newPassword} value={pwForm.new1} onChange={e=>setPwForm(f=>({...f,new1:e.target.value}))} style={inp}/>
                <input type="password" placeholder={t.confirm} value={pwForm.new2} onChange={e=>setPwForm(f=>({...f,new2:e.target.value}))} style={inp}/>
                <button onClick={changePassword} style={{ background:C.green, border:"none", borderRadius:6, color:"#0a0a0a", padding:"10px", fontWeight:700, fontSize:13, cursor:"pointer", marginTop:4 }}>{t.confirm}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:toast.ok?"#065f46":"#7f1d1d", color:"#fff", padding:"12px 20px", borderRadius:8, fontWeight:500, fontSize:14, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
