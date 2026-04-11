import {useState,useEffect,useCallback,useMemo} from"react";
const SU="https://yexcqacvypwgeknikkhi.supabase.co";
const SK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlleGNxYWN2eXB3Z2Vrbmlra2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTc2NjUsImV4cCI6MjA5MTMzMzY2NX0.2WlHw4V7YNW6TKCU-gvrC_TZV_QwMvqsMGyj8KtSRcI";
async function fb(o={}){const{sport,minEdge=0,limit=100}=o;let u=`${SU}/rest/v1/markets?select=*&order=edge_gap.desc&limit=${limit}`;if(minEdge>0)u+=`&edge_gap=gte.${minEdge}`;const r=await fetch(u,{headers:{apikey:SK,Authorization:`Bearer ${SK}`}});return r.json();}

function detectSport(q){
  q=(q||'').toLowerCase();
  if(/\bnba\b|basketball|nba finals|nba champion|celtics|lakers|warriors|knicks|nets|bucks|pistons|cavaliers|thunder|spurs|nuggets|rockets|heat|76ers|raptors|hawks|bulls|hornets|pacers|magic|clippers|grizzlies|pelicans|timberwolves|suns|blazers|kings|wizards|mavericks/.test(q))return'nba';
  if(/\bnhl\b|stanley cup|hockey|bruins|rangers|maple leafs|canadiens|penguins|flyers|capitals|hurricanes|panthers|lightning|oilers|flames|canucks|sharks|kraken|avalanche|stars|predators|blues|blackhawks|red wings|sabres|senators|islanders|devils|blue jackets|jets|wild|golden knights|ducks/.test(q))return'nhl';
  if(/\bmlb\b|baseball|world series|yankees|dodgers|astros|braves|mets|phillies|padres|cubs|cardinals|brewers|orioles|rays|red sox|guardians|twins|rangers|mariners|angels|athletics|reds|pirates|rockies|marlins|diamondbacks|royals|tigers|white sox|nationals|giants/.test(q))return'mlb';
  if(/\bufc\b|\bmma\b|boxing|ufc \d|fighter|knockout|submission|prochazka|ulberg|makhachev/.test(q))return'ufc';
  if(/\bnfl\b|super bowl|football|chiefs|eagles|49ers|cowboys|bills|ravens|lions|bengals|dolphins|jets|steelers|packers|bears|rams|chargers|seahawks|saints|vikings|commanders|jaguars|broncos|texans|colts|browns|titans|cardinals|falcons|panthers|buccaneers|raiders/.test(q))return'nfl';
  if(/soccer|premier league|champions league|la liga|serie a|bundesliga|mls|fifa|world cup|arsenal|liverpool|chelsea|manchester|barcelona|real madrid|bayern|juventus|inter milan|psg/.test(q))return'soccer';
  if(/president|election|congress|senate|democrat|republican|trump|biden|governor|political|fed chair|fed decision|recession|tariff|impeach|midterm|nominee/.test(q))return'politics';
  if(/golf|masters|pga|ryder cup|mcilroy|scheffler/.test(q))return'golf';
  return'other';
}

const PC={Polymarket:"#6366f1",Kalshi:"#06b6d4",DraftKings:"#22c55e",FanDuel:"#f59e0b"};
const SP=[{key:"all",label:"All",icon:"◎"},{key:"nba",label:"NBA",icon:"🏀"},{key:"nhl",label:"NHL",icon:"🏒"},{key:"mlb",label:"MLB",icon:"⚾"},{key:"ufc",label:"UFC",icon:"🥊"},{key:"nfl",label:"NFL",icon:"🏈"},{key:"soccer",label:"Soccer",icon:"⚽"},{key:"politics",label:"Politics",icon:"🏛"},{key:"golf",label:"Golf",icon:"⛳"},{key:"other",label:"Other",icon:"📊"}];
const E={s:8,m:5,w:3};
const ec=g=>g>=E.s?"strong":g>=E.m?"moderate":g>=E.w?"weak":"none";
const el=e=>e==="strong"?"STRONG EDGE":e==="moderate"?"GOOD EDGE":e==="weak"?"SLIGHT EDGE":"NO EDGE";
const C={bg:"#08080c",sf:"#101016",sf2:"#16161e",bd:"#1c1c28",tx:"#e4e2dd",tm:"#6b6a72",td:"#3a3a44",g:"#00e676",gd:"rgba(0,230,118,0.08)",gb:"rgba(0,230,118,0.2)",a:"#ffab00",ad:"rgba(255,171,0,0.08)",ab:"rgba(255,171,0,0.2)",b:"#448aff",b2:"rgba(68,138,255,0.08)",bb:"rgba(68,138,255,0.2)"};
const eC=e=>e==="strong"?C.g:e==="moderate"?C.a:e==="weak"?C.b:C.td;
const eBg=e=>e==="strong"?C.gd:e==="moderate"?C.ad:e==="weak"?C.b2:"transparent";
const eBd=e=>e==="strong"?C.gb:e==="moderate"?C.ab:e==="weak"?C.bb:C.bd;

