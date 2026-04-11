import React, { useEffect, useState } from 'react';

const GROUPS = [
  { title: "Scanner réseau",  keys: ["SCAN_INTERVAL","LATENCY_SLOW","LATENCY_SPIKE","INSTABLE_MIN"] },
  { title: "Alertes Ntfy",    keys: ["NTFY_ENABLED","NTFY_TOPIC","ALERT_ANOMALIE","ALERT_INTRUS","ALERT_DISPARU","ALERT_NOCTURNE"] },
];

export default function Settings({ lang="fr", API, token, C }) {
  const [config, setConfig] = useState(null);
  const [draft, setDraft]   = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState(null);
  const h = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetch(`${API}/api/config`, h)
      .then(r => r.json())
      .then(data => {
        setConfig(data);
        const init = {};
        Object.entries(data).forEach(([k, v]) => { init[k] = v.value; });
        setDraft(init);
      });
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res  = await fetch(`${API}/api/config`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify(draft) });
      const data = await res.json();
      if (data.ok) showToast('✓ Sauvegardé');
      else         showToast(`✗ ${data.error}`, false);
    } catch { showToast('✗ API inaccessible', false); }
    setSaving(false);
  };

  const downloadPDF = async () => {
    const res = await fetch(`${API}/api/report/pdf`, { headers:{ Authorization:`Bearer ${token}` } });
    if (!res.ok) { showToast('✗ weasyprint non installé', false); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='pulse_report.pdf'; a.click();
    showToast('✓ PDF téléchargé');
  };

  const sendWeekly = async () => {
    const res  = await fetch(`${API}/api/report/weekly`, { headers:{ Authorization:`Bearer ${token}` } });
    const data = await res.json();
    showToast(data.ok ? '✓ Rapport envoyé sur Ntfy' : '✗ Erreur envoi', data.ok);
  };

  const changePassword = async () => {
    const oldPw = prompt('Ancien mot de passe :');
    const newPw = prompt('Nouveau mot de passe :');
    if (!oldPw || !newPw) return;
    const res  = await fetch(`${API}/api/change_password`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({old_password:oldPw, new_password:newPw}) });
    const data = await res.json();
    showToast(data.ok ? '✓ Mot de passe changé — reconnectez-vous' : '✗ Ancien MDP incorrect', data.ok);
    if (data.ok) { localStorage.removeItem('pulse_token'); window.location.reload(); }
  };

  const bg    = C?.panel || '#1e293b';
  const bdr   = C?.border || '#334155';
  const txt   = C?.text || '#e2e8f0';
  const txtM  = C?.textMid || '#94a3b8';
  const txtD  = C?.textDim || '#475569';
  const green = C?.green || '#00E5A0';
  const inp   = C?.inputBg || '#0f172a';

  if (!config) return <div style={{color:txtD,padding:32,textAlign:'center'}}>Chargement…</div>;

  return (
    <div style={{maxWidth:640,margin:'0 auto',padding:'24px 16px'}}>
      <h2 style={{color:txt,margin:'0 0 4px',fontSize:20}}>⚙️ Paramètres</h2>
      <p style={{color:txtD,margin:'0 0 24px',fontSize:14}}>Modifiez les seuils sans toucher au code.</p>

      {GROUPS.map(group => (
        <div key={group.title} style={{background:bg,borderRadius:12,padding:'16px 20px',marginBottom:16,border:`1px solid ${bdr}`}}>
          <div style={{color:green,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>{group.title}</div>
          {group.keys.map(key => {
            const meta = config[key]; if (!meta) return null;
            return (
              <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${inp}`}}>
                <span style={{color:txtM,fontSize:14}}>{meta.label}</span>
                {meta.type === 'bool' ? (
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!draft[key]} onChange={e=>setDraft(d=>({...d,[key]:e.target.checked}))} style={{display:'none'}}/>
                    <span style={{position:'relative',width:44,height:24,borderRadius:12,background:draft[key]?green:bdr,transition:'background 0.2s',flexShrink:0,display:'inline-block'}}>
                      <span style={{position:'absolute',top:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'transform 0.2s',transform:draft[key]?'translateX(22px)':'translateX(2px)'}}/>
                    </span>
                    <span style={{color:draft[key]?green:txtD,fontSize:13}}>{draft[key]?'Activé':'Désactivé'}</span>
                  </label>
                ) : meta.type === 'str' ? (
                  <input type="text" value={draft[key]||''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}
                    style={{background:inp,border:`1px solid ${bdr}`,borderRadius:6,color:txt,padding:'6px 10px',fontSize:14,width:180,outline:'none'}}/>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                    <input type="number" value={draft[key]??''} min={meta.min} max={meta.max} step={meta.type==='float'?0.5:1}
                      onChange={e=>setDraft(d=>({...d,[key]:meta.type==='float'?parseFloat(e.target.value):parseInt(e.target.value)}))}
                      style={{background:inp,border:`1px solid ${bdr}`,borderRadius:6,color:txt,padding:'6px 10px',fontSize:14,width:100,textAlign:'right',outline:'none'}}/>
                    <span style={{color:txtD,fontSize:11}}>{meta.min} – {meta.max}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <button onClick={save} disabled={saving}
        style={{background:green,color:'#0a0a0a',border:'none',borderRadius:8,padding:'12px 28px',fontWeight:700,fontSize:15,cursor:'pointer',width:'100%',marginTop:8,opacity:saving?0.6:1}}>
        {saving ? 'Sauvegarde…' : '💾 Sauvegarder les seuils'}
      </button>

      <div style={{background:bg,borderRadius:12,padding:'16px 20px',marginTop:20,border:`1px solid ${bdr}`}}>
        <div style={{color:green,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>Rapports</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button onClick={downloadPDF}
            style={{flex:1,background:'none',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px',cursor:'pointer',fontSize:13,fontWeight:500}}>
            📄 Exporter en PDF
          </button>
          <button onClick={sendWeekly}
            style={{flex:1,background:'none',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px',cursor:'pointer',fontSize:13,fontWeight:500}}>
            📊 Envoyer rapport hebdo
          </button>
        </div>
      </div>

      <div style={{background:bg,borderRadius:12,padding:'16px 20px',marginTop:16,border:`1px solid ${bdr}`}}>
        <div style={{color:green,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>Compte admin</div>
        <button onClick={changePassword}
          style={{background:'none',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px 20px',cursor:'pointer',fontSize:13,fontWeight:500}}>
          🔑 Changer le mot de passe
        </button>
      </div>

      <div style={{background:bg,borderRadius:12,padding:'16px 20px',marginTop:16,border:`1px solid ${bdr}`}}>
        <div style={{color:green,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>{lang==="en"?"Backup":"Sauvegarde"}</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button onClick={async()=>{
            const r=await fetch(`${API}/api/backup`,{headers:{Authorization:`Bearer ${token}`}});
            const d=await r.json();
            showToast(d.ok?`✓ Backup créé : ${d.timestamp}`:'✗ Erreur',d.ok);
          }} style={{background:'none',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:500}}>
            💾 Créer un backup maintenant
          </button>
          <button onClick={async()=>{
            const r=await fetch(`${API}/api/backups`,{headers:{Authorization:`Bearer ${token}`}});
            const d=await r.json();
            showToast(d.length>0?`${d.length} backup(s) disponible(s)`:'Aucun backup',true);
          }} style={{background:'none',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:500}}>
            📋 Voir les backups
          </button>
        </div>
      </div>

      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,background:toast.ok?'#065f46':'#7f1d1d',color:'#fff',padding:'12px 20px',borderRadius:8,fontWeight:500,fontSize:14,zIndex:999}}>
          {toast.msg}
        </div>
      )}
      <div style={{background:bg,borderRadius:12,padding:'16px 20px',marginTop:16,border:`1px solid ${bdr}`}}>
        <div style={{color:green,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>
          {lang==="en"?"Webhook":"Webhook"}
        </div>
        <input
          placeholder="https://hooks.slack.com/... ou Teams webhook URL"
          id="webhook-url"
          style={{width:'100%',background:'#0A0E1A',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px 14px',fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:10}}
        />
        <div style={{display:'flex',gap:10}}>
          <button onClick={async()=>{
            const url=document.getElementById('webhook-url').value;
            if(!url) return;
            await fetch(`${API}/api/webhook/config`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({url})});
            setToast({msg:'✓ Webhook configuré',ok:true});
          }} style={{background:green,border:'none',borderRadius:8,color:'#0a0a0a',padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:700}}>
            {lang==="en"?"Save":"Sauvegarder"}
          </button>
          <button onClick={async()=>{
            const r=await fetch(`${API}/api/webhook/test`,{headers:{Authorization:`Bearer ${token}`}});
            const d=await r.json();
            setToast({msg:d.ok?'✓ Test envoyé':'✗ Erreur: '+d.error,ok:d.ok});
          }} style={{background:'none',border:`1px solid ${bdr}`,borderRadius:8,color:txt,padding:'10px 16px',cursor:'pointer',fontSize:13}}>
            {lang==="en"?"Test":"Tester"}
          </button>
        </div>
      </div>

      <div style={{background:bg,borderRadius:12,padding:'16px 20px',marginTop:16,border:`1px solid ${bdr}`}}>
        <div style={{color:green,fontWeight:600,fontSize:12,textTransform:'uppercase',letterSpacing:1,marginBottom:14}}>
          {lang==="en"?"Agent install QR":"QR code agent"}
        </div>
        <p style={{color:'#64748B',fontSize:13,marginBottom:12}}>
          {lang==="en"?"Scan to install agent on any machine":"Scanner pour installer l'agent sur n'importe quelle machine"}
        </p>
        <div style={{background:'#fff',padding:12,borderRadius:8,display:'inline-block'}}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=curl%20http%3A%2F%2F192.168.1.16%3A8000%2Fagent%2Finstall%20%7C%20bash`}
            alt="QR Agent"
            style={{width:150,height:150,display:'block'}}
          />
        </div>
        <div style={{color:'#64748B',fontSize:11,marginTop:8,fontFamily:'monospace'}}>
          curl http://192.168.1.16:8000/agent/install | bash
        </div>
      </div>
    </div>
  );
}