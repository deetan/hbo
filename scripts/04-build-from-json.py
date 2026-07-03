#!/usr/bin/env python3
"""STEP 4 (host-side): from site/catalog.json, build the language-database matrix + a flat CSV.
   Run:  python3 scripts/04-build-from-json.py
   Inputs:  site/catalog.json   Outputs:  data/languages-matrix.csv, data/hbo-catalog-full.csv
   catalog.json stores RAW track names; we normalise role-suffixes (- Original / - Audio Description / - SDH)
   the same way the catalogue UI does, so chip/matrix counts agree."""
import json, csv, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, "site/catalog.json")))
ts = d["titles"]
norm = lambda s: re.sub(r"\s*-\s*(Original|Audio Description|SDH)\s*$", "", s, flags=re.I).strip()

m = {}
for t in ts:
    for a in set(norm(x) for x in t.get("audio", [])): m.setdefault(a, {"a": 0, "s": 0})["a"] += 1
    for s in set(norm(x) for x in t.get("subs", [])): m.setdefault(s, {"a": 0, "s": 0})["s"] += 1

PRI = ["serbian", "croatian", "bosnian", "montenegrin", "russian"]  # user priority on top
def pri(k):
    for i, p in enumerate(PRI):
        if k.lower().startswith(p): return i
    return 99
rows = sorted(m.items(), key=lambda kv: (pri(kv[0]), -(kv[1]["a"] + kv[1]["s"]), kv[0]))

with open(os.path.join(ROOT, "data/languages-matrix.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["language", "audio_titles", "subtitle_titles"])
    for k, v in rows: w.writerow([k, v["a"], v["s"]])

with open(os.path.join(ROOT, "data/hbo-catalog-full.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["title", "original", "type", "kids", "age_rating", "popularity", "year", "seasons", "episodes",
                "genres", "audio", "subtitles", "cover", "url", "description"])
    for t in sorted(ts, key=lambda t: t["title"].lower()):
        w.writerow([t["title"], t["original"], t["type"], "yes" if t["kids"] else "", t.get("rating", ""),
                    t.get("pop", ""), t["year"], t["seasons"], t["episodes"], "; ".join(t["genres"]),
                    "; ".join(t["audio"]), "; ".join(t["subs"]), t["cover"], t["url"], t["desc"]])

print(f"languages-matrix.csv: {len(rows)} languages | hbo-catalog-full.csv: {len(ts)} titles")