export default function App(){
  const[markets,setM]=useState([]);const[sport,setS]=useState("all");const[exp,setExp]=useState(null);const[eo,setEo]=useState(false);const[loading,setL]=useState(true);const[ls,setLs]=useState(null);
  const load=useCallback(async()=>{setL(true);try{const d=await fb({minEdge:eo?E.w:0});const enriched=d.map(m=>({...m,detectedSport:detectSport(m.question)}));setM(enriched);if(d.length>0&&d[0].scanned_at)setLs(new Date(d[0].scanned_at));}catch(e){console.error(e);}setL(false);},[eo]);
  useEffect(()=>{load();},[load]);useEffect(()=>{const i=setInterval(load,60000);return()=>clearInterval(i);},[load]);
  const filtered=useMemo(()=>sport==="all"?markets:markets.filter(m=>m.detectedSport===sport),[markets,sport]);
  const st=useMemo(()=>({t:filtered.length,s:filtered.filter(m=>m.edge_gap>=E.s).length,e:filtered.filter(m=>m.edge_gap>=E.w).length}),[filtered]);
  const since=d=>{if(!d)return"";const s=Math.floor((new Date()-d)/1000);return s<60?s+"s ago":s<3600?Math.floor(s/60)+"m ago":Math.floor(s/3600)+"h ago";};

  return(<div style={{minHeight:"100vh",background:C.bg,color:C.tx,fontFamily:"'DM Mono',monospace",maxWidth:480,margin:"0 auto"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:#08080c}@keyframes spin{to{transform:rotate(360deg)}}@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fu .35s ease forwards}`}</style>

    <div style={{padding:"18px 16px 12px",borderBottom:`1px solid ${C.bd}`,background:C.sf,position:"sticky",top:0,zIndex:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:C.g,boxShadow:`0 0 8px ${C.g}`}}/><h1 style={{fontSize:18,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Edge Scanner</h1><span style={{fontSize:8,color:C.g,padding:"2px 6px",border:`1px solid ${C.gb}`,borderRadius:4,background:C.gd}}>LIVE</span></div>
        <p style={{fontSize:9,color:C.td,letterSpacing:"1.5px",marginTop:4,marginLeft:16}}>{ls?`UPDATED ${since(ls).toUpperCase()}`:"CONNECTING..."}</p></div>
        <button onClick={load} style={{background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,padding:"8px 14px",color:C.g,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>↻ Refresh</button></div>
      <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:2}}>{SP.map(s=><button key={s.key} onClick={()=>setS(s.key)} style={{padding:"4px 10px",borderRadius:16,fontSize:9,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Mono',monospace",border:sport===s.key?`1px solid ${C.g}`:`1px solid ${C.bd}`,background:sport===s.key?C.gd:"transparent",color:sport===s.key?C.g:C.td}}>{s.icon} {s.label}</button>)}</div></div>

    <div style={{display:"flex",gap:6,padding:"10px 16px"}}>{[["MARKETS",st.t,C.bd,null],["STRONG",st.s,C.gb,C.g],["EDGES",st.e,C.ab,C.a]].map(([l,v,b,c])=><div key={l} style={{flex:1,background:C.sf,borderRadius:8,padding:"8px 0",textAlign:"center",border:`1px solid ${b}`}}><div style={{fontSize:7,color:C.td,letterSpacing:"1px"}}>{l}</div><div style={{fontSize:18,fontWeight:700,fontFamily:"'DM Sans',sans-serif",color:v>0&&c?c:C.td,marginTop:2}}>{v}</div></div>)}</div>

    <div style={{padding:"0 16px 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:9,color:C.td}}>{filtered.length} RESULTS</span><button onClick={()=>setEo(!eo)} style={{padding:"3px 10px",borderRadius:10,fontSize:8,fontWeight:600,cursor:"pointer",fontFamily:"'DM Mono',monospace",border:eo?`1px solid ${C.g}`:`1px solid ${C.bd}`,background:eo?C.gd:"transparent",color:eo?C.g:C.td}}>{eo?"● EDGES ONLY":"○ ALL MARKETS"}</button></div>

    {loading&&markets.length===0&&<div style={{textAlign:"center",padding:"40px 16px"}}><div style={{width:24,height:24,border:`2px solid ${C.bd}`,borderTopColor:C.g,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px"}}/><div style={{fontSize:11,color:C.tm}}>Loading live markets...</div></div>}

    <div style={{padding:"0 16px 100px"}}>{filtered.map((m,i)=>{const e=ec(m.edge_gap||0),ex=exp===m.market_id,p=m.prices||{};const si=SP.find(s=>s.key===m.detectedSport)?.icon||"📊";
      let tA=m.team_a||"",tB=m.team_b||"",q=m.question||"";
      if(!tA||tA==="Yes"||tA==="["){if(q)tA=q.length>55?q.slice(0,52)+"...":q;tB="";}

      return(<div key={m.market_id} className="fu" style={{background:C.sf,border:`1px solid ${eBd(e)}`,borderRadius:10,marginBottom:8,overflow:"hidden",animationDelay:`${i*.03}s`}}>
        <div onClick={()=>setExp(ex?null:m.market_id)} style={{padding:"12px 14px",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:11}}>{si}</span><span style={{fontSize:8,color:C.td}}>{(m.detectedSport||'other').toUpperCase()}</span>{m.edge_gap>0&&<span style={{fontSize:13,fontWeight:700,color:eC(e),marginLeft:"auto",fontFamily:"'DM Sans',sans-serif"}}>+{m.edge_gap}¢</span>}<span style={{fontSize:7,fontWeight:700,letterSpacing:".8px",padding:"2px 8px",borderRadius:8,background:eBg(e),color:eC(e),border:`1px solid ${eBd(e)}`,...(m.edge_gap===0&&{marginLeft:"auto"})}}>{el(e)}</span></div>

          {tB&&tB!=="No"&&tB!==""?<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",color:m.edge_side==="A"?C.g:C.tx}}>{m.edge_side==="A"&&<span style={{marginRight:4}}>▸</span>}{tA}</div>
            <div style={{fontSize:8,color:C.td,padding:"0 8px"}}>vs</div>
            <div style={{fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",color:m.edge_side==="B"?C.g:C.tx,textAlign:"right"}}>{tB}{m.edge_side==="B"&&<span style={{marginLeft:4}}>◂</span>}</div>
          </div>:<div style={{fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",marginBottom:10,lineHeight:1.4}}>{tA}</div>}

          <div style={{display:"flex",gap:4}}>{Object.entries(p).map(([k,a])=>{if(!a||!Array.isArray(a))return null;const c=PC[k]||"#888";return<div key={k} style={{flex:1,background:C.sf2,borderRadius:5,padding:"5px 4px",textAlign:"center",borderBottom:`2px solid ${c}30`}}><div style={{fontSize:6,color:c,letterSpacing:".5px",marginBottom:2,fontWeight:600}}>{k.slice(0,4).toUpperCase()}</div><div style={{fontSize:10,fontWeight:600}}>{a[0]}¢ / {a[1]}¢</div></div>})}</div>
          {!ex&&<div style={{textAlign:"center",marginTop:6}}><span style={{fontSize:7,color:C.td}}>tap to expand</span></div>}
        </div>

        {ex&&<div style={{borderTop:`1px solid ${C.bd}`,padding:"12px 14px"}}>
          {e!=="none"&&m.bet_team&&<div style={{background:eBg(e),border:`1px solid ${eBd(e)}`,borderRadius:8,padding:"10px 12px",marginBottom:12}}><div style={{fontSize:7,color:eC(e),letterSpacing:"1px",marginBottom:3}}>RECOMMENDED</div><div style={{fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>{m.bet_team} at {m.poly_price}¢ on Polymarket</div><div style={{fontSize:9,color:C.tm,marginTop:4}}>{m.edge_platform} has this at {m.book_price}% — {m.edge_gap}¢ gap</div></div>}
          <div style={{marginBottom:12}}><div style={{fontSize:8,color:C.td,letterSpacing:"1px",marginBottom:6}}>PROBABILITY</div>
          {Object.entries(p).map(([k,a])=>{if(!a||!Array.isArray(a))return null;const c=PC[k]||"#888";return<div key={k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><div style={{width:40,fontSize:7,color:c,fontWeight:600,textAlign:"right"}}>{k.slice(0,5)}</div><div style={{flex:1,height:14,background:C.sf2,borderRadius:3,overflow:"hidden"}}><div style={{width:`${a[0]}%`,height:"100%",background:`${c}88`,borderRadius:3}}/></div><div style={{width:30,fontSize:10,fontWeight:600,textAlign:"right"}}>{a[0]}%</div></div>})}</div>
          {q&&<div style={{fontSize:9,color:C.tm,lineHeight:1.5,fontStyle:"italic"}}>{q}</div>}
        </div>}
      </div>);})}

      {!loading&&filtered.length===0&&<div style={{textAlign:"center",padding:"40px"}}><div style={{fontSize:24,marginBottom:8}}>📊</div><div style={{fontSize:12,color:C.tm}}>No markets found</div></div>}
      <div style={{textAlign:"center",marginTop:20}}><span style={{fontSize:8,color:C.td,letterSpacing:"2px"}}>EDGE SCANNER v3.0 — LIVE</span></div>
    </div></div>);
}
