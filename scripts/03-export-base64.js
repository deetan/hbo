/* STEP 3: build catalog.json (friendly schema) and export via the clipboard as BASE64.
   WHY base64: pbpaste mangles non-ASCII (legacy encoding) -> invalid UTF-8. base64 is pure ASCII.
   WHY clipboard: javascript_tool RETURNS are tiny, and the site blocks programmatic downloads.
   Run after STEP 2 finishes. Injects a big button; CLICK IT WITH THE REAL `computer` tool
   (a synthetic .click() won't grant clipboard-write — needs a trusted user gesture) at the
   returned {x,y}. Then on the host:  pbpaste | python3 -c 'import base64,sys;sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > site/catalog.json
   (or:  pbpaste > /tmp/cat.b64 && base64 -D -i /tmp/cat.b64 -o site/catalog.json ). */
(()=>{
  let S=window.__S; if(!S||!S.t){try{S=JSON.parse(localStorage.getItem('hbocat_v1'));}catch(e){}}
  if(!S||!S.t) return 'NO-STATE';
  const titles=Object.values(S.t).filter(t=>!/\bB?ASL\b/.test(t.n||'')).map(t=>{const g=t.g||[];return { // drop "(with ASL)"/"(with BASL)" sign-language dupes
    id:t.i, type:t.r==='movie'?'movie':'series', title:t.n, original:t.o||'', desc:t.d||'',
    year:t.y?+t.y:null, rating:t.rt||'', genres:g, cover:t.c||'', audio:t.a||[], subs:t.s||[],
    seasons:t.se||0, episodes:t.ep||0,
    kids: !!(t.k || t.fm || g.includes('kids-family') || g.includes('family')),
    url:'https://play.hbomax.com/'+t.r+'/'+t.i
  };});
  const exp={generated:new Date().toISOString().slice(0,10), region:'Serbia / HBO Max Adria', count:titles.length, titles};
  window.__EXP=JSON.stringify(exp);
  window.__B64=btoa(unescape(encodeURIComponent(window.__EXP)));
  document.getElementById('__cpBtn')?.remove();
  const b=document.createElement('button'); b.id='__cpBtn'; b.textContent='COPY base64';
  b.style.cssText='position:fixed;top:140px;left:40px;z-index:2147483647;width:300px;height:90px;font-size:22px;font-weight:bold;background:#2563eb;color:#fff;border:3px solid #07153a;border-radius:14px;cursor:pointer;';
  b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(window.__B64);b.textContent='COPIED b64 ✓ '+window.__B64.length;b.style.background='#15803d';}catch(e){b.textContent='ERR:'+e.name;b.style.background='#b91c1c';}});
  document.body.appendChild(b); const r=b.getBoundingClientRect();
  return {ready:true, titles:titles.length, jsonBytes:window.__EXP.length, b64len:window.__B64.length, buttonAt:{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}};
})()
