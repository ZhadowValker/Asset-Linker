import { useState, useRef, useEffect } from "react";

const DEFAULT_LEFT  = "https://raw.githubusercontent.com/sajeevavahini/bibles/main/Telugu%20Bible%20(BSI).xml";
const DEFAULT_RIGHT = "https://raw.githubusercontent.com/sajeevavahini/bibles/main/New%20International%20Version%20(UK).xml";
const PROXY = "/api/proxy?url=";

type Books = Record<string, Record<string, Record<string, string>>>;

function parseXML(text: string): Books {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const books: Books = {};

  const zBooks = doc.querySelectorAll("BIBLEBOOK");
  if (zBooks.length > 0) {
    zBooks.forEach(b => {
      const name = b.getAttribute("bname") || b.getAttribute("n") || "?";
      books[name] = {};
      b.querySelectorAll("CHAPTER").forEach(ch => {
        const cn = ch.getAttribute("cnumber") || ch.getAttribute("n");
        if (!cn) return;
        books[name][cn] = {};
        ch.querySelectorAll("VERS").forEach(v => {
          const vn = v.getAttribute("vnumber") || v.getAttribute("n");
          if (vn) books[name][cn][vn] = v.textContent?.trim() ?? "";
        });
      });
    });
    return books;
  }

  doc.querySelectorAll("div[type='book']").forEach(b => {
    const name = b.getAttribute("osisID") || "?";
    books[name] = {};
    b.querySelectorAll("chapter").forEach(ch => {
      const cn = ch.getAttribute("osisID")?.split(".")[1];
      if (!cn) return;
      books[name][cn] = {};
      ch.querySelectorAll("verse").forEach(v => {
        const vn = v.getAttribute("osisID")?.split(".")[2];
        if (vn) books[name][cn][vn] = v.textContent?.trim() ?? "";
      });
    });
  });
  return books;
}

