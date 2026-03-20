import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Plus, ChevronRight, Activity,
  Cpu, Wifi, Radio, PanelLeftClose, FileText, Clock,
  Globe, FileSearch
} from "lucide-react";

const STATUS_NODES = [
  { icon: Cpu,   label: "Indus-105B",   status: "Active", color: "#f97316" },
  { icon: Wifi,  label: "Swarm Net",    status: "Online", color: "#10b981" },
  { icon: Radio, label: "Orchestrator", status: "Ready",  color: "#a8a29e" },
];

function SessionIcon({ name }) {
  if (!name) return <FileText size={13} style={{ color:"#d6c4b0" }} />;
  const lower = name.toLowerCase();
  if (lower.startsWith("http"))                    return <Globe      size={13} style={{ color:"#3b82f6" }} />;
  if (lower.endsWith(".pdf") || lower.includes("pdf")) return <FileText  size={13} style={{ color:"#f97316" }} />;
  if (lower.includes("pasted") || lower.includes("text")) return <FileSearch size={13} style={{ color:"#8b5cf6" }} />;
  return <FileText size={13} style={{ color:"#d6c4b0" }} />;
}

export default function Sidebar({ open, onClose, onNewAnalysis, sessions = [] }) {
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={onClose}
            style={{ position:"fixed", inset:0, zIndex:20,
              background:"rgba(15,10,5,.15)", backdropFilter:"blur(4px)" }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <motion.aside
        initial={false}
        animate={{ width: open ? 272 : 0, opacity: open ? 1 : 0 }}
        transition={{ type:"spring", stiffness:300, damping:30 }}
        style={{ flexShrink:0, height:"100%", overflow:"hidden",
          position:"relative", zIndex:30, minWidth:0 }}
      >
        <div style={{
          width:"272px", height:"100%",
          display:"flex", flexDirection:"column",
          background:"rgba(255,253,247,.92)",
          backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
          borderRight:"1px solid rgba(253,186,116,.4)",
          boxShadow:"2px 0 32px rgba(249,115,22,.06), 8px 0 48px rgba(0,0,0,.03)",
        }}>

          {/* Logo */}
          <div style={{ padding:"20px 18px 16px",
            borderBottom:"1px solid rgba(253,186,116,.25)", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"11px" }}>
                <div style={{
                  width:"38px", height:"38px", borderRadius:"13px",
                  background:"linear-gradient(135deg,#f97316,#ea580c)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  position:"relative",
                  boxShadow:"0 4px 14px rgba(249,115,22,.32), 0 1px 0 rgba(255,255,255,.2) inset",
                }}>
                  <FlaskConical size={17} style={{ color:"#fff" }} />
                  <span style={{
                    position:"absolute", top:"-3px", right:"-3px",
                    width:"9px", height:"9px", borderRadius:"50%",
                    background:"#10b981", border:"2px solid #fff",
                    boxShadow:"0 0 6px #10b981",
                    animation:"sb-pulse 2s ease-in-out infinite",
                  }} />
                </div>
                <div>
                  <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:800,
                    fontSize:"1rem", color:"#1c1917", letterSpacing:"-0.03em",
                    lineHeight:1, marginBottom:"3px" }}>
                    SwarmLab
                  </p>
                  <p style={{ fontFamily:"'JetBrains Mono',monospace",
                    fontSize:"0.62rem", color:"#d6c4b0", margin:0 }}>
                    v2.4 · Indus-105B
                  </p>
                </div>
              </div>

              <button onClick={onClose} style={{
                width:"28px", height:"28px", borderRadius:"9px",
                display:"flex", alignItems:"center", justifyContent:"center",
                background:"rgba(253,186,116,.15)", border:"1px solid rgba(253,186,116,.4)",
                color:"#d6c4b0", cursor:"pointer", transition:"all .15s", flexShrink:0,
              }}
                onMouseEnter={e => { e.currentTarget.style.background="rgba(249,115,22,.1)"; e.currentTarget.style.color="#f97316"; }}
                onMouseLeave={e => { e.currentTarget.style.background="rgba(253,186,116,.15)"; e.currentTarget.style.color="#d6c4b0"; }}
              >
                <PanelLeftClose size={13} />
              </button>
            </div>
          </div>

          {/* New Analysis */}
          <div style={{ padding:"14px 14px 10px", flexShrink:0 }}>
            <button onClick={() => { onNewAnalysis(); onClose(); }}
              style={{
                width:"100%", display:"flex", alignItems:"center",
                justifyContent:"space-between",
                padding:"11px 15px", borderRadius:"13px",
                border:"none", cursor:"pointer",
                background:"linear-gradient(135deg,#f97316,#ea580c)",
                color:"#fff", fontFamily:"'Space Grotesk',sans-serif",
                fontSize:"0.86rem", fontWeight:600,
                boxShadow:"0 4px 16px rgba(249,115,22,.28), 0 1px 0 rgba(255,255,255,.12) inset",
                transition:"all .2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 8px 22px rgba(249,115,22,.36), 0 1px 0 rgba(255,255,255,.12) inset";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(249,115,22,.28), 0 1px 0 rgba(255,255,255,.12) inset";
              }}
            >
              <div style={{ display:"flex", alignItems:"center", gap:"9px" }}>
                <div style={{ width:"22px", height:"22px", borderRadius:"7px",
                  background:"rgba(255,255,255,.2)",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Plus size={13} color="#fff" />
                </div>
                <span>New Analysis</span>
              </div>
              <ChevronRight size={13} style={{ opacity:0.65 }} />
            </button>
          </div>

          {/* Sessions */}
          <div style={{ padding:"0 10px", flex:1, overflowY:"auto", minHeight:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"5px",
              padding:"4px 4px 8px" }}>
              <Clock size={10} style={{ color:"#d6c4b0" }} />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.59rem",
                textTransform:"uppercase", letterSpacing:"0.1em", color:"#d6c4b0" }}>
                Recent Sessions
              </span>
            </div>

            {sessions.length === 0 ? (
              <div style={{ padding:"12px 8px", textAlign:"center",
                color:"#d6c4b0", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.68rem" }}>
                No sessions yet
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                {sessions.map((s, i) => (
                  <motion.div key={i}
                    whileHover={{ x:2 }}
                    transition={{ type:"spring", stiffness:400, damping:28 }}
                    style={{
                      display:"flex", alignItems:"center", gap:"9px",
                      padding:"8px 10px", borderRadius:"11px", cursor:"pointer",
                      background: i === 0 ? "rgba(249,115,22,.07)" : "transparent",
                      border: i === 0 ? "1px solid rgba(253,186,116,.35)" : "1px solid transparent",
                      transition:"background .15s, border-color .15s",
                    }}
                    onMouseEnter={e => {
                      if (i !== 0) {
                        e.currentTarget.style.background = "rgba(253,186,116,.12)";
                        e.currentTarget.style.borderColor = "rgba(253,186,116,.2)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (i !== 0) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width:"28px", height:"28px", borderRadius:"8px", flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      background: i === 0 ? "rgba(249,115,22,.12)" : "rgba(253,186,116,.12)",
                      border:`1px solid ${i === 0 ? "rgba(253,186,116,.45)" : "rgba(253,186,116,.25)"}`,
                    }}>
                      <SessionIcon name={s} />
                    </div>

                    {/* Name */}
                    <span style={{
                      fontFamily:"'JetBrains Mono',monospace", fontSize:"0.7rem",
                      color: i === 0 ? "#ea580c" : "#a8a29e",
                      flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>
                      {s}
                    </span>

                    {/* Active badge */}
                    {i === 0 && (
                      <span style={{
                        flexShrink:0, fontSize:"0.57rem",
                        fontFamily:"'JetBrains Mono',monospace", fontWeight:700,
                        padding:"2px 7px", borderRadius:"99px",
                        background:"linear-gradient(135deg,#f97316,#ea580c)",
                        color:"#fff",
                      }}>
                        active
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height:"1px", margin:"6px 14px",
            background:"linear-gradient(90deg,transparent,rgba(253,186,116,.35),transparent)" }} />

          {/* System Status */}
          <div style={{ padding:"10px 14px 20px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"9px" }}>
              <Activity size={11} style={{ color:"#f97316" }} />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.59rem",
                textTransform:"uppercase", letterSpacing:"0.1em", color:"#d6c4b0" }}>
                System Status
              </span>
            </div>

            <div style={{
              background:"rgba(253,186,116,.08)",
              border:"1px solid rgba(253,186,116,.3)",
              borderRadius:"14px", padding:"12px 13px",
              display:"flex", flexDirection:"column", gap:"10px",
            }}>
              {STATUS_NODES.map(({ icon: Icon, label, status, color }) => (
                <div key={label} style={{ display:"flex", alignItems:"center",
                  justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                    <div style={{
                      width:"22px", height:"22px", borderRadius:"7px",
                      background:"rgba(253,186,116,.15)",
                      border:"1px solid rgba(253,186,116,.25)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <Icon size={11} style={{ color:"#d6c4b0" }} />
                    </div>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",
                      fontSize:"0.68rem", color:"#a8a29e" }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                    <span style={{
                      width:"6px", height:"6px", borderRadius:"50%",
                      background:color, display:"inline-block",
                      boxShadow:`0 0 6px ${color}`,
                      animation:"sb-pulse 2s ease-in-out infinite",
                    }} />
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",
                      fontSize:"0.68rem", color, fontWeight:700 }}>
                      {status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </motion.aside>

      <style>{`
        @keyframes sb-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.4; transform:scale(.72); }
        }
      `}</style>
    </>
  );
}