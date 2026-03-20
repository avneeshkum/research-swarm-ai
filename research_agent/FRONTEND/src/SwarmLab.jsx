import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axios from "axios";
import {
  Zap, Bot, Send, Paperclip, X, Loader2,
  AlertTriangle, PanelLeftOpen, Sparkles, Download,
  Settings, Eye, EyeOff, ChevronDown, Key, Link, MessageSquare
} from "lucide-react";
import Sidebar from "./Sidebar";

const API_URL        = "http://localhost:8000/analyze-pdf";
const CHAT_URL       = "http://localhost:8000/chat";
const URL_API        = "http://localhost:8000/analyze-url";
const TEXT_API       = "http://localhost:8000/analyze-text";
const PAPER_CHAT_URL = "http://localhost:8000/chat-with-paper";

const isURL = (str) => {
  try { new URL(str); return str.startsWith("http"); }
  catch { return false; }
};

// Long pasted text = likely a research paper (>500 chars, no URL)
const isLongText = (str) => str.trim().length > 500 && !isURL(str.trim());
const MAX_FILE_MB = 20;

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

/* ── Agent config ── */
const AGENT_CONFIG = {
  system:    { label:"System",      color:"#78716c" },
  boss:      { label:"Boss",        color:"#f97316" },
  analyzer:  { label:"Analyzer",    color:"#3b82f6" },
  summarizer:{ label:"Summarizer",  color:"#8b5cf6" },
  citations: { label:"Citations",   color:"#ec4899" },
  insights:  { label:"Insights",    color:"#eab308" },
  reviewer:  { label:"Reviewer",    color:"#10b981" },
};

/* ── Live Log inside bubble ── */
function Thinking({ logs }) {
  const endRef = useRef();
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [logs]);

  const lastRunning = [...logs].reverse().find(l => l.status === "running");
  const ag = AGENT_CONFIG[lastRunning?.agent] || AGENT_CONFIG.system;

  return (
    <div style={{
      background:"#ffffff",
      borderRadius:"20px 20px 20px 4px",
      border:"1px solid #f0ebe4",
      boxShadow:"0 2px 20px rgba(0,0,0,.06)",
      overflow:"hidden",
      width:"100%",
      minWidth:"340px",
    }}>

      {/* Top status bar */}
      <div style={{
        display:"flex", alignItems:"center", gap:"8px",
        padding:"10px 16px",
        background:"linear-gradient(135deg,#fffbf7,#fff7ed)",
        borderBottom:"1px solid #f5ede0",
      }}>
        {/* Spinning dot */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <div style={{
            width:"8px", height:"8px", borderRadius:"50%",
            background: ag.color,
            boxShadow:"0 0 8px " + ag.color,
            animation:"pulse-dot 1.2s ease-in-out infinite",
          }} />
        </div>
        <span style={{
          fontFamily:"'Space Grotesk',sans-serif",
          fontSize:"0.8rem", fontWeight:700, color:"#1c1917",
        }}>
          {lastRunning
            ? (AGENT_CONFIG[lastRunning.agent]?.label || "System") + " is working..."
            : "Processing..."}
        </span>

        {/* Agent progress dots */}
        <div style={{ marginLeft:"auto", display:"flex", gap:"5px", alignItems:"center" }}>
          {["boss","analyzer","summarizer","citations","insights","reviewer"].map(a => {
            const done = logs.some(l => l.agent === a && l.status === "done");
            const err  = logs.some(l => l.agent === a && l.status === "error");
            const run  = a === lastRunning?.agent;
            const c    = AGENT_CONFIG[a].color;
            return (
              <div key={a} style={{
                width:"6px", height:"6px", borderRadius:"50%",
                background: done ? c : err ? "#ef4444" : run ? c : "#e7e5e4",
                opacity: done || run || err ? 1 : 0.35,
                boxShadow: run ? "0 0 5px " + c : done ? "0 0 3px " + c + "88" : "none",
                transition:"all .4s",
              }} title={AGENT_CONFIG[a].label} />
            );
          })}
        </div>
      </div>

      {/* Log lines — terminal style */}
      <div style={{
        padding:"10px 0 6px",
        maxHeight:"200px", overflowY:"auto",
        fontFamily:"'JetBrains Mono',monospace",
      }}>
        {logs.length === 0 && (
          <div style={{ padding:"8px 16px", fontSize:"0.73rem", color:"#c4b5a0" }}>
            Initializing swarm...
          </div>
        )}
        <AnimatePresence initial={false}>
          {logs.map((entry, i) => {
            const cfg = AGENT_CONFIG[entry.agent] || AGENT_CONFIG.system;
            const isRun = entry.status === "running";
            const isDone = entry.status === "done";
            const isErr  = entry.status === "error";
            return (
              <motion.div key={i}
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.2 }}
                style={{
                  display:"flex", alignItems:"baseline", gap:"8px",
                  padding:"4px 16px",
                  background: isRun ? cfg.color + "09" : "transparent",
                }}>

                {/* Prefix */}
                <span style={{
                  fontSize:"0.68rem", fontWeight:700, flexShrink:0,
                  color: isErr ? "#ef4444" : cfg.color,
                  minWidth:"72px",
                }}>
                  {isDone ? "✓ " : isErr ? "✗ " : isRun ? "→ " : "  "}
                  {cfg.label}
                </span>

                {/* Message */}
                <span style={{
                  fontSize:"0.73rem",
                  color: isErr ? "#ef4444" : isRun ? "#1c1917" : "#78716c",
                  fontWeight: isRun ? 500 : 400,
                  flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>
                  {entry.message}
                </span>

                {/* Time */}
                <span style={{ fontSize:"0.58rem", color:"#d6c4b0", flexShrink:0 }}>
                  {entry.ts}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}

/* ── PDF Preview Modal ── */
function PDFPreview({ htmlContent, filename, onClose, onPrint }) {
  useEffect(() => {
    // Auto trigger print after 3 seconds
    const t = setTimeout(() => { onPrint(); }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(15,10,5,.6)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "flex-end",
        }}
        onClick={onClose}
      >
        {/* Slide-in panel from right */}
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: "520px", height: "100vh",
            background: "#fff",
            boxShadow: "-8px 0 60px rgba(0,0,0,.2)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "20px 24px 16px",
            background: "linear-gradient(135deg, #fff7ed, #fef3c7)",
            borderBottom: "2px solid #fed7aa",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "linear-gradient(135deg, #f97316, #ea580c)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(249,115,22,.3)",
              }}>
                <Download size={16} style={{ color: "#fff" }} />
              </div>
              <div>
                <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: "0.9rem", color: "#0c0a09" }}>
                  Research Brief
                </p>
                <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.62rem", color: "#a8a29e" }}>
                  {filename} · Printing in 3s...
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={onPrint}
                style={{
                  padding: "7px 16px", borderRadius: "10px", border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff",
                  fontFamily: "'Space Grotesk',sans-serif", fontSize: "0.78rem", fontWeight: 600,
                  boxShadow: "0 3px 12px rgba(249,115,22,.3)",
                }}>
                Print Now
              </button>
              <button onClick={onClose}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px", border: "1.5px solid #ede8e0",
                  background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#a8a29e",
                }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Countdown bar */}
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 3, ease: "linear" }}
            style={{ height: "3px", background: "linear-gradient(90deg, #f97316, #ea580c)", flexShrink: 0 }}
          />

          {/* Preview content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
            {/* SwarmLab header */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              marginBottom: "24px", paddingBottom: "16px",
              borderBottom: "2px solid #fed7aa",
            }}>
              <span style={{
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800,
                fontSize: "1.2rem", color: "#0c0a09", letterSpacing: "-0.03em",
              }}>
                SwarmLab
              </span>
              <span style={{
                background: "linear-gradient(135deg, #f97316, #ea580c)", color: "#fff",
                fontSize: "0.62rem", fontWeight: 700, padding: "3px 9px", borderRadius: "99px",
                fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.05em",
              }}>
                RESEARCH BRIEF
              </span>
              <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#a8a29e", fontFamily: "'JetBrains Mono',monospace" }}>
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>

            {/* Rendered HTML */}
            <div
              className="pdf-preview-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── PDF Print trigger ── */
