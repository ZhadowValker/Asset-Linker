import { useState, useRef, useEffect } from "react";

const DEFAULT_LEFT  = "https://raw.githubusercontent.com/sajeevavahini/bibles/main/Telugu%20Bible%20(BSI).xml";
const DEFAULT_RIGHT = "https://raw.githubusercontent.com/sajeevavahini/bibles/main/New%20International%20Version%20(UK).xml";
const PROXY = "/api/proxy?url=";

type Books = Record<string, Record<string, Record<string, string>>>;
type Side  = "left" | "right";

// ── Theme ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#0e0c09", bar: "#161410", ribbon: "#120f0b", panelHead: "#141210",
  text: "#d4c5a0", verse: "#f0e4c8", muted: "#8a7d60",
  gold: "#c9a84c", goldFaint: "rgba(201,168,76,0.1)", goldBorder: "rgba(201,168,76,0.22)",
  divider: "rgba(201,168,76,0.15)", barBorder: "rgba(201,168,76,0.18)",
  selBg: "#1a1710", selText: "#f0e4c8", trackEmpty: "#252010",
  hlBg: "rgba(201,168,76,0.08)", hlBorder: "rgba(201,168,76,0.45)",
  pill: "rgba(201,168,76,0.1)", pillText: "#c9a84c",
  btnActiveBg: "linear-gradient(135deg,#7a5a1a,#c9a84c)", btnActiveText: "#0e0c09",
  btnInactiveBg: "rgba(201,168,76,0.08)", btnInactiveText: "#c9a84c", btnInactiveBorder: "rgba(201,168,76,0.22)",
  spinBorder: "#2a2416",
} as const;

const LIGHT = {
  bg: "#faf7f0", bar: "#f0ebe0", ribbon: "#e8e2d4", panelHead: "#ede8dc",
  text: "#2a1f0a", verse: "#1a1206", muted: "#7a6840",
  gold: "#7a5a1a", goldFaint: "rgba(122,90,26,0.08)", goldBorder: "rgba(122,90,26,0.25)",
  divider: "rgba(122,90,26,0.18)", barBorder: "rgba(122,90,26,0.2)",
  selBg: "#f5f0e6", selText: "#2a1f0a", trackEmpty: "#d8d0bc",
  hlBg: "rgba(122,90,26,0.07)", hlBorder: "rgba(122,90,26,0.4)",
  pill: "rgba(122,90,26,0.1)", pillText: "#7a5a1a",
  btnActiveBg: "linear-gradient(135deg,#7a5a1a,#c9a84c)", btnActiveText: "#fff",
  btnInactiveBg: "rgba(122,90,26,0.07)", btnInactiveText: "#7a5a1a", btnInactiveBorder: "rgba(122,90,26,0.22)",
  spinBorder: "#c8c0a8",
} as const;

type Theme = typeof DARK;

// ── Book names ────────────────────────────────────────────────────────────────
const BOOK_NAMES: Record<number,string> = {
  1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy",
  6:"Joshua",7:"Judges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",
  11:"1 Kings",12:"2 Kings",13:"1 Chronicles",14:"2 Chronicles",
  15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Psalms",
  20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",
  24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",
  28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",
  33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",
  38:"Zechariah",39:"Malachi",40:"Matthew",41:"Mark",42:"Luke",
  43:"John",44:"Acts",45:"Romans",46:"1 Corinthians",47:"2 Corinthians",
  48:"Galatians",49:"Ephesians",50:"Philippians",51:"Colossians",
  52:"1 Thessalonians",53:"2 Thessalonians",54:"1 Timothy",55:"2 Timothy",
  56:"Titus",57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",
  61:"2 Peter",62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation",
};

