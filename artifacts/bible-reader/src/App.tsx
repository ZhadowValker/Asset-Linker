import { useState, useRef, useEffect } from "react";

const DEFAULT_LEFT  = "https://raw.githubusercontent.com/sajeevavahini/bibles/main/Telugu%20Bible%20(BSI).xml";
const DEFAULT_RIGHT = "https://raw.githubusercontent.com/sajeevavahini/bibles/main/New%20International%20Version%20(UK).xml";
const PROXY = "/api/proxy?url=";

type Books = Record<string, Record<string, Record<string, string>>>;

const BOOK_NAMES: Record<number, string> = {
  1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy",
  6:"Joshua",7:"Judges",8:"Ruth",9:"1 Samuel",10:"2 Samuel",
  11:"1 Kings",12:"2 Kings",13:"1 Chronicles",14:"2 Chronicles",
  15:"Ezra",16:"Nehemiah",17:"Esther",18:"Job",19:"Psalms",
  20:"Proverbs",21:"Ecclesiastes",22:"Song of Solomon",23:"Isaiah",
  24:"Jeremiah",25:"Lamentations",26:"Ezekiel",27:"Daniel",
  28:"Hosea",29:"Joel",30:"Amos",31:"Obadiah",32:"Jonah",
  33:"Micah",34:"Nahum",35:"Habakkuk",36:"Zephaniah",37:"Haggai",
  38:"Zechariah",39:"Malachi",
  40:"Matthew",41:"Mark",42:"Luke",43:"John",44:"Acts",
  45:"Romans",46:"1 Corinthians",47:"2 Corinthians",48:"Galatians",
  49:"Ephesians",50:"Philippians",51:"Colossians",52:"1 Thessalonians",
  53:"2 Thessalonians",54:"1 Timothy",55:"2 Timothy",56:"Titus",
  57:"Philemon",58:"Hebrews",59:"James",60:"1 Peter",61:"2 Peter",
  62:"1 John",63:"2 John",64:"3 John",65:"Jude",66:"Revelation",
};

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
      const num = parseInt(b.getAttribute("number") ?? "0", 10);
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
  const [verse,  setVerse]  = useState("");
  const [verses, setVerses] = useState<{ tV: Record<string,string>; nV: Record<string,string>; nums: string[] } | null>(null);

  const [autoOn,     setAutoOn]     = useState(false);
  const [speed,      setSpeed]      = useState(2);
  const [fontSize,   setFontSize]   = useState(15);
  const [parallel,   setParallel]   = useState(true);
  const [activeSide, setActiveSide] = useState<"left"|"right">("left");

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
  const verseNums = verses ? verses.nums : [];
  const canRead  = !!(book && chap);

  async function fetchBibles(lUrl: string, rUrl: string) {
    setLoading(true);
    setLoadError("");
    setLeftData(null); setRightData(null);
    setBook(""); setChap(""); setVerse(""); setVerses(null); setAutoOn(false);
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
    setVerse("");
    setAutoOn(false);
    setTimeout(()=>{
      if (leftRef.current)  leftRef.current.scrollTop  = 0;
      if (rightRef.current) rightRef.current.scrollTop = 0;
    }, 60);
  }

  function scrollToVerse(vNum: string) {
    setVerse(vNum);
    if (!vNum) return;
    const scrollToEl = (container: HTMLDivElement | null) => {
      if (!container) return;
      const el = container.querySelector(`[data-vnum="${vNum}"]`) as HTMLElement | null;
      if (el) container.scrollTop = el.offsetTop - 16;
    };
    setTimeout(() => {
      scrollToEl(leftRef.current);
      scrollToEl(rightRef.current);
    }, 30);
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

  const speedFill = ((speed - 1) / 9) * 100;
  const fontFill  = ((fontSize - 10) / 18) * 100;

  const panelContent = (side: "left" | "right") => {
    const ref = side === "left" ? leftRef : rightRef;
    const onScroll = side === "left" ? onLeftScroll : onRightScroll;
    const label = side === "left" ? (leftLabel || "Left Bible") : (rightLabel || "Right Bible");
    const color = side === "left" ? "#c9a84c" : "#8ab4c9";
    const emptyIcon = side === "left" ? "📖" : "✝";
    const emptyText = side === "left"
      ? (leftData ? "Select a book & chapter above" : "Load XML to begin")
      : (rightData ? "Parallel text will appear here" : "Load XML to begin");

    return (
      <div style={{display:"flex",flexDirection:"column",overflow:"hidden",flex:1,
        ...(side === "left" && parallel ? {borderRight:"1px solid rgba(201,168,76,0.15)"} : {})}}>
        <PanelHead label={label} color={color}/>
        <div ref={ref} onScroll={onScroll} style={S.scroll}>
          {loading
            ? <LoadingState/>
            : !verses
              ? <Empty icon={emptyIcon} text={emptyText}/>
              : verses.nums.map((n,i) => (
                  <Verse key={n} num={n}
                    text={side === "left" ? (verses.tV[n]||"—") : (verses.nV[n]||"—")}
                    delay={i*10} fontSize={fontSize}
                    highlight={n === verse}
                  />
                ))
          }
        </div>
      </div>
    );
  };

  return (
    <div style={{fontFamily:"Georgia,serif",background:"#0e0c09",color:"#d4c5a0",height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* Top Bar */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"7px 14px", background:"#161410",
        borderBottom:"1px solid rgba(201,168,76,0.18)", flexShrink:0, flexWrap:"wrap",
      }}>
        {/* Book */}
        <Ctrl label="Book">
          <select value={book} onChange={e=>{setBook(e.target.value);setChap("");setVerse("");setVerses(null);setAutoOn(false);}} disabled={!leftData} style={S.sel}>
            <option value="">— Book —</option>
            {books.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </Ctrl>

        {/* Chapter */}
        <Ctrl label="Chapter">
          <select value={chap} onChange={e=>{setChap(e.target.value);setVerse("");setVerses(null);setAutoOn(false);}} disabled={!chapters.length} style={{...S.sel,minWidth:90}}>
            <option value="">— Ch —</option>
            {chapters.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </Ctrl>

        {/* Read */}
        <button onClick={read} disabled={!canRead} style={{
          ...S.btn, marginTop:14,
          background: canRead ? "linear-gradient(135deg,#7a5a1a,#c9a84c)" : "#1a1810",
          color:      canRead ? "#0e0c09" : "#3a3828",
          cursor:     canRead ? "pointer"  : "not-allowed",
        }}>Read ›</button>

        {/* Verse jump */}
        <Ctrl label="Verse">
          <select value={verse} onChange={e=>scrollToVerse(e.target.value)}
            disabled={!verseNums.length} style={{...S.sel,minWidth:80}}>
            <option value="">— V —</option>
            {verseNums.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </Ctrl>

        <div style={{width:1,height:28,background:"rgba(201,168,76,0.15)",margin:"14px 4px 0"}}/>

        {/* Auto-scroll */}
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

          <SliderCtrl value={speed} min={1} max={10} fill={speedFill}
            onChange={v=>setSpeed(v)} width={110}/>

          <div style={{fontSize:12,color:"#c9a84c",fontWeight:"bold",width:14}}>{speed}</div>

          {autoOn && (
            <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#c9a84c",display:"flex",alignItems:"center",gap:4}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#c9a84c",display:"inline-block",animation:"blink 0.9s infinite"}}/>
              scrolling
            </div>
          )}
        </div>

        <div style={{width:1,height:28,background:"rgba(201,168,76,0.15)",margin:"14px 4px 0"}}/>

        {/* Font size */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:14}}>
          <div style={{fontSize:8,letterSpacing:2,textTransform:"uppercase",color:"#c9a84c",opacity:0.7,lineHeight:1.2}}>
            Font
          </div>
          <SliderCtrl value={fontSize} min={10} max={28} fill={fontFill}
            onChange={v=>setFontSize(v)} width={90}/>
          <div style={{fontSize:12,color:"#c9a84c",fontWeight:"bold",width:18}}>{fontSize}</div>
        </div>

        <div style={{width:1,height:28,background:"rgba(201,168,76,0.15)",margin:"14px 4px 0"}}/>

        {/* View toggle */}
        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:14}}>
          <button onClick={()=>setParallel(true)} style={{
            ...S.btn, padding:"5px 10px", fontSize:11,
            background: parallel ? "linear-gradient(135deg,#7a5a1a,#c9a84c)" : "rgba(201,168,76,0.08)",
            color: parallel ? "#0e0c09" : "#c9a84c",
            border: parallel ? "none" : "1px solid rgba(201,168,76,0.2)",
            cursor:"pointer",
          }}>⊞ Parallel</button>
          <button onClick={()=>setParallel(false)} style={{
            ...S.btn, padding:"5px 10px", fontSize:11,
            background: !parallel ? "linear-gradient(135deg,#7a5a1a,#c9a84c)" : "rgba(201,168,76,0.08)",
            color: !parallel ? "#0e0c09" : "#c9a84c",
            border: !parallel ? "none" : "1px solid rgba(201,168,76,0.2)",
            cursor:"pointer",
          }}>▭ Single</button>
        </div>

        <div style={{width:1,height:28,background:"rgba(201,168,76,0.15)",margin:"14px 4px 0"}}/>

        {/* Sources */}
        <button onClick={()=>setShowUrls(p=>!p)} style={{
          ...S.btn, marginTop:14, fontSize:11,
          background:"rgba(201,168,76,0.1)",
          border:"1px solid rgba(201,168,76,0.25)",
          color:"#c9a84c", padding:"5px 12px",
        }}>⚙ Sources {showUrls?"▲":"▼"}</button>

        {/* Status */}
        <div style={{marginLeft:"auto",marginTop:14,fontSize:11,color:"#8a7d60",fontStyle:"italic"}}>
          {loading ? "Loading…" : loadError ? <span style={{color:"#e07060"}}>⚠ {loadError}</span>
            : leftData ? (verses ? `${book} · Ch.${chap} · ${verses.nums.length} verses` : `${books.length} books loaded`) : ""}
        </div>
      </div>

      {/* Single view side switcher */}
      {!parallel && verses && (
        <div style={{display:"flex",gap:0,background:"#120f0b",borderBottom:"1px solid rgba(201,168,76,0.15)",flexShrink:0}}>
          {(["left","right"] as const).map(side => (
            <button key={side} onClick={()=>setActiveSide(side)} style={{
              flex:1, padding:"6px 0", border:"none", fontFamily:"Georgia,serif",
              fontSize:11, fontStyle:"italic", letterSpacing:0.5, cursor:"pointer",
              background: activeSide===side ? "rgba(201,168,76,0.12)" : "transparent",
              color: activeSide===side ? (side==="left"?"#c9a84c":"#8ab4c9") : "#5a5040",
              borderBottom: activeSide===side ? `2px solid ${side==="left"?"#c9a84c":"#8ab4c9"}` : "2px solid transparent",
              transition:"all 0.2s",
            }}>
              {side==="left" ? (leftLabel||"Left Bible") : (rightLabel||"Right Bible")}
            </button>
          ))}
        </div>
      )}

      {/* XML Source Editor */}
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
          }}>{loading ? "Loading…" : "Load XMLs"}</button>
          <button onClick={()=>fetchBibles(DEFAULT_LEFT,DEFAULT_RIGHT)} style={{
            ...S.btn, alignSelf:"flex-end",
            background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)",
            color:"#c9a84c", cursor:"pointer", fontSize:11,
          }}>↺ Reset Defaults</button>
        </div>
      )}

      {/* Panels */}
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