async function loadXML(url: string): Promise<Books> {
  const res = await fetch(PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const data = parseXML(text);
  if (Object.keys(data).length === 0) throw new Error("No books parsed — check XML format");
  return data;
}

const SPD: string[] = ["","Slow","","","Medium","","","Fast","","","Turbo"];

export default function App() {
  const [leftUrl,  setLeftUrl]  = useState(DEFAULT_LEFT);
  const [rightUrl, setRightUrl] = useState(DEFAULT_RIGHT);
  const [showUrls, setShowUrls] = useState(false);

  const [leftData,  setLeftData]  = useState<Books | null>(null);
  const [rightData, setRightData] = useState<Books | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState("");
  const [leftLabel,  setLeftLabel]  = useState("");
  const [rightLabel, setRightLabel] = useState("");

  const [book,   setBook]   = useState("");
  const [chap,   setChap]   = useState("");
  const [verses, setVerses] = useState<{ tV: Record<string,string>; nV: Record<string,string>; nums: string[] } | null>(null);

  const [autoOn, setAutoOn] = useState(false);
  const [speed,  setSpeed]  = useState(2);

  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing  = useRef(false);
  const rafRef   = useRef<number | null>(null);
  const autoRef  = useRef(false);
  const speedRef = useRef(2);
  autoRef.current  = autoOn;
  speedRef.current = speed;

  const books    = leftData ? Object.keys(leftData) : [];
  const chapters = (book && leftData?.[book]) ? Object.keys(leftData[book]).sort((a,b)=>+a-+b) : [];
  const canRead  = !!(book && chap);

  async function fetchBibles(lUrl: string, rUrl: string) {
    setLoading(true);
    setLoadError("");
    setLeftData(null); setRightData(null);
    setBook(""); setChap(""); setVerses(null); setAutoOn(false);
    try {
      const [lData, rData] = await Promise.all([loadXML(lUrl), loadXML(rUrl)]);
      setLeftData(lData);
      setRightData(rData);
      setLeftLabel(decodeURIComponent(lUrl.split("/").pop()!.replace(/\.xml$/i,"")));
      setRightLabel(decodeURIComponent(rUrl.split("/").pop()!.replace(/\.xml$/i,"")));
      setShowUrls(false);
    } catch(e: unknown) {
      setLoadError((e as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => { fetchBibles(DEFAULT_LEFT, DEFAULT_RIGHT); }, []);

  function read() {
    if (!book || !chap || !leftData || !rightData) return;
    const tV = leftData[book]?.[chap]  || {};
    const nV = rightData[book]?.[chap] || {};
    const nums = [...new Set([...Object.keys(tV),...Object.keys(nV)])].sort((a,b)=>+a-+b);
    setVerses({ tV, nV, nums });
    setAutoOn(false);
    setTimeout(()=>{
      if (leftRef.current)  leftRef.current.scrollTop  = 0;
      if (rightRef.current) rightRef.current.scrollTop = 0;
    }, 60);
  }

  const onLeftScroll = () => {
    if (autoRef.current || syncing.current || !rightRef.current || !leftRef.current) return;
    syncing.current = true;
    rightRef.current.scrollTop = leftRef.current.scrollTop;
    syncing.current = false;
  };
  const onRightScroll = () => {
    if (autoRef.current || syncing.current || !leftRef.current || !rightRef.current) return;
    syncing.current = true;
    leftRef.current.scrollTop = rightRef.current.scrollTop;
    syncing.current = false;
  };

  useEffect(() => {
    let last: number | null = null;
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!autoRef.current || !leftRef.current) { last = null; return; }
      if (last !== null) {
        const px = (ts - last) * speedRef.current * 0.03;
        leftRef.current.scrollTop += px;
        if (rightRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
        const el = leftRef.current;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          setAutoOn(false); last = null; return;
        }
      }
      last = ts;
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const fillPct = ((speed - 1) / 9) * 100;

  return (
    <div style={{fontFamily:"Georgia,serif",background:"#0e0c09",color:"#d4c5a0",height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Top Bar */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"7px 14px", background:"#161410",
        borderBottom:"1px solid rgba(201,168,76,0.18)", flexShrink:0, flexWrap:"wrap",
      }}>
        <Ctrl label="Book">
          <select value={book} onChange={e=>{setBook(e.target.value);setChap("");setVerses(null);setAutoOn(false);}} disabled={!leftData} style={S.sel}>
            <option value="">— Book —</option>
            {books.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </Ctrl>

        <Ctrl label="Chapter">
          <select value={chap} onChange={e=>{setChap(e.target.value);setVerses(null);setAutoOn(false);}} disabled={!chapters.length} style={{...S.sel,minWidth:110}}>
            <option value="">— Ch —</option>
            {chapters.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Ctrl>

        <button onClick={read} disabled={!canRead} style={{
          ...S.btn, marginTop:14,
          background: canRead ? "linear-gradient(135deg,#7a5a1a,#c9a84c)" : "#1a1810",
          color:      canRead ? "#0e0c09" : "#3a3828",
          cursor:     canRead ? "pointer"  : "not-allowed",
        }}>Read ›</button>

        <div style={{width:1,height:28,background:"rgba(201,168,76,0.15)",margin:"14px 4px 0"}}/>

        {/* Auto-scroll controls */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14}}>
          <button
            onClick={() => verses && setAutoOn(p=>!p)}
            title={autoOn ? "Pause" : "Auto-scroll"}
            style={{
              width:28, height:28, borderRadius:"50%", border:"none", flexShrink:0,
              background: autoOn ? "linear-gradient(135deg,#c9a84c,#e8d070)" : "rgba(201,168,76,0.12)",
              color:      autoOn ? "#0e0c09" : (verses ? "#c9a84c" : "#444"),
              cursor:     verses ? "pointer" : "not-allowed",
              fontSize:11, transition:"all 0.2s",
              boxShadow: autoOn ? "0 0 12px rgba(201,168,76,0.45)" : "none",
            }}>{autoOn?"⏸":"▶"}</button>

          <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#c9a84c",opacity:0.7,width:40,textAlign:"center",lineHeight:1.2}}>
            {SPD[speed]||"Speed"}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:2,width:140}}>
            <input type="range" min={1} max={10} step={1} value={speed}
              onChange={e=>setSpeed(+e.target.value)}
              style={{
                width:"100%", cursor:"pointer", height:4,
                accentColor:"#c9a84c", outline:"none",
                WebkitAppearance:"none", appearance:"none",
                background:`linear-gradient(to right,#c9a84c ${fillPct}%,#252010 ${fillPct}%)`,
                borderRadius:4, border:"none",
              }}
            />
            <div style={{display:"flex",justifyContent:"space-between"}}>
              {Array.from({length:10},(_,i)=>i+1).map(n=>(
                <div key={n} style={{width:1.5,height:n===speed?7:3,background:n<=speed?"#c9a84c":"#2a2416",borderRadius:1,transition:"height 0.1s"}}/>
              ))}
            </div>
          </div>

          <div style={{fontSize:12,color:"#c9a84c",fontWeight:"bold",width:14}}>{speed}</div>

          {autoOn && (
            <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#c9a84c",display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#c9a84c",display:"inline-block",animation:"blink 0.9s infinite"}}/>
              scrolling
            </div>
          )}
        </div>

        <div style={{width:1,height:28,background:"rgba(201,168,76,0.15)",margin:"14px 4px 0"}}/>

        <button onClick={()=>setShowUrls(p=>!p)} style={{
          ...S.btn, marginTop:14, fontSize:11,
          background:"rgba(201,168,76,0.1)",
          border:"1px solid rgba(201,168,76,0.25)",
          color:"#c9a84c", padding:"5px 12px",
        }}>⚙ Sources {showUrls?"▲":"▼"}</button>

        <div style={{marginLeft:"auto",marginTop:14,fontSize:11,color:"#8a7d60",fontStyle:"italic"}}>
          {loading ? "Loading…" : loadError ? <span style={{color:"#e07060"}}>⚠ {loadError}</span>
            : leftData ? (verses ? `${book} · Ch.${chap} · ${verses.nums.length} verses` : `${books.length} books loaded`) : ""}
        </div>
      </div>

      {/* XML Source Editor (collapsible) */}
      {showUrls && (
        <div style={{
          padding:"10px 14px", background:"#120f0b",
          borderBottom:"1px solid rgba(201,168,76,0.15)", flexShrink:0,
          display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end",
        }}>
          <Ctrl label={`Left Panel XML${leftLabel ? " — "+leftLabel : ""}`}>
            <input value={leftUrl} onChange={e=>setLeftUrl(e.target.value)}
              style={{...S.inp, width:340}} placeholder="Paste raw XML URL…"/>
          </Ctrl>
          <Ctrl label={`Right Panel XML${rightLabel ? " — "+rightLabel : ""}`}>
            <input value={rightUrl} onChange={e=>setRightUrl(e.target.value)}
              style={{...S.inp, width:340}} placeholder="Paste raw XML URL…"/>
          </Ctrl>
          <button onClick={()=>fetchBibles(leftUrl,rightUrl)} style={{
            ...S.btn, alignSelf:"flex-end",
            background:"linear-gradient(135deg,#7a5a1a,#c9a84c)",
            color:"#0e0c09", cursor:"pointer",
          }}>
            {loading ? "Loading…" : "Load XMLs"}
          </button>
          <button onClick={()=>fetchBibles(DEFAULT_LEFT,DEFAULT_RIGHT)} style={{
            ...S.btn, alignSelf:"flex-end",
            background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)",
            color:"#c9a84c", cursor:"pointer", fontSize:11,
          }}>↺ Reset Defaults</button>
        </div>
      )}

      {/* Panels */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",flex:1,overflow:"hidden",minHeight:0}}>

        {/* Left */}
        <div style={{borderRight:"1px solid rgba(201,168,76,0.15)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <PanelHead label={leftLabel || "Left Bible"} color="#c9a84c"/>
          <div ref={leftRef} onScroll={onLeftScroll} style={S.scroll}>
            {loading
              ? <LoadingState/>
              : !verses
                ? <Empty icon="📖" text={leftData ? "Select a book & chapter above" : "Load XML to begin"}/>
                : verses.nums.map((n,i)=><Verse key={n} num={n} text={verses.tV[n]||"—"} delay={i*10}/>)
            }
          </div>
        </div>

        {/* Right */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <PanelHead label={rightLabel || "Right Bible"} color="#8ab4c9"/>
          <div ref={rightRef} onScroll={onRightScroll} style={S.scroll}>
            {loading
              ? <LoadingState/>
              : !verses
                ? <Empty icon="✝" text={rightData ? "Parallel text will appear here" : "Load XML to begin"}/>
                : verses.nums.map((n,i)=><Verse key={n} num={n} text={verses.nV[n]||"—"} delay={i*10}/>)
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none;width:14px;height:14px;border-radius:50%;
          background:radial-gradient(circle,#e8d070,#c9a84c);
          box-shadow:0 0 7px rgba(201,168,76,0.55);cursor:pointer;border:none;
        }
        input[type=range]::-moz-range-thumb{
          width:14px;height:14px;border-radius:50%;background:#c9a84c;cursor:pointer;border:none;
        }
      `}</style>
    </div>
  );
}

function Ctrl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <div style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:"#c9a84c",opacity:0.75}}>{label}</div>
      {children}
    </div>
  );
}

function PanelHead({ label, color }: { label: string; color: string }) {
  return (
    <div style={{
      padding:"6px 16px", background:"#141210",
      borderBottom:"1px solid rgba(201,168,76,0.1)",
      fontSize:11, fontStyle:"italic", color: color||"#c9a84c",
      flexShrink:0, letterSpacing:0.5,
      display:"flex", alignItems:"center", gap:8,
    }}>
      <div style={{width:3,height:14,background:color||"#c9a84c",borderRadius:2,flexShrink:0,opacity:0.8}}/>
      {label}
    </div>
  );
}

function Verse({ num, text, delay }: { num: string; text: string; delay: number }) {
  return (
    <div style={{display:"flex",gap:12,marginBottom:14,animation:`fadeUp 0.3s ease ${delay}ms both`}}>
      <div style={{fontSize:10,color:"#c9a84c",minWidth:22,paddingTop:3,textAlign:"right",flexShrink:0,opacity:0.75,fontWeight:"bold"}}>{num}</div>
      <div style={{fontSize:15,lineHeight:1.9,color:"#f0e4c8",fontFamily:"Georgia,serif"}}>{text}</div>
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12,padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:30,opacity:0.15}}>{icon}</div>
      <div style={{color:"#8a7d60",fontStyle:"italic",fontSize:13,maxWidth:220}}>{text}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14}}>
      <div style={{width:28,height:28,borderRadius:"50%",border:"2px solid #2a2416",borderTopColor:"#c9a84c",animation:"spin 0.8s linear infinite"}}/>
      <div style={{color:"#8a7d60",fontSize:12,fontStyle:"italic"}}>Loading from GitHub…</div>
    </div>
  );
}

const S = {
  sel:{background:"#1a1710",border:"1px solid rgba(201,168,76,0.2)",color:"#f0e4c8",fontFamily:"Georgia,serif",fontSize:13,padding:"5px 9px",borderRadius:3,minWidth:155,outline:"none"} as React.CSSProperties,
  inp:{background:"#1a1710",border:"1px solid rgba(201,168,76,0.2)",color:"#f0e4c8",fontFamily:"Georgia,serif",fontSize:12,padding:"5px 9px",borderRadius:3,outline:"none"} as React.CSSProperties,
  btn:{border:"none",fontFamily:"Georgia,serif",fontWeight:"bold",fontSize:12,padding:"6px 16px",borderRadius:3,letterSpacing:0.4,transition:"opacity 0.2s"} as React.CSSProperties,
  scroll:{padding:"16px 20px",overflowY:"auto",flex:1} as React.CSSProperties,
};