function triggerPrint(htmlContent, filename) {
  const date = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  const html = [
    "<!DOCTYPE html><html><head>",
    '<meta charset="utf-8">',
    "<title>" + (filename || "SwarmLab Report") + "</title>",
    "<style>",
    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');",
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "body { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.75; color: #1c1917; background: #fff; padding: 48px 56px; max-width: 860px; margin: 0 auto; }",
    "h1 { font-size: 1.6rem; font-weight: 700; color: #0c0a09; margin: 0 0 6px; letter-spacing: -0.02em; border-bottom: 2px solid #f97316; padding-bottom: 12px; }",
    "h2 { font-size: 1.1rem; font-weight: 700; color: #1c1917; margin: 28px 0 10px; padding-left: 10px; border-left: 3px solid #f97316; }",
    "h3 { font-size: 0.95rem; font-weight: 600; color: #44403c; margin: 20px 0 8px; }",
    "p { margin-bottom: 10px; color: #292524; }",
    "ul, ol { padding-left: 20px; margin-bottom: 10px; }",
    "li { margin-bottom: 4px; } li::marker { color: #f97316; }",
    "strong { font-weight: 600; color: #1c1917; }",
    "em { color: #78716c; }",
    "code { font-family: 'JetBrains Mono', monospace; font-size: 0.8em; background: #fef3c7; border: 1px solid #fde68a; padding: 2px 5px; border-radius: 4px; color: #92400e; }",
    "pre { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px; margin: 12px 0; overflow-x: auto; }",
    "pre code { background: transparent; border: none; padding: 0; color: #57534e; }",
    "blockquote { border-left: 3px solid #fed7aa; padding: 6px 0 6px 14px; margin: 12px 0; color: #78716c; background: #fff7ed; border-radius: 0 6px 6px 0; }",
    "table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 0.82rem; }",
    "th, td { border: 1px solid #e7e5e4; padding: 8px 12px; text-align: left; vertical-align: top; }",
    "th { background: #fff7ed; color: #9a3412; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }",
    "td { color: #292524; } tr:nth-child(even) td { background: #fafaf9; }",
    "hr { border: none; border-top: 1px solid #e7e5e4; margin: 24px 0; }",
    "a { color: #ea580c; text-decoration: underline; }",
    ".header { display:flex; align-items:center; gap:12px; margin-bottom:32px; padding-bottom:20px; border-bottom:1px solid #f5f0ea; }",
    ".badge { background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; font-family: 'JetBrains Mono', monospace; }",
    ".meta { font-size: 0.75rem; color: #a8a29e; font-family: 'JetBrains Mono', monospace; margin-top: 4px; }",
    "@media print { body { padding: 20px 28px; } @page { margin: 20mm; } }",
    "</style></head><body>",
    '<div class="header"><div>',
    '<div style="display:flex;align-items:center;gap:8px;">',
    '<span style="font-size:1.3rem;font-weight:800;letter-spacing:-0.03em;color:#0c0a09;">SwarmLab</span>',
    '<span class="badge">RESEARCH BRIEF</span>',
    "</div>",
    '<p class="meta">Generated by SwarmLab · ' + date + "</p>",
    "</div></div>",
    htmlContent,
    "</body></html>",
  ].join("");

  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}




