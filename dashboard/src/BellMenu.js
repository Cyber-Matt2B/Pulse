import React, { useState, useRef, useEffect } from 'react';

export default function BellMenu({ token, events, stats, C, API, onNavigate=()=>{} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const recent = Array.isArray(events) ? events.slice(0, 12) : [];
  const unread = stats?.new24 || 0;

  const isNew = e => e.event === "NOUVEAU";

  const ago = ts => {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
    if (diff < 1) return "à l'instant";
    if (diff < 60) return `il y a ${diff}min`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: 34, height: 34, background: open ? `${C.green}15` : C.panel2, border: `1px solid ${open ? C.green : C.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", transition: "all 0.15s" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? C.green : C.textDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{ position: "absolute", top: 4, right: 4, width: 15, height: 15, borderRadius: "50%", background: C.red, fontSize: 8, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.bg}` }}>
            {unread > 9 ? "9+" : unread}
          </div>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 1000, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>Alertes récentes</span>
            {unread > 0 && (
              <span style={{ background: `${C.red}20`, color: C.red, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                {unread} aujourd'hui
              </span>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {recent.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontSize: 13 }}>
                Aucune alerte récente
              </div>
            ) : recent.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: isNew(e) ? `${C.green}15` : `${C.amber}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isNew(e) ? C.green : C.amber} strokeWidth="2" strokeLinecap="round">
                    {isNew(e)
                      ? <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                      : <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/></>
                    }
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ color: isNew(e) ? C.green : C.amber, fontSize: 11, fontWeight: 700 }}>{e.event}</span>
                    <span style={{ color: C.textDim, fontSize: 10 }}>{ago(e.timestamp)}</span>
                  </div>
                  <div style={{ color: C.text, fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.hostname && e.hostname !== "inconnu" ? e.hostname : e.ip}
                  </div>
                  <div style={{ color: C.textDim, fontSize: 10, fontFamily: "monospace" }}>{e.ip}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
            <span onClick={()=>{onNavigate("timeline");}} style={{color:"#378ADD",fontSize:12,cursor:"pointer"}}>Voir tous les événements →</span>
          </div>
        </div>
      )}
    </div>
  );
}
