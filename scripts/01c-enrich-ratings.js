/* STEP 1c: enrich each title with its AGE/MATURITY rating (HBO's only "rating" — no IMDb/popularity).
   Cheap: the A-Z collection LISTING already includes contentRating resources + each show's `ratings`
   relationship, so this re-walks the ~107 light collection pages (no 540MB detail re-sweep).
   Run AFTER step 1 (and any time; it only adds t.rt). Writes localStorage['hbocat_v1']. ~15s.
   Codes seen (Adria system): AL, 6, 9, 12, 14, 16, 18.
   NB: popularity is NOT exposed per-title by the API (only ~10-item Top-10 rails, whose items don't
   resolve to shows via the collection endpoint) — so the catalogue defaults to newest-first instead. */
(async () => {
  const O='https://default.any-emea.prd.api.hbomax.com';
  const P='include=default&decorators=viewingHistory,isFavorite,contentAction,badges';
  const f=u=>fetch(u,{credentials:'include'}).then(r=>r.json());
  const pmap=async(arr,n,fn)=>{let i=0;const w=Array.from({length:n},async()=>{while(i<arr.length){const k=i++;try{await fn(arr[k]);}catch(e){}}});await Promise.all(w);};
  const S=window.__S||JSON.parse(localStorage.getItem('hbocat_v1')); window.__S=S;
  function applyRatings(cj){
    const crMap={}; (cj.included||[]).forEach(it=>{if(it.type==='contentRating')crMap[it.id]=it.attributes?.code||'';});
    (cj.included||[]).forEach(it=>{ if(it.type==='show'){ const t=S.t[it.id]; if(t){ const ids=(it.relationships?.ratings?.data||[]).map(d=>d.id); for(const id of ids){ if(crMap[id]){ t.rt=crMap[id]; break; } } } }});
  }
  for(const page of ['movies','series']){
    const j=await f(`${O}/cms/routes/${page}?${P}`);
    const az=(j.included||[]).filter(it=>it.type==='collection'&&/-a-z$/.test(it.attributes?.alias||'')).map(it=>it.id);
    const cols=[];
    await pmap(az,8,async(id)=>{const cj=await f(`${O}/cms/collections/${id}?${P}&page[items.number]=1&page[items.size]=30`); cols.push({id,total:cj.meta?.itemsTotalPages||1}); applyRatings(cj);});
    const jobs=[]; for(const c of cols)for(let pg=2;pg<=c.total;pg++)jobs.push({id:c.id,pg});
    await pmap(jobs,8,async(jb)=>{const cj=await f(`${O}/cms/collections/${jb.id}?${P}&page[items.number]=${jb.pg}&page[items.size]=30`); applyRatings(cj);});
  }
  try{localStorage.setItem('hbocat_v1',JSON.stringify(S));}catch(e){}
  const all=Object.values(S.t); const dist={}; all.forEach(t=>{if(t.rt)dist[t.rt]=(dist[t.rt]||0)+1;});
  return {withRating:all.filter(t=>t.rt).length, total:all.length, distribution:dist};
})()