// ── XML Parser ────────────────────────────────────────────────────────────────
function parseXML(text: string): Books {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const books: Books = {};

  const zBooks = doc.querySelectorAll("BIBLEBOOK");
  if (zBooks.length > 0) {
    zBooks.forEach(b => {
      const name = b.getAttribute("bname") || b.getAttribute("bsname") || b.getAttribute("n") || "?";
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

  const bibleEl = doc.querySelector("bible");
  if (bibleEl) {
    bibleEl.querySelectorAll("book").forEach(b => {
      const num  = parseInt(b.getAttribute("number") ?? "0", 10);
      const name = b.getAttribute("name") || BOOK_NAMES[num] || `Book ${num}`;
      books[name] = {};
      b.querySelectorAll("chapter").forEach(ch => {
        const cn = ch.getAttribute("number");
        if (!cn) return;
        books[name][cn] = {};
        ch.querySelectorAll("verse").forEach(v => {
          const vn = v.getAttribute("number");
          if (vn) books[name][cn][vn] = v.textContent?.trim() ?? "";
        });
      });
    });
    if (Object.keys(books).length > 0) return books;
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

const SPD = ["","Slow","","","Medium","","","Fast","","","Turbo"];

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [leftUrl,  setLeftUrl]  = useState(DEFAULT_LEFT);
  const [rightUrl, setRightUrl] = useState(DEFAULT_RIGHT);

  const [leftData,  setLeftData]  = useState<Books|null>(null);
  const [rightData, setRightData] = useState<Books|null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState("");
  const [leftLabel,  setLeftLabel]  = useState("");
  const [rightLabel, setRightLabel] = useState("");

  const [book,   setBook]   = useState("");
  const [chap,   setChap]   = useState("");
  const [verse,  setVerse]  = useState("");
  const [verses, setVerses] = useState<{tV:Record<string,string>;nV:Record<string,string>;nums:string[]}|null>(null);

  const [autoOn,     setAutoOn]     = useState(false);
  const [speed,      setSpeed]      = useState(2);
  const [fontSize,   setFontSize]   = useState(15);
  const [parallel,   setParallel]   = useState(true);
  const [activeSide, setActiveSide] = useState<Side>("left");
  const [darkMode,   setDarkMode]   = useState(true);
  const [ribbon,     setRibbon]     = useState(false);
  const [showSrc,    setShowSrc]    = useState(false);

  const T: Theme = darkMode ? DARK : LIGHT;

  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing  = useRef(false);
  const rafRef   = useRef<number|null>(null);
  const autoRef  = useRef(false);
  const speedRef = useRef(2);
  autoRef.current  = autoOn;
  speedRef.current = speed;

  const books    = leftData ? Object.keys(leftData) : [];
  const chapters = (book && leftData?.[book]) ? Object.keys(leftData[book]).sort((a,b)=>+a-+b) : [];
  const verseNums = verses ? verses.nums : [];
  const canRead   = !!(book && chap);

  async function fetchBibles(lUrl: string, rUrl: string) {
    setLoading(true); setLoadError("");
    setLeftData(null); setRightData(null);
    setBook(""); setChap(""); setVerse(""); setVerses(null); setAutoOn(false);
    try {
      const [lData, rData] = await Promise.all([loadXML(lUrl), loadXML(rUrl)]);
      setLeftData(lData); setRightData(rData);
      setLeftLabel(decodeURIComponent(lUrl.split("/").pop()!.replace(/\.xml$/i,"")));
      setRightLabel(decodeURIComponent(rUrl.split("/").pop()!.replace(/\.xml$/i,"")));
      setShowSrc(false);
    } catch(e: unknown) { setLoadError((e as Error).message); }
    setLoading(false);
  }

  useEffect(() => { fetchBibles(DEFAULT_LEFT, DEFAULT_RIGHT); }, []);

  function read() {
    if (!book || !chap || !leftData || !rightData) return;
    const tV = leftData[book]?.[chap] || {};
    const nV = rightData[book]?.[chap] || {};
    const nums = [...new Set([...Object.keys(tV),...Object.keys(nV)])].sort((a,b)=>+a-+b);
    setVerses({tV,nV,nums}); setVerse(""); setAutoOn(false);
    setTimeout(()=>{ leftRef.current && (leftRef.current.scrollTop=0); rightRef.current && (rightRef.current.scrollTop=0); }, 60);
  }

  function scrollToVerse(vn: string) {
    setVerse(vn);
    if (!vn) return;
    const go = (el: HTMLDivElement|null) => {
      if (!el) return;
      const t = el.querySelector(`[data-vnum="${vn}"]`) as HTMLElement|null;
      if (t) el.scrollTop = t.offsetTop - 16;
    };
    setTimeout(()=>{ go(leftRef.current); go(rightRef.current); }, 30);
  }

  const onLeftScroll = () => {
    if (autoRef.current || syncing.current || !rightRef.current || !leftRef.current) return;
    syncing.current = true; rightRef.current.scrollTop = leftRef.current.scrollTop; syncing.current = false;
  };
  const onRightScroll = () => {
    if (autoRef.current || syncing.current || !leftRef.current || !rightRef.current) return;
    syncing.current = true; leftRef.current.scrollTop = rightRef.current.scrollTop; syncing.current = false;
  };

  useEffect(() => {
    let last: number|null = null;
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!autoRef.current || !leftRef.current) { last=null; return; }
      if (last !== null) {
        const px = (ts-last)*speedRef.current*0.03;
        leftRef.current.scrollTop += px;
        if (rightRef.current) rightRef.current.scrollTop = leftRef.current.scrollTop;
        const el = leftRef.current;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) { setAutoOn(false); last=null; return; }
      }
      last = ts;
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // shared select style
  const sel: React.CSSProperties = {
    background: T.selBg, border: `1px solid ${T.goldBorder}`,
    color: T.selText, fontFamily:"Georgia,serif", fontSize:13,
    padding:"5px 9px", borderRadius:4, outline:"none", cursor:"pointer",
  };
  const inp: React.CSSProperties = {
    background: T.selBg, border: `1px solid ${T.goldBorder}`,
    color: T.selText, fontFamily:"Georgia,serif", fontSize:12,
    padding:"5px 9px", borderRadius:4, outline:"none", width:320,
  };

  function ToggleBtn({ active, onClick, children, style }: {
    active: boolean; onClick: ()=>void; children: React.ReactNode; style?: React.CSSProperties;
  }) {
    return (
      <button onClick={onClick} style={{
        border:"none", fontFamily:"Georgia,serif", fontWeight:"bold",
        fontSize:11, padding:"5px 12px", borderRadius:4, cursor:"pointer",
        letterSpacing:0.3, transition:"all 0.2s",
        background: active ? T.btnActiveBg : T.btnInactiveBg,
        color: active ? T.btnActiveText : T.btnInactiveText,
        outline: active ? "none" : `1px solid ${T.btnInactiveBorder}`,
        ...style,
      }}>{children}</button>
    );
  }

  function Div() {
    return <div style={{width:1,alignSelf:"stretch",background:T.divider,margin:"0 4px"}}/>;
  }

  const panelContent = (side: Side) => {
    const ref   = side==="left" ? leftRef : rightRef;
    const onScr = side==="left" ? onLeftScroll : onRightScroll;
    const label = side==="left" ? (leftLabel||"Left Bible") : (rightLabel||"Right Bible");
    const color = side==="left" ? T.gold : (darkMode ? "#8ab4c9" : "#4a7a99");
    const emptyIcon = side==="left" ? "📖" : "✝";
    const emptyText = side==="left"
      ? (leftData ? "Select a book & chapter above" : "Load XML to begin")
      : (rightData ? "Parallel text will appear here" : "Load XML to begin");

    return (
      <div style={{display:"flex",flexDirection:"column",overflow:"hidden",flex:1,
        ...(side==="left" && parallel ? {borderRight:`1px solid ${T.divider}`} : {})}}>
        <div style={{
          padding:"6px 16px", background:T.panelHead,
          borderBottom:`1px solid ${T.divider}`,
          fontSize:11, fontStyle:"italic", color,
          flexShrink:0, letterSpacing:0.5,
          display:"flex", alignItems:"center", gap:8,
        }}>
          <div style={{width:3,height:14,background:color,borderRadius:2,flexShrink:0,opacity:0.8}}/>
          {label}
        </div>
        <div ref={ref} onScroll={onScr} style={{padding:"16px 20px",overflowY:"auto",flex:1,background:T.bg}}>
          {loading ? <Loading T={T}/> : !verses
            ? <Empty icon={emptyIcon} text={emptyText} T={T}/>
            : verses.nums.map((n,i) => (
                <Verse key={n} num={n}
                  text={side==="left" ? (verses.tV[n]||"—") : (verses.nV[n]||"—")}
                  delay={i*10} fontSize={fontSize}
                  highlight={n===verse} T={T}/>
              ))
          }
        </div>
      </div>
    );
  };

  const speedFill = ((speed-1)/9)*100;
  const fontFill  = ((fontSize-10)/18)*100;

  return (
    <div style={{fontFamily:"Georgia,serif",background:T.bg,color:T.text,height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── Main toolbar ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:8, flexWrap:"wrap",
        padding:"8px 14px", background:T.bar,
        borderBottom:`1px solid ${T.barBorder}`, flexShrink:0,
      }}>

        {/* Book */}
        <Label T={T}>Book</Label>
        <select value={book} onChange={e=>{setBook(e.target.value);setChap("");setVerse("");setVerses(null);setAutoOn(false);}}
          disabled={!leftData} style={{...sel,minWidth:140}}>
          <option value="">— Book —</option>
          {books.map(b=><option key={b} value={b}>{b}</option>)}
        </select>

        {/* Chapter */}
        <Label T={T}>Ch</Label>
        <select value={chap} onChange={e=>{setChap(e.target.value);setVerse("");setVerses(null);setAutoOn(false);}}
          disabled={!chapters.length} style={{...sel,minWidth:72}}>
          <option value="">—</option>
          {chapters.map(c=><option key={c} value={c}>{c}</option>)}
        </select>

        {/* Verse */}
        <Label T={T}>Verse</Label>
        <select value={verse} onChange={e=>scrollToVerse(e.target.value)}
          disabled={!verseNums.length} style={{...sel,minWidth:72}}>
          <option value="">—</option>
          {verseNums.map(v=><option key={v} value={v}>{v}</option>)}
        </select>

        {/* Read */}
        <button onClick={read} disabled={!canRead} style={{
          border:"none", fontFamily:"Georgia,serif", fontWeight:"bold", fontSize:12,
          padding:"6px 14px", borderRadius:4, letterSpacing:0.4, cursor: canRead?"pointer":"not-allowed",
          background: canRead ? T.btnActiveBg : T.goldFaint,
          color: canRead ? T.btnActiveText : T.muted,
          transition:"all 0.2s",
        }}>Read ›</button>

        <Div/>

        {/* Translation pills */}
        {leftLabel && (
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Pill T={T} color={T.gold}>{leftLabel}</Pill>
            {parallel && rightLabel && <>
              <span style={{color:T.muted,fontSize:11}}>⟷</span>
              <Pill T={T} color={darkMode?"#8ab4c9":"#4a7a99"}>{rightLabel}</Pill>
            </>}
            {!parallel && rightLabel && activeSide==="right" && (
              <Pill T={T} color={darkMode?"#8ab4c9":"#4a7a99"}>{rightLabel}</Pill>
            )}
          </div>
        )}

        <Div/>

        {/* Parallel / Single */}
        <div style={{display:"flex",gap:3}}>
          <ToggleBtn active={parallel} onClick={()=>setParallel(true)}>⊞ Parallel</ToggleBtn>
          <ToggleBtn active={!parallel} onClick={()=>setParallel(false)}>▭ Single</ToggleBtn>
        </div>

        {/* Status */}
        <div style={{marginLeft:"auto",fontSize:11,color:T.muted,fontStyle:"italic"}}>
          {loading ? "Loading…"
            : loadError ? <span style={{color:"#e07060"}}>⚠ {loadError}</span>
            : leftData ? (verses ? `${book} · Ch.${chap} · ${verses.nums.length} v` : `${books.length} books`) : ""}
        </div>

        {/* Ribbon toggle */}
        <button onClick={()=>setRibbon(p=>!p)} title="More options" style={{
          border:`1px solid ${T.goldBorder}`, background: ribbon ? T.goldFaint : "transparent",
          color:T.gold, borderRadius:4, padding:"5px 10px", cursor:"pointer",
          fontSize:13, fontFamily:"Georgia,serif", transition:"all 0.2s",
        }}>☰{ribbon?" ▲":" ▼"}</button>
      </div>

      {/* ── Ribbon ── */}
      {ribbon && (
        <div style={{
          display:"flex", flexWrap:"wrap", alignItems:"center", gap:14,
          padding:"10px 16px", background:T.ribbon,
          borderBottom:`1px solid ${T.barBorder}`, flexShrink:0,
        }}>

          {/* Auto-scroll */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <RibbonLabel T={T}>Scroll</RibbonLabel>
            <button onClick={()=>verses && setAutoOn(p=>!p)} style={{
              width:28, height:28, borderRadius:"50%", border:"none", flexShrink:0,
              background: autoOn ? T.btnActiveBg : T.goldFaint,
              color: autoOn ? T.btnActiveText : (verses?T.gold:T.muted),
              cursor: verses?"pointer":"not-allowed",
              fontSize:11, transition:"all 0.2s",
              boxShadow: autoOn ? `0 0 10px ${T.hlBorder}` : "none",
            }}>{autoOn?"⏸":"▶"}</button>
            <span style={{fontSize:9,color:T.gold,opacity:0.7,width:36,textAlign:"center"}}>
              {SPD[speed]||""}
            </span>
            <RangeSlider value={speed} min={1} max={10} fill={speedFill} width={100}
              onChange={setSpeed} T={T}/>
            <span style={{fontSize:11,color:T.gold,fontWeight:"bold",width:14}}>{speed}</span>
            {autoOn && <Blink T={T}/>}
          </div>

          <div style={{width:1,alignSelf:"stretch",background:T.divider}}/>

          {/* Font size */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <RibbonLabel T={T}>Font</RibbonLabel>
            <span style={{fontSize:10,color:T.muted}}>A</span>
            <RangeSlider value={fontSize} min={10} max={28} fill={fontFill} width={90}
              onChange={setFontSize} T={T}/>
            <span style={{fontSize:14,color:T.gold}}>A</span>
            <span style={{fontSize:11,color:T.gold,fontWeight:"bold",width:18}}>{fontSize}</span>
          </div>

          <div style={{width:1,alignSelf:"stretch",background:T.divider}}/>

          {/* Dark / Bright */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <RibbonLabel T={T}>Theme</RibbonLabel>
            <div style={{display:"flex",gap:3}}>
              <ToggleBtn active={darkMode} onClick={()=>setDarkMode(true)}>🌙 Dark</ToggleBtn>
              <ToggleBtn active={!darkMode} onClick={()=>setDarkMode(false)}>☀️ Bright</ToggleBtn>
            </div>
          </div>

          <div style={{width:1,alignSelf:"stretch",background:T.divider}}/>

          {/* Sources */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <RibbonLabel T={T}>Sources</RibbonLabel>
            <button onClick={()=>setShowSrc(p=>!p)} style={{
              border:`1px solid ${T.goldBorder}`, background: showSrc ? T.goldFaint : "transparent",
              color:T.gold, borderRadius:4, padding:"4px 10px", cursor:"pointer",
              fontSize:11, fontFamily:"Georgia,serif",
            }}>⚙ {showSrc?"▲":"▼"}</button>
          </div>
        </div>
      )}

      {/* ── Source editor ── */}
      {showSrc && ribbon && (
        <div style={{
          display:"flex", flexWrap:"wrap", gap:10, alignItems:"flex-end",
          padding:"10px 16px", background:T.ribbon,
          borderBottom:`1px solid ${T.barBorder}`, flexShrink:0,
        }}>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <span style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:T.gold,opacity:0.75}}>
              Left Panel{leftLabel ? " — "+leftLabel : ""}
            </span>
            <input value={leftUrl} onChange={e=>setLeftUrl(e.target.value)} style={inp} placeholder="Paste raw XML URL…"/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <span style={{fontSize:8,letterSpacing:3,textTransform:"uppercase",color:T.gold,opacity:0.75}}>
              Right Panel{rightLabel ? " — "+rightLabel : ""}
            </span>
            <input value={rightUrl} onChange={e=>setRightUrl(e.target.value)} style={inp} placeholder="Paste raw XML URL…"/>
          </div>
          <button onClick={()=>fetchBibles(leftUrl,rightUrl)} style={{
            border:"none", fontFamily:"Georgia,serif", fontWeight:"bold", fontSize:12,
            padding:"7px 16px", borderRadius:4, cursor:"pointer",
            background:T.btnActiveBg, color:T.btnActiveText,
          }}>{loading?"Loading…":"Load XMLs"}</button>
          <button onClick={()=>fetchBibles(DEFAULT_LEFT,DEFAULT_RIGHT)} style={{
            border:`1px solid ${T.goldBorder}`, fontFamily:"Georgia,serif",
            fontWeight:"bold", fontSize:11, padding:"7px 12px", borderRadius:4,
            cursor:"pointer", background:T.goldFaint, color:T.gold,
          }}>↺ Reset</button>
        </div>
      )}

      {/* ── Single-view side switcher ── */}
      {!parallel && verses && (
        <div style={{display:"flex",background:T.ribbon,borderBottom:`1px solid ${T.barBorder}`,flexShrink:0}}>
          {(["left","right"] as Side[]).map(side=>{
            const lbl = side==="left"?(leftLabel||"Left Bible"):(rightLabel||"Right Bible");
            const c   = side==="left"?T.gold:(darkMode?"#8ab4c9":"#4a7a99");
            const active = activeSide===side;
            return (
              <button key={side} onClick={()=>setActiveSide(side)} style={{
                flex:1, padding:"7px 0", border:"none",
                fontFamily:"Georgia,serif", fontSize:11, fontStyle:"italic",
                letterSpacing:0.5, cursor:"pointer", transition:"all 0.2s",
                background: active ? T.goldFaint : "transparent",
                color: active ? c : T.muted,
                borderBottom: active ? `2px solid ${c}` : `2px solid transparent`,
              }}>{lbl}</button>
            );
          })}
        </div>
      )}

      {/* ── Reading panels ── */}
      {parallel ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",flex:1,overflow:"hidden",minHeight:0}}>
          {panelContent("left")}
          {panelContent("right")}
        </div>
      ) : (
        <div style={{display:"flex",flex:1,overflow:"hidden",minHeight:0}}>
          {panelContent(activeSide)}
        </div>
      )}

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none;width:13px;height:13px;border-radius:50%;
          background:radial-gradient(circle,#e8d070,#c9a84c);
          box-shadow:0 0 6px rgba(201,168,76,0.5);cursor:pointer;border:none;
        }
        input[type=range]::-moz-range-thumb{
          width:13px;height:13px;border-radius:50%;background:#c9a84c;cursor:pointer;border:none;
        }
      `}</style>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function Label({ T, children }: { T: Theme; children: React.ReactNode }) {
  return <span style={{fontSize:9,letterSpacing:2,textTransform:"uppercase",color:T.gold,opacity:0.7,whiteSpace:"nowrap"}}>{children}</span>;
}

function RibbonLabel({ T, children }: { T: Theme; children: React.ReactNode }) {
  return <span style={{fontSize:8,letterSpacing:2.5,textTransform:"uppercase",color:T.gold,opacity:0.65,whiteSpace:"nowrap"}}>{children}</span>;
}

function Pill({ T, color, children }: { T: Theme; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize:10, padding:"2px 8px", borderRadius:10,
      background:T.goldFaint, color, border:`1px solid ${T.goldBorder}`,
      fontStyle:"italic", letterSpacing:0.3, whiteSpace:"nowrap",
      maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block",
    }}>{children}</span>
  );
}

function Blink({ T }: { T: Theme }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:T.gold,display:"inline-block",animation:"blink 0.9s infinite"}}/>
      <span style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:T.gold}}>scrolling</span>
    </div>
  );
}

function RangeSlider({ value, min, max, fill, width, onChange, T }: {
  value: number; min: number; max: number; fill: number;
  width: number; onChange: (v:number)=>void; T: Theme;
}) {
  const steps = 10;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:2,width}}>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{
          width:"100%", cursor:"pointer", height:4,
          accentColor:T.gold, outline:"none",
          WebkitAppearance:"none", appearance:"none",
          background:`linear-gradient(to right,${T.gold} ${fill}%,${T.trackEmpty} ${fill}%)`,
          borderRadius:4, border:"none",
        }}/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {Array.from({length:steps},(_,i)=>{
          const n = min + Math.round((i/(steps-1))*(max-min));
          const active = value >= n;
          const curr   = value === n;
          return <div key={i} style={{width:1.5,height:curr?7:3,background:active?T.gold:T.trackEmpty,borderRadius:1,transition:"height 0.1s"}}/>;
        })}
      </div>
    </div>
  );
}

function Verse({ num, text, delay, fontSize, highlight, T }: {
  num: string; text: string; delay: number; fontSize: number; highlight: boolean; T: Theme;
}) {
  return (
    <div data-vnum={num} style={{
      display:"flex", gap:12, marginBottom:14,
      animation:`fadeUp 0.3s ease ${delay}ms both`,
      background: highlight ? T.hlBg : "transparent",
      borderLeft: `2px solid ${highlight ? T.hlBorder : "transparent"}`,
      paddingLeft:6, borderRadius:4, transition:"background 0.3s",
    }}>
      <div style={{fontSize:Math.max(9,fontSize-4),color:T.gold,minWidth:22,paddingTop:3,textAlign:"right",flexShrink:0,opacity:0.7,fontWeight:"bold"}}>{num}</div>
      <div style={{fontSize,lineHeight:1.9,color:T.verse,fontFamily:"Georgia,serif"}}>{text}</div>
    </div>
  );
}

function Empty({ icon, text, T }: { icon: string; text: string; T: Theme }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:12,padding:"40px 24px",textAlign:"center"}}>
      <div style={{fontSize:28,opacity:0.12}}>{icon}</div>
      <div style={{color:T.muted,fontStyle:"italic",fontSize:13,maxWidth:200}}>{text}</div>
    </div>
  );
}

function Loading({ T }: { T: Theme }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:14}}>
      <div style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${T.spinBorder}`,borderTopColor:T.gold,animation:"spin 0.8s linear infinite"}}/>
      <div style={{color:T.muted,fontSize:12,fontStyle:"italic"}}>Loading from GitHub…</div>
    </div>
  );
}
