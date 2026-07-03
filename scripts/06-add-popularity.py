#!/usr/bin/env python3
"""STEP 6 (host-side): add a real popularity score to each title from TMDb's KEYLESS daily export.
   HBO's API exposes no per-title popularity (Top-10 rails are artwork-only), so we match HBO titles
   against TMDb's public popularity dump — no API key needed.
   Run:  python3 scripts/06-add-popularity.py    (re-downloads the dump if not in /tmp)
   Writes `pop` (float) into every title in site/catalog.json. ~81% match; unmatched -> pop 0.0
   (they fall to the bottom, ordered by recency). For IMDb-style quality scores you'd need the TMDb API."""
import json, gzip, re, os, urllib.request, datetime
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import unicodedata
def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode()
    return re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
def nostrip(s):  # drop parenthetical suffixes: "X (with ASL)" -> "X"
    return norm(re.sub(r"\(.*?\)","",str(s or "")))

def fetch(kind):  # kind: movie_ids | tv_series_ids
    p=f"/tmp/{kind}.json.gz"
    if os.path.exists(p) and os.path.getsize(p)>1000: return p
    for back in range(0,6):
        d=(datetime.date.today()-datetime.timedelta(days=back)).strftime("%m_%d_%Y")
        url=f"http://files.tmdb.org/p/exports/{kind}_{d}.json.gz"
        try:
            urllib.request.urlretrieve(url,p)
            if os.path.getsize(p)>1000: return p
        except Exception: continue
    raise SystemExit(f"could not download {kind} export")

def load(path,key):
    m={}
    with gzip.open(path,"rt",encoding="utf-8") as f:
        for line in f:
            try:o=json.loads(line)
            except:continue
            n=norm(o.get(key,"")); p=o.get("popularity",0) or 0
            if n and p>m.get(n,-1): m[n]=p
    return m

mov=load(fetch("movie_ids"),"original_title")
tv =load(fetch("tv_series_ids"),"original_name")
cat=os.path.join(ROOT,"site/catalog.json")
d=json.load(open(cat)); ts=d["titles"]
def popfor(t):
    prim=mov if t["type"]=="movie" else tv
    sec =tv if t["type"]=="movie" else mov
    cands={norm(t["title"]), nostrip(t["title"])}
    if t.get("original"): cands|={norm(t["original"]), nostrip(t["original"])}
    best=0.0
    for c in cands:
        if c: best=max(best,prim.get(c,0),sec.get(c,0))
    return round(best,1)
for t in ts: t["pop"]=popfor(t)
json.dump(d,open(cat,"w"),ensure_ascii=False,separators=(",",":"))
matched=sum(1 for t in ts if t["pop"]>0)
print(f"popularity added: {matched}/{len(ts)} matched ({100*matched//len(ts)}%)")
print("top 10:", [t["title"] for t in sorted(ts,key=lambda t:-t["pop"])[:10]])