/* ── Compact Log Summary (shown after response arrives) ── */
function LogSummary({ logs }) {
  const [open, setOpen] = useState(false);
  if (!logs || logs.length === 0) return null;

  const passed  = logs.filter(l => l.status === "done").length;
  const failed  = logs.filter(l => l.status === "error").length;
  const total   = ["boss","analyzer","summarizer","citations","insights","reviewer"]
    .filter(a => logs.some(l => l.agent === a)).length;

  return (
    <div style={{ marginBottom:"8px" }}>
      {/* Toggle pill */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          display:"inline-flex", alignItems:"center", gap:"6px",
          padding:"4px 12px", borderRadius:"9999px", cursor:"pointer",
          background: open ? "#fff7ed" : "#fafaf9",
          border:`1.5px solid ${open ? "#fed7aa" : "#ede8e0"}`,
          color: open ? "#ea580c" : "#a8a29e",
          fontFamily:"'JetBrains Mono',monospace", fontSize:"0.65rem", fontWeight:600,
          transition:"all .15s",
        }}>
        <span style={{ fontSize:"0.6rem" }}>{open ? "▲" : "▼"}</span>
        Swarm Log
        <span style={{
          padding:"1px 6px", borderRadius:"99px",
          background: failed > 0 ? "#fef2f2" : "#f0fdf4",
          color: failed > 0 ? "#ef4444" : "#10b981",
          border: `1px solid ${failed > 0 ? "#fca5a5" : "#bbf7d0"}`,
          fontSize:"0.6rem",
        }}>
          {passed}/{total} passed {failed > 0 ? `· ${failed} retry` : ""}
        </span>
      </button>

      {/* Log entries */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            style={{
              marginTop:"6px", borderRadius:"12px", overflow:"hidden",
              border:"1px solid #f0ebe4", background:"#fafaf9",
            }}>
            {logs.map((entry, i) => {
              const cfg = AGENT_CONFIG[entry.agent] || AGENT_CONFIG.system;
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"baseline", gap:"8px",
                  padding:"4px 12px",
                  borderBottom: i < logs.length-1 ? "1px solid #f5f0ea" : "none",
                  background: entry.status === "running" ? cfg.color+"08" : "transparent",
                }}>
                  <span style={{
                    fontSize:"0.62rem", fontWeight:700, color:
                      entry.status === "done"    ? cfg.color :
                      entry.status === "error"   ? "#ef4444" :
                      entry.status === "running" ? cfg.color : "#d6c4b0",
                    minWidth:"65px", flexShrink:0,
                  }}>
                    {entry.status === "done" ? "✓" : entry.status === "error" ? "✗" : "→"} {cfg.label}
                  </span>
                  <span style={{
                    fontSize:"0.72rem", color:"#78716c", flex:1,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>
                    {entry.message}
                  </span>
                  <span style={{ fontSize:"0.58rem", color:"#d6c4b0", flexShrink:0 }}>{entry.ts}</span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Message ── */
function Message({ msg }) {
  const isUser = msg.role === "user";
  const contentRef = useRef();
  const [showPreview, setShowPreview] = useState(false);

  const handleDownload = () => setShowPreview(true);
  const handlePrint = () => {
    if (contentRef.current) {
      triggerPrint(contentRef.current.innerHTML, msg.fileName || "SwarmLab-Report");
      setShowPreview(false);
    }
  };

  // ── Live log view while loading ──
  if (!isUser && msg.loading) {
    return (
      <motion.div layout
        initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
        transition={{ type:"spring", stiffness:360, damping:28 }}
        style={{ display:"flex", gap:"12px", alignItems:"flex-end" }}>
        <div style={{
          flexShrink:0, width:"36px", height:"36px", borderRadius:"14px",
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"4px",
          background:"linear-gradient(135deg,#f97316,#ea580c)",
          boxShadow:"0 4px 14px rgba(249,115,22,.3)",
        }}>
          <Bot size={15} style={{ color:"#fff" }} />
        </div>
        <div style={{ flex:1, maxWidth:"92%" }}>
          <Thinking logs={msg.logs || []} />
          <span style={{ color:"#a8a29e", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.63rem", paddingLeft:"4px", marginTop:"4px", display:"block" }}>
            {msg.time}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div layout
      initial={{ opacity:0, y:18, scale:0.97 }}
      animate={{ opacity:1, y:0, scale:1 }}
      exit={{ opacity:0, y:-8 }}
      transition={{ type:"spring", stiffness:360, damping:28 }}
      style={{ display:"flex", gap:"12px", flexDirection: isUser ? "row-reverse" : "row", alignItems:"flex-end" }}>

      {!isUser && (
        <div style={{
          flexShrink:0, width:"36px", height:"36px", borderRadius:"14px",
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"4px",
          background: msg.isError ? "#fff1f2" : "linear-gradient(135deg,#f97316,#ea580c)",
          border: msg.isError ? "1.5px solid #fca5a5" : "none",
          boxShadow: msg.isError ? "0 2px 10px rgba(239,68,68,.1)" : "0 4px 14px rgba(249,115,22,.3)",
        }}>
          {msg.isError
            ? <AlertTriangle size={15} style={{ color:"#ef4444" }} />
            : <Bot size={15} style={{ color:"#fff" }} />}
        </div>
      )}

      <div style={{ maxWidth: isUser ? "70%" : "92%", display:"flex", flexDirection:"column", gap:"4px", alignItems: isUser ? "flex-end" : "flex-start" }}>
        {msg.fileName && !isUser && (
          <span style={{ fontSize:"0.72rem", padding:"4px 10px", borderRadius:"9999px", marginBottom:"4px",
            background:"#fff7ed", border:"1.5px solid #fed7aa", color:"#ea580c",
            fontFamily:"'JetBrains Mono',monospace" }}>
            📄 {msg.fileName}
          </span>
        )}

        {/* Show log summary after response arrives */}
        {!isUser && !msg.loading && msg.logs && msg.logs.length > 0 && (
          <LogSummary logs={msg.logs} />
        )}

        {(
          <div style={isUser ? {
            background:"linear-gradient(135deg,#f97316,#ea580c)",
            borderRadius:"20px 20px 4px 20px",
            padding:"13px 18px",
            boxShadow:"0 4px 20px rgba(249,115,22,.28), 0 1px 0 rgba(255,255,255,.15) inset",
            color:"#fff", fontSize:"0.88rem", lineHeight:1.7, fontWeight:500,
          } : msg.isError ? {
            background:"#fff1f2", border:"1.5px solid #fca5a5",
            borderRadius:"20px 20px 20px 4px", padding:"14px 18px",
            color:"#be123c", fontSize:"0.88rem", lineHeight:1.72,
          } : {
            background:"#ffffff",
            border:"none",
            borderRadius:"24px 24px 24px 4px",
            padding:"22px 26px",
            boxShadow:"0 1px 3px rgba(0,0,0,.06), 0 8px 32px rgba(120,113,108,.08), 0 0 0 1px rgba(0,0,0,.04)",
            color:"#0c0a09", fontSize:"0.9rem", lineHeight:1.82,
            width:"100%",
          }}>
            {isUser
              ? <span style={{ fontWeight:500 }}>{msg.content}</span>
              : <div ref={contentRef} className="swarm-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>}
          </div>
        )}

        {/* Download button — only for AI messages with content */}
        {!isUser && !msg.loading && !msg.isError && msg.content && (
          <motion.button
            initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
            onClick={handleDownload}
            style={{
              display:"flex", alignItems:"center", gap:"6px",
              padding:"6px 14px", borderRadius:"9999px",
              background:"#fff7ed", border:"1.5px solid #fed7aa",
              color:"#ea580c", fontSize:"0.72rem", fontFamily:"'JetBrains Mono',monospace",
              fontWeight:600, cursor:"pointer", marginTop:"2px",
              boxShadow:"0 2px 8px rgba(249,115,22,.1)",
              transition:"all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="linear-gradient(135deg,#f97316,#ea580c)"; e.currentTarget.style.color="#fff"; e.currentTarget.style.borderColor="#f97316"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#fff7ed"; e.currentTarget.style.color="#ea580c"; e.currentTarget.style.borderColor="#fed7aa"; }}>
            <Download size={12} />
            Download PDF
          </motion.button>
        )}

        {/* PDF Preview Modal */}
        {showPreview && (
          <PDFPreview
            htmlContent={contentRef.current?.innerHTML || ""}
            filename={msg.fileName || "SwarmLab-Report"}
            onClose={() => setShowPreview(false)}
            onPrint={handlePrint}
          />
        )}

        <span style={{ color:"#a8a29e", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.63rem", paddingLeft:"4px" }}>
          {msg.time}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Animated Word ── */
function AnimatedWord({ word, color, delay }) {
  return (
    <motion.span
      initial={{ opacity:0, y:20, filter:"blur(8px)" }}
      animate={{ opacity:1, y:0, filter:"blur(0px)" }}
      transition={{ duration:0.6, delay, ease:[0.22,1,0.36,1] }}
      style={{ display:"inline-block", color, marginRight:"10px" }}>
      {word}
    </motion.span>
  );
}

/* ── Empty State ── */
function Empty() {
  const greeting = getGreeting();
  const words = greeting.split(" ");
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.4 }}
      style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        gap:"32px", textAlign:"center", padding:"0 32px 60px", userSelect:"none" }}>
      <div style={{ position:"relative" }}>
        <div style={{ position:"absolute", inset:0, borderRadius:"50%", pointerEvents:"none",
          background:"radial-gradient(circle,rgba(249,115,22,.12) 0%,transparent 70%)",
          transform:"scale(4)", animation:"breathe 3.5s ease-in-out infinite" }} />
        <motion.div animate={{ rotate:[0,5,-5,0] }} transition={{ duration:4, repeat:Infinity, ease:"easeInOut" }}
          style={{ position:"relative", width:"80px", height:"80px", borderRadius:"26px",
            background:"linear-gradient(135deg,#fff7ed,#fef3c7)", border:"2px solid #fed7aa",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 36px rgba(249,115,22,.18), 0 8px 32px rgba(249,115,22,.08)" }}>
          <Zap size={34} style={{ color:"#f97316", filter:"drop-shadow(0 0 8px rgba(249,115,22,.5))" }} />
        </motion.div>
      </div>
      <div>
        <div style={{ fontSize:"2.9rem", fontWeight:800, letterSpacing:"-0.04em", lineHeight:1.05,
          fontFamily:"'Space Grotesk',sans-serif", marginBottom:"4px" }}>
          {words.map((w, i) => (
            <AnimatedWord key={i} word={w} color={i===0?"#1c1917":i===1?"#f97316":"#1c1917"} delay={0.1+i*0.1} />
          ))}
          <motion.span initial={{ opacity:0, y:20, filter:"blur(8px)" }} animate={{ opacity:1, y:0, filter:"blur(0px)" }}
            transition={{ duration:0.6, delay:0.4, ease:[0.22,1,0.36,1] }}
            style={{ display:"inline-block", background:"linear-gradient(135deg,#f97316,#ea580c,#fb923c)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
            Avneesh.
          </motion.span>
        </div>
        <motion.p initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.65, duration:0.5 }}
          style={{ color:"#a8a29e", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.83rem",
            lineHeight:1.8, maxWidth:"400px", margin:"12px auto 0" }}>
          Deploy the AI Swarm on any research paper<br />for deep orchestration.
        </motion.p>
      </div>
      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", justifyContent:"center" }}>
        {[
          { label:"📄 Upload PDF",        bg:"#fff7ed", border:"#fed7aa", color:"#ea580c" },
          { label:"🔗 Paste URL/arXiv",   bg:"#fff7ed", border:"#fed7aa", color:"#f97316" },
          { label:"📝 Paste paper text",  bg:"#fafaf9", border:"#e7e5e4", color:"#78716c" },
          { label:"💬 Normal chat",       bg:"#fafaf9", border:"#e7e5e4", color:"#78716c" },
        ].map(({ label, bg, border, color }, i) => (
          <motion.span key={label}
            initial={{ opacity:0, y:10, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }}
            transition={{ delay:0.75+i*0.1, type:"spring", stiffness:300 }}
            style={{ padding:"8px 18px", borderRadius:"9999px", fontSize:"0.78rem",
              background:bg, border:`1.5px solid ${border}`, color,
              fontFamily:"'JetBrains Mono',monospace", fontWeight:500, cursor:"default" }}>
            {label}
          </motion.span>
        ))}
      </div>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1 }}
        style={{ display:"flex", alignItems:"center", gap:"6px" }}>
        {[{ color:"#f97316" },{ color:"#ea580c" },{ color:"#fb923c" },{ color:"#fed7aa" }].map(({ color }, i) => (
          <motion.div key={i} animate={{ scale:[1,1.4,1], opacity:[0.5,1,0.5] }}
            transition={{ duration:1.8, delay:i*0.3, repeat:Infinity, ease:"easeInOut" }}>
            <Sparkles size={12} style={{ color }} />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}


/* ── Settings Panel ── */
const MODELS = {
  groq: [
    { value:"llama-3.3-70b-versatile",              label:"Llama 3.3 70B",       tag:"Best"    },
    { value:"openai/gpt-oss-120b",                  label:"GPT OSS 120B",        tag:"🔥New"   },
    { value:"openai/gpt-oss-20b",                   label:"GPT OSS 20B",         tag:"OpenAI"  },
    { value:"qwen/qwen3-32b",                       label:"Qwen 3 32B",          tag:"Alibaba" },
    { value:"moonshotai/kimi-k2-instruct-0905",     label:"Kimi K2",             tag:"256K ctx"},
    { value:"llama-3.1-8b-instant",                 label:"Llama 3.1 8B",        tag:"Fast"    },
  ],
  sarvam: [
    { value:"sarvam-30b",                           label:"Sarvam 30B",          tag:"Default" },
  ],
  openai: [
    { value:"gpt-4o",                               label:"GPT-4o",              tag:"Best"    },
    { value:"gpt-4o-mini",                          label:"GPT-4o Mini",         tag:"Fast"    },
    { value:"gpt-3.5-turbo",                        label:"GPT-3.5 Turbo",       tag:"Lite"    },
  ],
  gemini: [
    { value:"gemini-3-flash-preview",               label:"Gemini 3 Flash",      tag:"🔥New"   },
    { value:"gemini-3.1-pro-preview",               label:"Gemini 3.1 Pro",      tag:"🔥New"   },
    { value:"gemini-2.5-pro",                       label:"Gemini 2.5 Pro",      tag:"Best"    },
    { value:"gemini-2.5-flash",                     label:"Gemini 2.5 Flash",    tag:"Fast"    },
    { value:"gemini-2.5-flash-lite",                label:"Gemini 2.5 Flash-Lite",tag:"Lite"   },
  ],
  cohere: [
    { value:"command-a-03-2025",                    label:"Command A",           tag:"Best"    },
    { value:"command-r-plus-08-2024",               label:"Command R+",          tag:"Stable"  },
    { value:"command-r-08-2024",                    label:"Command R",           tag:"Fast"    },
    { value:"command-r7b-12-2024",                  label:"Command R7B",         tag:"Lite"    },
  ],
};

function SettingsPanel({ config, onChange, onClose }) {
  const [showKey, setShowKey] = useState(false);
  const models = MODELS[config.provider] || [];

  const PROVIDER_ICONS = {
    groq:"⚡", sarvam:"🔥", openai:"🤖", gemini:"💎", cohere:"🦄"
  };

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:100,
        background:"rgba(15,10,5,.5)", backdropFilter:"blur(6px)",
        display:"flex", alignItems:"flex-end",
        padding:"0",
      }}>
      <motion.div
        initial={{ y:"100%" }}
        animate={{ y:0 }}
        exit={{ y:"100%" }}
        transition={{ type:"spring", stiffness:320, damping:32 }}
        onClick={e => e.stopPropagation()}
        style={{
          width:"100%",
          maxHeight:"90vh",
          background:"#ffffff",
          borderRadius:"24px 24px 0 0",
          overflow:"hidden",
          boxShadow:"0 -8px 60px rgba(0,0,0,.15)",
          display:"flex", flexDirection:"column",
        }}>

        {/* Drag handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}>
          <div style={{ width:"40px", height:"4px", borderRadius:"99px", background:"#e7e5e4" }} />
        </div>

        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 20px 14px",
          borderBottom:"1px solid #f5f0ea",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{
              width:"36px", height:"36px", borderRadius:"12px",
              background:"linear-gradient(135deg,#f97316,#ea580c)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 3px 12px rgba(249,115,22,.3)",
            }}>
              <Settings size={17} style={{ color:"#fff" }} />
            </div>
            <div>
              <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:"1rem", color:"#0c0a09" }}>
                Model Settings
              </p>
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.62rem", color:"#a8a29e" }}>
                Provider · Model · API Key
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width:"32px", height:"32px", borderRadius:"10px",
            border:"1.5px solid #ede8e0", background:"#fafaf9",
            cursor:"pointer", display:"flex", alignItems:"center",
            justifyContent:"center", color:"#a8a29e",
          }}><X size={15} /></button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY:"auto", padding:"20px", flex:1 }}>

          {/* Provider pills */}
          <div style={{ marginBottom:"20px" }}>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.65rem",
              textTransform:"uppercase", letterSpacing:"0.1em", color:"#a8a29e",
              marginBottom:"10px", fontWeight:700 }}>
              Provider
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"6px" }}>
              {["groq","sarvam","openai","gemini","cohere"].map(p => (
                <button key={p}
                  onClick={() => onChange({ ...config, provider:p, model:MODELS[p][0].value, apiKey:"" })}
                  style={{
                    display:"flex", flexDirection:"column", alignItems:"center", gap:"4px",
                    padding:"10px 4px", borderRadius:"14px", cursor:"pointer",
                    border: config.provider === p ? "2px solid #f97316" : "1.5px solid #ede8e0",
                    background: config.provider === p
                      ? "linear-gradient(135deg,#fff7ed,#fef3c7)"
                      : "#fafaf9",
                    boxShadow: config.provider === p ? "0 2px 12px rgba(249,115,22,.15)" : "none",
                    transition:"all .15s",
                  }}>
                  <span style={{ fontSize:"1.2rem", lineHeight:1 }}>{PROVIDER_ICONS[p]}</span>
                  <span style={{
                    fontFamily:"'Space Grotesk',sans-serif",
                    fontSize:"0.65rem", fontWeight:700,
                    color: config.provider === p ? "#ea580c" : "#78716c",
                    textTransform:"capitalize",
                  }}>{p}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Model grid */}
          <div style={{ marginBottom:"20px" }}>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.65rem",
              textTransform:"uppercase", letterSpacing:"0.1em", color:"#a8a29e",
              marginBottom:"10px", fontWeight:700 }}>
              Model
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {models.map(m => (
                <button key={m.value}
                  onClick={() => onChange({ ...config, model:m.value })}
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"12px 16px", borderRadius:"14px",
                    cursor:"pointer", textAlign:"left",
                    border: config.model === m.value ? "2px solid #f97316" : "1.5px solid #ede8e0",
                    background: config.model === m.value ? "#fff7ed" : "#fafaf9",
                    transition:"all .15s",
                    boxShadow: config.model === m.value ? "0 2px 10px rgba(249,115,22,.12)" : "none",
                  }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    {config.model === m.value && (
                      <span style={{ color:"#f97316", fontSize:"0.8rem" }}>●</span>
                    )}
                    <span style={{
                      fontFamily:"'Space Grotesk',sans-serif", fontSize:"0.88rem", fontWeight:600,
                      color: config.model === m.value ? "#ea580c" : "#1c1917",
                    }}>
                      {m.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize:"0.6rem", fontFamily:"'JetBrains Mono',monospace", fontWeight:700,
                    padding:"3px 9px", borderRadius:"99px",
                    background: config.model === m.value
                      ? "linear-gradient(135deg,#f97316,#ea580c)"
                      : "#f0ebe4",
                    color: config.model === m.value ? "#fff" : "#a8a29e",
                    whiteSpace:"nowrap",
                  }}>
                    {m.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div style={{ marginBottom:"20px" }}>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.65rem",
              textTransform:"uppercase", letterSpacing:"0.1em", color:"#a8a29e",
              marginBottom:"10px", fontWeight:700 }}>
              API Key
            </p>
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:"14px", top:"50%", transform:"translateY(-50%)", color:"#d6c4b0" }}>
                <Key size={15} />
              </div>
              <input
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                onChange={e => onChange({ ...config, apiKey:e.target.value })}
                placeholder={`${config.provider.toUpperCase()} API key...`}
                style={{
                  width:"100%", padding:"13px 48px 13px 40px",
                  borderRadius:"14px", border:"1.5px solid #ede8e0",
                  background:"#fafaf9", fontFamily:"'JetBrains Mono',monospace",
                  fontSize:"0.85rem", color:"#1c1917", outline:"none",
                  boxSizing:"border-box", transition:"border .15s",
                }}
                onFocus={e => e.target.style.borderColor="#fed7aa"}
                onBlur={e  => e.target.style.borderColor="#ede8e0"}
              />
              <button onClick={() => setShowKey(s => !s)} style={{
                position:"absolute", right:"14px", top:"50%", transform:"translateY(-50%)",
                background:"none", border:"none", cursor:"pointer",
                color:"#a8a29e", display:"flex", alignItems:"center",
              }}>
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {config.apiKey && (
              <p style={{ fontSize:"0.65rem", color:"#10b981",
                fontFamily:"'JetBrains Mono',monospace", marginTop:"6px" }}>
                ✓ Key saved for this session
              </p>
            )}
          </div>

          {/* Save */}
          <button onClick={onClose} style={{
            width:"100%", padding:"14px", borderRadius:"16px",
            border:"none", cursor:"pointer",
            background:"linear-gradient(135deg,#f97316,#ea580c)",
            color:"#fff", fontFamily:"'Space Grotesk',sans-serif",
            fontSize:"0.95rem", fontWeight:700,
            boxShadow:"0 4px 20px rgba(249,115,22,.3)",
            marginBottom:"8px",
          }}>
            Save & Close
          </button>

        </div>
      </motion.div>
    </motion.div>
  );
}


/* ── Input Bar ── */
function InputBar({ onSend, disabled, activePaper }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [focus, setFocus] = useState(false);
  const [mode, setMode] = useState("auto");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const fileRef = useRef();
  const taRef = useRef();
  const modeRef = useRef();

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (modeRef.current && !modeRef.current.contains(e.target)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-detect mode from text
  const detectedMode = mode !== "auto" ? mode
    : file              ? "swarm"
    : isURL(text.trim())? "url"
    : isLongText(text)  ? "swarm"
    : activePaper       ? "paper"
    : "chat";

  const MODE_CONFIG = {
    auto:  { label:"Auto",       icon:"✨", color:"#a8a29e", bg:"#fafaf9", border:"#e7e5e4" },
    chat:  { label:"Chat",       icon:"💬", color:"#44403c", bg:"#fafaf9", border:"#e7e5e4" },
    swarm: { label:"Swarm",      icon:"⚡", color:"#ea580c", bg:"#fff7ed", border:"#fed7aa" },
    url:   { label:"URL/arXiv",  icon:"🔗", color:"#3b82f6", bg:"#eff6ff", border:"#bfdbfe" },
    paper: { label:"Paper Chat", icon:"📖", color:"#8b5cf6", bg:"#f5f3ff", border:"#ddd6fe" },
  };

  const resize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const send = () => {
    if ((!text.trim() && !file) || disabled) return;
    const modeToSend = mode === "auto" ? null : mode;
    onSend(text.trim(), file, modeToSend);
    setText(""); setFile(null);
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const canSend = (text.trim() || file) && !disabled;
  const activeModeConfig = MODE_CONFIG[mode !== "auto" ? mode : detectedMode] || MODE_CONFIG.auto;

  return (
    <div style={{ padding:"10px 16px 20px" }}>

      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
            style={{ display:"flex", justifyContent:"center", marginBottom:"10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"6px 16px",
              borderRadius:"9999px", background:"#fff7ed", border:"1.5px solid #fed7aa",
              color:"#ea580c", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.73rem",
              boxShadow:"0 2px 12px rgba(249,115,22,.1)" }}>
              <Paperclip size={12} />
              <span style={{ maxWidth:"220px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</span>
              <span style={{ color:"#d6c4b0" }}>({(file.size/1024/1024).toFixed(1)}MB)</span>
              <button onClick={() => setFile(null)} style={{ color:"#fb923c", marginLeft:"2px", cursor:"pointer", background:"none", border:"none" }}><X size={12} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") setFile(f); }}
        style={{
          display:"flex", alignItems:"flex-end", gap:"12px",
          padding:"16px 20px", borderRadius:"26px",
          background: drag ? "#fff7ed" : "rgba(255,255,255,.92)",
          backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
          border: drag ? "2px solid #f97316" : focus ? "2px solid #fed7aa" : "1.5px solid #ede8e0",
          boxShadow: focus
            ? "0 0 0 5px rgba(249,115,22,.06), 0 8px 40px rgba(249,115,22,.08), 0 2px 0 rgba(255,255,255,.9)"
            : "0 4px 32px rgba(120,113,108,.07), 0 1px 0 rgba(255,255,255,.9)",
          transition:"border .2s, box-shadow .2s",
        }}>
        <button onClick={() => fileRef.current?.click()}
          style={{ flexShrink:0, width:"40px", height:"40px", borderRadius:"13px",
            display:"flex", alignItems:"center", justifyContent:"center",
            background: file ? "#fff7ed" : "#faf7f4",
            border:`1.5px solid ${file ? "#fed7aa" : "#ede8e0"}`,
            color: file ? "#ea580c" : "#d6c4b0", cursor:"pointer", transition:"all .15s" }}
          onMouseEnter={e => { e.currentTarget.style.background="#fff7ed"; e.currentTarget.style.color="#ea580c"; e.currentTarget.style.borderColor="#fed7aa"; }}
          onMouseLeave={e => { e.currentTarget.style.background=file?"#fff7ed":"#faf7f4"; e.currentTarget.style.color=file?"#ea580c":"#d6c4b0"; e.currentTarget.style.borderColor=file?"#fed7aa":"#ede8e0"; }}
          title="Attach PDF">
          <Paperclip size={17} />
        </button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }}
          onChange={e => { const f = e.target.files[0]; if (f) { if (f.size > MAX_FILE_MB*1024*1024) { alert(`Max ${MAX_FILE_MB}MB`); return; } setFile(f); } e.target.value=""; }} />

        {/* ── Mode Button ── */}
        <div ref={modeRef} style={{ position:"relative", flexShrink:0 }}>
          <button onClick={() => setShowModeMenu(s => !s)}
            title="Switch mode"
            style={{
              width:"38px", height:"38px", borderRadius:"12px",
              display:"flex", alignItems:"center", justifyContent:"center",
              background: showModeMenu ? (activeModeConfig?.bg||"#fff7ed") : "rgba(249,115,22,.06)",
              border:`1.5px solid ${showModeMenu?(activeModeConfig?.color||"#f97316"):"rgba(249,115,22,.25)"}`,
              cursor:"pointer", transition:"all .15s", flexShrink:0,
            }}>
            <span style={{ fontSize:"1.05rem", lineHeight:1, userSelect:"none" }}>
              {activeModeConfig?.icon||"✨"}
            </span>
          </button>

          <AnimatePresence>
            {showModeMenu && (
              <motion.div
                initial={{ opacity:0, y:8, scale:0.95 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:8, scale:0.95 }}
                transition={{ type:"spring", stiffness:400, damping:28 }}
                style={{
                  position:"absolute", bottom:"50px", left:"0",
                  width:"230px", background:"#ffffff",
                  borderRadius:"18px", border:"1.5px solid #ede8e0",
                  boxShadow:"0 8px 40px rgba(0,0,0,.12)", overflow:"hidden", zIndex:999,
                }}>
                <div style={{ padding:"10px 14px 8px", borderBottom:"1px solid #f5f0ea" }}>
                  <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.6rem",
                    textTransform:"uppercase", letterSpacing:"0.1em", color:"#a8a29e", fontWeight:700, margin:0 }}>
                    Input Mode
                  </p>
                </div>
                {[
                  { key:"auto",  icon:"✨", label:"Auto Detect",    desc:"URL, text ya PDF detect karta hai", color:"#78716c", bg:"#fafaf9" },
                  { key:"chat",  icon:"💬", label:"Normal Chat",    desc:"Direct AI se baat karo",            color:"#44403c", bg:"#fafaf9" },
                  { key:"swarm", icon:"⚡", label:"Swarm Analysis", desc:"Full agent pipeline",               color:"#ea580c", bg:"#fff7ed" },
                  { key:"url",   icon:"🔗", label:"URL / arXiv",    desc:"Link se PDF download karke analyze", color:"#3b82f6", bg:"#eff6ff" },
                ].map(m => (
                  <button key={m.key}
                    onClick={() => { setMode(m.key); setShowModeMenu(false); }}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", gap:"10px",
                      padding:"9px 14px", cursor:"pointer", textAlign:"left",
                      background: mode===m.key ? m.bg : "transparent", border:"none",
                      borderLeft:`3px solid ${mode===m.key?m.color:"transparent"}`,
                      transition:"all .12s",
                    }}
                    onMouseEnter={e => { if(mode!==m.key) e.currentTarget.style.background="#fafaf9"; }}
                    onMouseLeave={e => { if(mode!==m.key) e.currentTarget.style.background="transparent"; }}
                  >
                    <span style={{ fontSize:"1.1rem", flexShrink:0 }}>{m.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                        <p style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:"0.83rem",
                          fontWeight:mode===m.key?700:500, color:mode===m.key?m.color:"#1c1917", margin:0 }}>
                          {m.label}
                        </p>
                        {mode==="auto" && m.key===detectedMode && (
                          <span style={{ fontSize:"0.58rem", color:m.color, padding:"1px 5px",
                            borderRadius:"4px", background:m.bg, border:`1px solid ${m.color}44`,
                            fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>auto</span>
                        )}
                      </div>
                      <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.62rem",
                        color:"#a8a29e", margin:0 }}>{m.desc}</p>
                    </div>
                    {mode===m.key && <span style={{ color:m.color, flexShrink:0 }}>●</span>}
                  </button>
                ))}
                <div style={{ padding:"8px 14px", borderTop:"1px solid #f5f0ea", background:"#fafaf9",
                  display:"flex", alignItems:"center", gap:"6px" }}>
                  <span style={{ fontSize:"0.85rem" }}>{activeModeConfig?.icon}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.63rem",
                    color:activeModeConfig?.color, fontWeight:600 }}>{activeModeConfig?.label}</span>
                  {mode==="auto" && <span style={{ fontSize:"0.6rem", color:"#a8a29e",
                    fontFamily:"'JetBrains Mono',monospace" }}>· auto</span>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea ref={taRef} rows={2} value={text}
          onChange={e => { setText(e.target.value); resize(); }}
          onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholder={file ? "Ask something about this paper…" : "Upload a PDF or ask a research question…"}
          disabled={disabled}
          style={{ flex:1, background:"transparent", border:"none", outline:"none", resize:"none",
            color:"#1c1917", fontFamily:"'Space Grotesk',sans-serif", fontSize:"0.92rem",
            lineHeight:1.65, minHeight:"48px", maxHeight:"160px", caretColor:"#f97316" }} />

        <motion.button whileTap={{ scale:0.88 }} onClick={send} disabled={!canSend}
          style={{
            flexShrink:0, width:"46px", height:"46px", borderRadius:"15px",
            display:"flex", alignItems:"center", justifyContent:"center",
            background: canSend
                ? detectedMode==="url"   ? "linear-gradient(135deg,#3b82f6,#2563eb)"
                : detectedMode==="swarm" ? "linear-gradient(135deg,#f97316,#ea580c)"
                : detectedMode==="paper" ? "linear-gradient(135deg,#8b5cf6,#7c3aed)"
                : "linear-gradient(135deg,#1c1917,#44403c)"
                : "#faf7f4",
            border: canSend ? "none" : "1.5px solid #ede8e0",
            boxShadow: canSend ? "0 4px 20px rgba(249,115,22,.32), 0 1px 0 rgba(255,255,255,.2) inset" : "none",
            cursor: canSend ? "pointer" : "not-allowed", transition:"all .2s",
          }}>
          <Send size={17} style={{ color: canSend ? "#fff" : "#d6c4b0" }} />
        </motion.button>
      </div>
      <p style={{ textAlign:"center", marginTop:"8px", fontFamily:"'JetBrains Mono',monospace", fontSize:"0.62rem", color:"#d6c4b0" }}>
        Shift+Enter for newline · Drag & drop PDF supported
      </p>
    </div>
  );
}

/* ── App ── */
export default function SwarmLab() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePaper, setActivePaper] = useState(null); // currently loaded paper for chat
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    apiKey: "",
  });
  const [sessions, setSessions] = useState([]);
  const bottomRef = useRef();
  const wsRef = useRef(null);
  const thinkIdRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  const ts = () => new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

  // WebSocket — connect on mount, use ref for thinkId
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket("ws://localhost:8000/ws/logs");
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[SwarmLab] WS connected ✓");
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const newLog = {
              agent:   data.agent   || "system",
              message: data.message || "",
              status:  data.status  || "running",
              ts:      data.ts      || new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}),
            };

            // Use thinkIdRef directly — most reliable
            const tid = thinkIdRef.current;
            if (tid !== null) {
              setMessages(prev => prev.map(m =>
                m.id === tid
                  ? { ...m, logs: [...(m.logs || []), newLog] }
                  : m
              ));
            } else {
              // Fallback: attach to any loading message still in state
              setMessages(prev => {
                const thinkMsg = [...prev].reverse().find(m => m.loading === true);
                if (!thinkMsg) return prev;
                return prev.map(m =>
                  m.id === thinkMsg.id
                    ? { ...m, logs: [...(m.logs || []), newLog] }
                    : m
                );
              });
            }
          } catch(err) { console.warn("[SwarmLab] WS parse error", err); }
        };

        ws.onclose = () => {
          console.log("[SwarmLab] WS closed — reconnecting in 2s...");
          setTimeout(connect, 2000);
        };
        ws.onerror = (err) => {
          console.warn("[SwarmLab] WS error", err);
          ws.close();
        };
      } catch(e) {
        console.warn("[SwarmLab] WS init error", e);
        setTimeout(connect, 3000);
      }
    };
    connect();
    return () => { try { wsRef.current?.close(); } catch(e) {} };
  }, []);

  const handleSend = async (text, file, forcedMode) => {
    const uid = Date.now(), tid = Date.now() + 1;
    thinkIdRef.current = tid;

    // ── Determine mode ─────────────────────────────────────
    const effectiveMode = forcedMode || (() => {
      if (file)                    return "swarm";
      if (isURL(text.trim()))      return "url";
      if (isLongText(text))        return "swarm";
      if (activePaper)             return "paper";
      return "chat";
    })();

    // ── User label ──────────────────────────────────────────
    const userLabel =
      effectiveMode === "url"   ? `🔗 ${text.trim()}` :
      effectiveMode === "swarm" && file ? `📄 ${file.name}${text?" — "+text:""}` :
      effectiveMode === "swarm" ? `📝 Analyzing pasted text (${text.length} chars)…` :
      text;

    setMessages(p => [...p,
      { id:uid, role:"user", content:userLabel, time:ts() },
      { id:tid, role:"ai", loading:true, logs:[], fileName:file?.name, time:ts() },
    ]);
    setLoading(true);
    if (file)                    setSessions(p => [file.name,                               ...p.slice(0,4)]);
    if (effectiveMode === "url") setSessions(p => [text.replace(/https?:\/\//,"").slice(0,40), ...p.slice(0,4)]);

    const addCommon = (fd) => {
      if (config.apiKey) fd.append("api_key",    config.apiKey);
      fd.append("provider",   config.provider);
      fd.append("model_name", config.model);
    };

    try {
      let r, fd = new FormData();
      addCommon(fd);

      if (effectiveMode === "swarm" && file) {
        // PDF upload
        fd.append("file", file, file.name);
        if (text) fd.append("query", text);
        r = await axios.post(API_URL, fd, { timeout:600000 });
        if (r.data?.title) setActivePaper(r.data.title.replace(/\.pdf$/i,"").replace(/[^a-zA-Z0-9]/g,"_").slice(0,50));

      } else if (effectiveMode === "url") {
        // URL / arXiv
        fd.append("url", text.trim());
        r = await axios.post(URL_API, fd, { timeout:600000 });
        if (r.data?.title) setActivePaper(r.data.title.replace(/[^a-zA-Z0-9]/g,"_").slice(0,50));

      } else if (effectiveMode === "swarm") {
        // Pasted long text
        fd.append("text", text);
        r = await axios.post(TEXT_API, fd, { timeout:600000 });

      } else if (effectiveMode === "paper") {
        // Chat with loaded paper
        fd.append("message",       text);
        fd.append("paper_context", activePaper || "");
        r = await axios.post(PAPER_CHAT_URL, fd, { timeout:120000 });

      } else {
        // Normal chat
        fd.append("message", text);
        r = await axios.post(CHAT_URL, fd, { timeout:120000 });
      }

      const out = r.data?.report || r.data?.result || r.data?.message || JSON.stringify(r.data, null, 2);
      setMessages(p => p.map(m => m.id === tid ? { ...m, loading:false, content:out } : m));
      thinkIdRef.current = null;

    } catch (e) {
      const offline = !e.response || e.code === "ECONNREFUSED" || e.code === "ERR_NETWORK";
      let errDetail = "Unknown error";
      try {
        const d = e.response?.data;
        if (typeof d === "string")       errDetail = d;
        else if (d?.detail)              errDetail = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
        else if (d?.message)             errDetail = d.message;
        else if (d)                      errDetail = JSON.stringify(d);
        else if (e.message)              errDetail = e.message;
      } catch(_) { errDetail = String(e); }

      const msg = offline
        ? "## ⚡ System Offline\n\nBackend not reachable at `localhost:8000`.\n\n```bash\nuvicorn main:app --reload --port 8000\n```"
        : "## Failed\n\n**Error:** " + errDetail;
      setMessages(p => p.map(m => m.id === tid ? { ...m, loading:false, content:msg, isError:true } : m));
      thinkIdRef.current = null;
    } finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes ping    { 75%,100% { transform: scale(2); opacity: 0; } }
        @keyframes breathe { 0%,100%{ transform:scale(3.5);opacity:.35 } 50%{ transform:scale(4.8);opacity:.7 } }
        @keyframes ping-sm { 0%,100%{ opacity:1;transform:scale(1) } 50%{ opacity:.4;transform:scale(.65) } }
        @keyframes pulse-dot { 0%,100%{ opacity:1;transform:scale(1) } 50%{ opacity:.4;transform:scale(.6) } }

        .swarm-bg { position:fixed;inset:0;z-index:0;background:#FFF8F2;overflow:hidden; }

        textarea::placeholder { color:#d6c4b0; }
        textarea { caret-color:#f97316; }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .msg-max-width { max-width: 88% !important; }
          .greeting-text { font-size: 2rem !important; }
        }

        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(249,115,22,.15); border-radius:99px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(249,115,22,.3); }
        ::selection { background:rgba(249,115,22,.15); color:#1c1917; }

        /* ── Markdown ── */
        .swarm-md { font-size:.91rem; line-height:1.85; color:#0c0a09; font-family:'Space Grotesk',sans-serif; }
        .swarm-md>*:first-child { margin-top:0!important; }
        .swarm-md>*:last-child  { margin-bottom:0!important; }

        .swarm-md h1 {
          font-family:'Space Grotesk',sans-serif; font-size:1.4rem;
          font-weight:800; font-style:italic;
          color:#000000; letter-spacing:-.04em;
          margin:0 0 18px; padding-bottom:14px;
          border-bottom:3px solid #f97316;
          text-shadow: 0 1px 2px rgba(0,0,0,.06);
        }
        .swarm-md h2 {
          font-family:'Space Grotesk',sans-serif; font-size:1.08rem;
          font-weight:800; font-style:italic;
          color:#0c0a09; margin:26px 0 10px;
          padding-left:12px; border-left:4px solid #f97316;
          letter-spacing:-.02em;
        }
        .swarm-md h3 {
          font-family:'Space Grotesk',sans-serif; font-size:.96rem;
          font-weight:700; font-style:italic;
          color:#1c1917; margin:20px 0 8px;
          letter-spacing:-.01em;
        }
        .swarm-md h4 { font-size:.88rem; font-weight:700; color:#292524; margin:14px 0 6px; font-style:italic; }

        .swarm-md p  { margin-bottom:.85em; color:#1c1917; font-weight:400; }
        .swarm-md ul,.swarm-md ol { padding-left:1.6em; margin-bottom:.85em; }
        .swarm-md li { margin-bottom:.4em; color:#1c1917; }
        .swarm-md li::marker { color:#f97316; font-weight:700; }

        /* Bold = black + heavier */
        .swarm-md strong {
          color:#000000 !important;
          font-weight:800 !important;
          font-style:italic;
          letter-spacing:-.01em;
        }
        /* Em = dark italic */
        .swarm-md em { color:#292524; font-style:italic; font-weight:500; }
        .swarm-md strong em, .swarm-md em strong {
          color:#000000; font-weight:800; font-style:italic;
        }
        .swarm-md a  { color:#ea580c; text-decoration:underline; text-underline-offset:3px; font-weight:600; }
        .swarm-md hr { border:none; border-top:1.5px solid #f0ebe4; margin:22px 0; }

        .swarm-md :not(pre)>code {
          font-family:'JetBrains Mono',monospace; font-size:.8em;
          color:#92400e; background:#fef3c7; border:1px solid #fde68a;
          padding:2px 6px; border-radius:5px;
        }
        .swarm-md pre {
          background:#fafaf9; border:1.5px solid #e7e5e4;
          border-radius:12px; padding:1em 1.2em; margin:.9em 0; overflow-x:auto;
        }
        .swarm-md pre code { background:transparent; border:none; padding:0; font-size:.82em; color:#57534e; }
        .swarm-md blockquote {
          border-left:3px solid #fed7aa; padding:.5em 0 .5em 1em; margin:.9em 0;
          color:#78716c; font-style:italic; background:#fff7ed; border-radius:0 8px 8px 0;
        }

        /* ── Tables ── */
        .swarm-md table { width:100%; border-collapse:collapse; margin:1em 0; font-size:.82rem; overflow:hidden; border-radius:10px; border:1.5px solid #e7e5e4; }
        .swarm-md thead tr { background:linear-gradient(135deg,#fff7ed,#fef3c7); }
        .swarm-md th {
          padding:.6em .9em; text-align:left;
          font-family:'JetBrains Mono',monospace; font-size:.72rem; font-weight:700;
          color:#9a3412; text-transform:uppercase; letter-spacing:.06em;
          border-bottom:2px solid #fed7aa;
        }
        .swarm-md td { padding:.55em .9em; color:#292524; border-bottom:1px solid #f5f0ea; vertical-align:top; }
        .swarm-md tr:last-child td { border-bottom:none; }
        .swarm-md tr:nth-child(even) td { background:#fafaf9; }
        .swarm-md tr:hover td { background:#fff7ed; transition:background .15s; }

        /* ── PDF Preview panel styles ── */
        .pdf-preview-content { font-family:'Inter',sans-serif; font-size:12px; line-height:1.7; color:#1c1917; }
        .pdf-preview-content h1 { font-size:1.2rem; font-weight:700; color:#0c0a09; margin:0 0 12px; padding-bottom:10px; border-bottom:2px solid #fed7aa; letter-spacing:-0.02em; }
        .pdf-preview-content h2 { font-size:0.95rem; font-weight:700; color:#1c1917; margin:20px 0 8px; padding-left:8px; border-left:3px solid #f97316; }
        .pdf-preview-content h3 { font-size:0.85rem; font-weight:600; color:#44403c; margin:14px 0 6px; }
        .pdf-preview-content p  { margin-bottom:8px; color:#292524; }
        .pdf-preview-content ul,.pdf-preview-content ol { padding-left:18px; margin-bottom:8px; }
        .pdf-preview-content li { margin-bottom:3px; }
        .pdf-preview-content li::marker { color:#f97316; }
        .pdf-preview-content strong { color:#0c0a09; font-weight:600; }
        .pdf-preview-content code { font-family:'JetBrains Mono',monospace; font-size:0.75em; background:#fef3c7; border:1px solid #fde68a; padding:1px 4px; border-radius:3px; color:#92400e; }
        .pdf-preview-content pre { background:#fafaf9; border:1px solid #e7e5e4; border-radius:6px; padding:10px 12px; margin:8px 0; overflow-x:auto; }
        .pdf-preview-content blockquote { border-left:3px solid #fed7aa; padding:4px 0 4px 10px; margin:8px 0; color:#78716c; background:#fff7ed; border-radius:0 5px 5px 0; }
        .pdf-preview-content table { width:100%; border-collapse:collapse; margin:10px 0; font-size:0.78rem; }
        .pdf-preview-content th,.pdf-preview-content td { border:1px solid #e7e5e4; padding:5px 8px; text-align:left; }
        .pdf-preview-content th { background:#fff7ed; color:#9a3412; font-weight:600; font-size:0.68rem; text-transform:uppercase; }
        .pdf-preview-content td { color:#292524; }
        .pdf-preview-content tr:nth-child(even) td { background:#fafaf9; }
        .pdf-preview-content hr { border:none; border-top:1px solid #e7e5e4; margin:16px 0; }
      `}</style>

      <div className="swarm-bg" />

      <div style={{ display:"flex", width:"100vw", height:"100vh", overflow:"hidden", position:"relative", zIndex:1, fontFamily:"'Space Grotesk',sans-serif" }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewAnalysis={() => { setMessages([]); setActivePaper(null); }} sessions={sessions} />

        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0, position:"relative" }}>

          {/* ── Topbar ── */}
          <div style={{
            flexShrink:0, display:"flex", alignItems:"center", gap:"10px",
            padding:"10px 16px",
            borderBottom:"1px solid #f5f0ea",
            background:"rgba(255,248,242,.92)",
            backdropFilter:"blur(16px)",
            WebkitBackdropFilter:"blur(16px)",
          }}>
            {/* Sidebar toggle */}
            <button onClick={() => setSidebarOpen(s => !s)}
              style={{ width:"36px", height:"36px", borderRadius:"10px", flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:"#fff7ed", border:"1.5px solid #fed7aa",
                color:"#fb923c", cursor:"pointer" }}>
              <PanelLeftOpen size={16} />
            </button>

            {/* Logo */}
            <span style={{ flex:1, fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:"1rem",
              background:"linear-gradient(135deg,#f97316,#ea580c)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              SwarmLab
            </span>

            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.6rem",
              color:"#d6c4b0", marginRight:"4px", flexShrink:0 }}>v2.4</span>

            {/* Settings button */}
            <button onClick={() => setShowSettings(s => !s)}
              style={{
                display:"flex", alignItems:"center", gap:"5px",
                padding:"7px 12px", borderRadius:"10px", flexShrink:0,
                background: showSettings ? "linear-gradient(135deg,#f97316,#ea580c)" : "#fafaf9",
                border: showSettings ? "none" : "1.5px solid #ede8e0",
                color: showSettings ? "#fff" : "#78716c",
                fontFamily:"'Space Grotesk',sans-serif", fontSize:"0.76rem", fontWeight:600,
                cursor:"pointer",
                boxShadow: showSettings ? "0 3px 12px rgba(249,115,22,.3)" : "none",
                transition:"all .2s",
              }}>
              <Settings size={13} />
              <span style={{ maxWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {config.model.split("/").pop().split("-").slice(0,2).join("-")}
              </span>
              <ChevronDown size={11} style={{ opacity:0.6 }} />
            </button>
          </div>

          {/* Settings Modal */}
          <AnimatePresence>
            {showSettings && (
              <SettingsPanel
                config={config}
                onChange={setConfig}
                onClose={() => setShowSettings(false)}
              />
            )}
          </AnimatePresence>

          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
            <div style={{ maxWidth:"860px", margin:"0 auto", padding:"36px 28px 12px" }}>
              {messages.length === 0
                ? <div style={{ minHeight:"calc(100vh - 200px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Empty />
                  </div>
                : <div style={{ display:"flex", flexDirection:"column", gap:"20px", paddingBottom:"8px" }}>
                    <AnimatePresence initial={false}>
                      {messages.map(m => <Message key={m.id} msg={m} />)}
                    </AnimatePresence>
                    <div ref={bottomRef} />
                  </div>
              }
            </div>
          </div>

          <div style={{ maxWidth:"860px", width:"100%", margin:"0 auto", alignSelf:"stretch" }}>
            {/* Active paper banner */}
            {activePaper && (
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"7px 20px",
                background:"linear-gradient(135deg,#fff7ed,#fef3c7)",
                borderTop:"1px solid #fed7aa",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <MessageSquare size={13} style={{ color:"#f97316" }} />
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.68rem", color:"#ea580c", fontWeight:600 }}>
                    Chat mode: {activePaper.replace(/_/g," ")}
                  </span>
                  <span style={{ fontSize:"0.62rem", color:"#a8a29e", fontFamily:"'JetBrains Mono',monospace" }}>
                    · Ask anything about this paper
                  </span>
                </div>
                <button onClick={() => setActivePaper(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#d6c4b0", fontSize:"0.7rem" }}>
                  ✕ Exit chat
                </button>
              </div>
            )}
            <InputBar onSend={handleSend} disabled={loading} activePaper={activePaper} />
          </div>
        </div>
      </div>
    </>
  );
}