function SliderCtrl({ value, min, max, fill, onChange, width }: {
  value: number; min: number; max: number; fill: number;
  onChange: (v: number) => void; width: number;
}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:2,width}}>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{
          width:"100%", cursor:"pointer", height:4,
          accentColor:"#c9a84c", outline:"none",
          WebkitAppearance:"none", appearance:"none",
          background:`linear-gradient(to right,#c9a84c ${fill}%,#252010 ${fill}%)`,
          borderRadius:4, border:"none",
        }}
      />
      <div style={{display:"flex",justifyContent:"space-between"}}>
        {Array.from({length:Math.min(max-min+1,10)},(_,i)=>{
          const step = (max-min)/9;
          const n = Math.round(min + i*step);
          const active = value >= n;
          const curr = Math.abs(value - n) < step/2;
          return <div key={i} style={{width:1.5,height:curr?7:3,background:active?"#c9a84c":"#2a2416",borderRadius:1,transition:"height 0.1s"}}/>;
        })}
      </div>
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

function Verse({ num, text, delay, fontSize, highlight }: {
  num: string; text: string; delay: number; fontSize: number; highlight: boolean;
}) {
  return (
    <div data-vnum={num} style={{
      display:"flex", gap:12, marginBottom:14,
      animation:`fadeUp 0.3s ease ${delay}ms both`,
      background: highlight ? "rgba(201,168,76,0.08)" : "transparent",
      borderRadius:4,
      borderLeft: highlight ? "2px solid rgba(201,168,76,0.5)" : "2px solid transparent",
      paddingLeft: highlight ? 6 : 6,
      transition:"background 0.3s",
    }}>
      <div style={{fontSize:Math.max(9,fontSize-4),color:"#c9a84c",minWidth:22,paddingTop:3,textAlign:"right",flexShrink:0,opacity:0.75,fontWeight:"bold"}}>{num}</div>
      <div style={{fontSize,lineHeight:1.9,color:"#f0e4c8",fontFamily:"Georgia,serif"}}>{text}</div>
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
  sel:{background:"#1a1710",border:"1px solid rgba(201,168,76,0.2)",color:"#f0e4c8",fontFamily:"Georgia,serif",fontSize:13,padding:"5px 9px",borderRadius:3,minWidth:90,outline:"none"} as React.CSSProperties,
  inp:{background:"#1a1710",border:"1px solid rgba(201,168,76,0.2)",color:"#f0e4c8",fontFamily:"Georgia,serif",fontSize:12,padding:"5px 9px",borderRadius:3,outline:"none"} as React.CSSProperties,
  btn:{border:"none",fontFamily:"Georgia,serif",fontWeight:"bold",fontSize:12,padding:"6px 16px",borderRadius:3,letterSpacing:0.4,transition:"all 0.2s"} as React.CSSProperties,
  scroll:{padding:"16px 20px",overflowY:"auto",flex:1} as React.CSSProperties,
};
