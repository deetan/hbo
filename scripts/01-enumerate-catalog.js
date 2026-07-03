/* HBO Max (Adria) — STEP 1: enumerate the FULL catalogue (movies+series) + rich metadata + cover.
   RESUMABLE: stores compact records in localStorage['hbocat_v1'] (survives reload / same-origin nav).
   Run via Claude-in-Chrome javascript_tool on a play.hbomax.com tab, LOGGED IN (cookie auth).
   Re-running is a no-op if already enumerated. Completes in ~15s (< the 45s tool timeout).
   Cover URL field is `src` (confirmed); kind=poster-with-logo, ~2000x3000 portrait; CDN is public. */
(async () => {
  const O='https://default.any-emea.prd.api.hbomax.com';
  const P='include=default&decorators=viewingHistory,isFavorite,contentAction,badges';
  const KEY='hbocat_v1';
  const f=u=>fetch(u,{credentials:'include'}).then(r=>r.json());
  const pmap=async(arr,n,fn)=>{const ret=[];let i=0;const w=Array.from({length:n},async()=>{while(i<arr.length){const k=i++;try{ret[k]=await fn(arr[k]);}catch(e){ret[k]=null;}}});await Promise.all(w);return ret;};
  let S; try{S=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){S=null;}
  if(!S||!S.t){ S={t:{}}; }
  window.__S=S;
  const save=()=>{const str=JSON.stringify(S);try{localStorage.setItem(KEY,str);return str.length;}catch(e){return 'ERR:'+e.name;}};
  window.__save=save;
  if(Object.keys(S.t).length>=2000){ const all=Object.values(S.t); return {resumed:true, titles:all.length, done:all.filter(x=>x.ld).length, bytes:JSON.stringify(S).length}; }
  const pickCover=(show,inc)=>{const ids=(show.relationships?.images?.data||[]).map(d=>d.id);const imgs=inc.filter(it=>it.type==='image'&&ids.includes(it.id));const url=i=>i.attributes?.src||i.attributes?.url||'';const score=i=>{const a=i.attributes||{};const r=(a.width&&a.height)?a.width/a.height:1;return Math.abs(r-0.7);};imgs.sort((a,b)=>score(a)-score(b));return url(imgs[0]||{});};
  const add=(show,inc,genre,route)=>{const a=show.attributes||{};const id=show.id;if(!S.t[id]){S.t[id]={i:id,r:route,ty:a.showType,n:a.name,o:a.originalName||'',d:a.description||'',y:(a.premiereDate||a.firstAvailableDate||'').slice(0,4),g:[],c:pickCover(show,inc)};if(a.isKidsContent)S.t[id].k=1;if(a.isFamilyContent)S.t[id].fm=1;}const t=S.t[id];if(genre&&!t.g.includes(genre))t.g.push(genre);};
  for(const page of ['movies','series']){const route=page==='movies'?'movie':'show';const j=await f(`${O}/cms/routes/${page}?${P}`);const az=(j.included||[]).filter(it=>it.type==='collection'&&/-a-z$/.test(it.attributes?.alias||'')).map(it=>({alias:it.attributes.alias,id:it.id}));const gname=a=>a.replace(/^.*-emea-/,'').replace('-a-z','');const colUrl=(id,pg)=>`${O}/cms/collections/${id}?${P}&page[items.number]=${pg}&page[items.size]=30`;const p1=await pmap(az,8,async(c)=>{const cj=await f(colUrl(c.id,1));(cj.included||[]).filter(it=>it.type==='show').forEach(s=>add(s,cj.included,gname(c.alias),route));return{c,total:cj.meta?.itemsTotalPages||1};});const jobs=[];for(const x of p1){if(!x)continue;for(let pg=2;pg<=x.total;pg++)jobs.push({id:x.c.id,alias:x.c.alias,pg});}await pmap(jobs,8,async(job)=>{const cj=await f(colUrl(job.id,job.pg));(cj.included||[]).filter(it=>it.type==='show').forEach(s=>add(s,cj.included,gname(job.alias),route));});}
  const bytes=save();
  const all=Object.values(S.t);
  return {enumerated:true, titles:all.length, movies:all.filter(t=>t.r==='movie').length, series:all.filter(t=>t.r==='show').length, withCover:all.filter(t=>t.c).length, bytes};
})()
