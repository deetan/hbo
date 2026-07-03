/* STEP 2: per-title sweep — FULL audio + subtitle language lists + seasons/episodes.
   Source: GET /cms/routes/{movie|show}/{id} (~225KB each). RESUMABLE + fire-and-forget:
   reads/writes localStorage['hbocat_v1'], saves every 40 titles, only fetches titles lacking .ld.
   Run AFTER step 1. ~2400 titles @ conc 8 -> ~2-4 min. Poll with 02b-progress.js.
   If the tab is reloaded/navigated mid-run, just re-run STEP 1 (loads state) then this — it resumes. */
(()=>{
  const KEY='hbocat_v1';
  let S=window.__S; if(!S||!S.t){try{S=JSON.parse(localStorage.getItem(KEY));window.__S=S;}catch(e){return 'no-state';}}
  if(!S||!S.t)return 'no-state (run step 1 first)';
  if(window.__hbRunning)return 'already-running';
  const O='https://default.any-emea.prd.api.hbomax.com';
  const P='include=default&decorators=viewingHistory,isFavorite,contentAction,badges';
  const undone=Object.values(S.t).filter(t=>!t.ld);
  window.__hbRunning=true;window.__hbErr=0;window.__hbThrottle=false;window.__hbDone=false;window.__hbQuota=null;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){window.__hbQuota=e.name;}};
  let sinceSave=0;
  const pmap=async(arr,n,fn)=>{let i=0;const w=Array.from({length:n},async()=>{while(i<arr.length){const k=i++;await fn(arr[k]);}});await Promise.all(w);};
  (async()=>{
    await pmap(undone,8,async(t)=>{
      if(window.__hbThrottle)return;
      try{
        const r=await fetch(`${O}/cms/routes/${t.r}/${t.i}?${P}`,{credentials:'include'});
        if(r.status===429||r.status===403){window.__hbThrottle=true;return;}
        if(r.status!==200){t.ld=1;t.e='h'+r.status;window.__hbErr++;return;}
        const j=await r.json();const inc=j.included||[];const edits=inc.filter(it=>it.type==='edit');
        let audio=[],subs=[];
        if(t.r==='movie'){const fe=edits.sort((a,b)=>(b.attributes.duration||0)-(a.attributes.duration||0))[0];if(fe){audio=fe.attributes.audioTracks||[];subs=fe.attributes.subtitles||[];}}
        else{audio=[...new Set(edits.flatMap(e=>e.attributes.audioTracks||[]))];subs=[...new Set(edits.flatMap(e=>e.attributes.subtitles||[]))];}
        t.a=audio;t.s=subs;
        const se=inc.filter(it=>it.type==='season').length;if(se)t.se=se;
        const ep=inc.filter(it=>it.type==='video').length;if(ep)t.ep=ep;
        t.ld=1;
        if(++sinceSave>=40){sinceSave=0;save();}
      }catch(e){/* leave undone for a retry pass */}
    });
    save();window.__hbRunning=false;window.__hbDone=true;
  })();
  return {launched:true, undone:undone.length, conc:8};
})()
