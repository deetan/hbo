# hbo — HBO Max (Adria) → Serbian-learning catalogue

A self-contained web UI for browsing the HBO Max (Serbia / Adria region) catalogue with **faceted
search and per-title audio/subtitle-language filtering** — built as a tool for learning Serbian by
finding what's watchable in Serbian, Croatian, Bosnian (and Russian) audio or subtitles.

---

**Status:** one-off personal tool, complete & live · **Stack:** vanilla HTML/CSS/JS (no framework, no
dependencies, no backend) + a few Python/JS harvest scripts · **Live at:**
<https://den.tanaev.su/hbo/> · **Data:** embedded as a static `site/catalog.json` (~1.8 MB).

---

## What it does

HBO Max in the Adria region carries a lot of Balkan content and near-universal SR/HR subtitles, but the
player gives you no way to ask *"which titles actually have Serbian audio?"* or *"what's dubbed vs.
native?"*. This project answers that question offline.

It's a single-page catalogue of **~2,406 titles** (1,351 movies + 1,055 series) harvested from HBO
Max's content API for a logged-in Serbia account. For every title it stores metadata only — title,
description, cover-image URL, year, seasons/episodes, genres, age rating — plus the **complete list of
audio and subtitle languages**. The web UI then lets you filter by those languages, so a Serbian
learner can zero in on native ex-Yugoslav productions, Serbian/Croatian dubs, or anything with SR/HR
subtitles.

The **learning-Serbian angle** drives the UI: Serbian, Croatian, Bosnian and Montenegrin (the mutually
intelligible "BCS" family), plus Russian, are pinned to the top of the language facets and ★-highlighted
everywhere. Cards flag priority-language availability with `AUD` / `SUB` badges.

> **Scope:** metadata + cover-image URLs only — enough to browse *what is available*. It does **not**
> download video (DRM-protected). Covers load live from HBO's public CDN, so the UI needs internet to
> show thumbnails.

## Screenshot / example

No image is committed. To see it, open <https://den.tanaev.su/hbo/> or serve `site/` locally (below).
The UI is a dark, poster-grid catalogue: a search bar up top, a scrollable left sidebar of facets
(Тип / Год / Озвучка-аудио / Субтитры / Жанр), a poster grid with live result counts, and a detail
modal per title listing every audio & subtitle language with a "Открыть на HBO Max" link. The UI
labels are in Russian (the owner's working language); the catalogue data is English titles.

An example row from `site/catalog.json`:

```json
{
  "id": "020b4de1-…", "type": "movie", "title": "33 Photos from the Ghetto",
  "year": 2026, "rating": "12", "genres": ["documentary"],
  "cover": "https://images.cdn.prd.api.discomax.com/…jpeg",
  "audio": ["Polish - Original", "English"],
  "subs": ["English - CC", "Croatian", "Serbian (Latin)", "Russian", …],
  "seasons": 1, "episodes": 7, "kids": false, "pop": 0.0,
  "url": "https://play.hbomax.com/movie/020b4de1-…"
}
```

## Architecture

Two phases: a manual **harvest → build** pipeline that produces `site/catalog.json`, and a **static
site** that reads that JSON entirely in the browser. There is no server-side logic and no runtime API
call — once `catalog.json` exists, the site is just three static files.

```
  HBO Max content API                       (harvest, in a logged-in Chrome tab,
  default.any-emea.prd.api.hbomax.com         driven by Claude-in-Chrome javascript_tool)
        │  cookie auth (credentials:'include')
        ▼
  scripts/01-enumerate-catalog.js   ──► window.localStorage['hbocat_v1']  (resumable state)
  scripts/02-harvest-languages.js   ──►   { titles: { id: {name, audio[], subs[], …} } }
  scripts/01c-enrich-ratings.js     ──►
        │
        ▼  scripts/03-export-base64.js  →  COPY button  →  (real click)  →  macOS clipboard
        │                                                    │  pbpaste | base64 -D
        ▼                                                    ▼
  scripts/06-add-popularity.py   ── adds `pop` from TMDb keyless export ──►  site/catalog.json
  scripts/04-build-from-json.py  ── derives CSVs ──►  data/languages-matrix.csv, hbo-catalog-full.csv
        │
        ▼
  site/index.html  ── fetch('./catalog.json') ──►  faceted UI (all filtering client-side, in-browser)
        │
        ▼  scripts/05-deploy.sh  (rsync over ssh)
  nginx static host  ──►  https://den.tanaev.su/hbo/
```

External systems it touches: HBO Max / WBD "Beam" content API (read-only, cookie auth, harvest only);
TMDb's public keyless popularity export (`files.tmdb.org`, no API key); HBO's public image CDN
(`images.cdn.prd.api.discomax.com`, at runtime for thumbnails); the nginx host at `den.tanaev.su`
(deploy target).

See **[HANDOFF.md](HANDOFF.md)** for the full reverse-engineered HBO Max API playbook.

## Getting started (run locally)

No install, no dependencies. Just serve the `site/` directory over HTTP (a plain `file://` open won't
work because the page does `fetch('./catalog.json')`).

```bash
git clone https://github.com/deetan/hbo.git
cd hbo
python3 -m http.server 8766 --directory site
# then open http://localhost:8766/
```

Thumbnails load from HBO's public CDN, so you need internet to see cover images; the catalogue itself
(titles, languages, filtering) works fully offline once the page has loaded `catalog.json`.

**Prerequisites:** any static file server (Python 3's `http.server` is enough). Regenerating the
catalogue (below) additionally needs Chrome logged into HBO Max in the Serbia region + the
Claude-in-Chrome tooling, and Python 3 for the two build scripts.

## Regenerating the catalogue

HBO's catalogue changes over time, so `site/catalog.json` goes stale. To rebuild it you re-harvest from
a live, logged-in HBO Max browser session. The full step-by-step (with API details and gotchas) is in
**[HANDOFF.md](HANDOFF.md) → "To REFRESH the catalogue later"**; the short version:

1. Chrome open and logged into HBO Max, **region Serbia**, on a `play.hbomax.com` tab; connect
   Claude-in-Chrome to it.
2. Paste, in order, into the page via `javascript_tool`:
   `scripts/01-enumerate-catalog.js` → `scripts/02-harvest-languages.js` (poll with
   `scripts/02b-progress.js` until finished) → `scripts/01c-enrich-ratings.js`.
   State accumulates in `localStorage['hbocat_v1']` and the sweep is resumable.
3. `scripts/03-export-base64.js` injects a COPY button and returns its `{x,y}`. Do a **real** click on
   it (a trusted gesture is required to grant clipboard access), then on the host:
   `pbpaste | base64 -D > site/catalog.json`. Verify it parses and `count` ≈ 2,400.
4. `python3 scripts/06-add-popularity.py` — adds the `pop` score (used by the default "most popular"
   sort) by matching titles against TMDb's keyless export.
5. `python3 scripts/04-build-from-json.py` — regenerates the two CSVs in `data/` from the JSON.
6. Deploy (below).

The scripts are pasted into the browser rather than run with Node — see HANDOFF.md §6 for why (the
site blocks programmatic downloads; the clipboard is the working data-out bridge).

## Project layout

```
hbo/
├── README.md                       ← this file
├── CLAUDE.md                       ← agent-facing working notes (read this + HANDOFF next)
├── HANDOFF.md                      ← full context: HBO API playbook, gotchas, prior-pass results
├── .gitignore                      ← ignores .DS_Store
├── site/                           ← the deployable static site
│   ├── index.html                  ← the entire UI (HTML+CSS+JS, self-contained, ~25 KB)
│   └── catalog.json                ← embedded catalogue data (~1.8 MB, ~2,394 shown titles)
├── data/                           ← derived / source data (not needed by the site at runtime)
│   ├── hbo-catalog-full.csv        ← flat CSV of every title (built by script 04)
│   ├── languages-matrix.csv        ← language → #titles-with-audio / #titles-with-subs (script 04)
│   ├── hbo-max-sr-hr-AUDIO.md      ← earlier pass: the SR/HR-audio titles categorised (native vs dub)
│   └── hbo-max-sr-hr-catalog.csv   ← earlier audio-focused CSV (superseded by hbo-catalog-full.csv)
├── scripts/                        ← the harvest → build → deploy pipeline
│   ├── 01-enumerate-catalog.js     ← [browser] enumerate all titles + metadata + cover URLs
│   ├── 01c-enrich-ratings.js       ← [browser] add age/maturity ratings
│   ├── 02-harvest-languages.js     ← [browser] per-title audio/subtitle lists + seasons/episodes
│   ├── 02b-progress.js             ← [browser] poll harvest progress
│   ├── 03-export-base64.js         ← [browser] build catalog.json + COPY-to-clipboard button
│   ├── 04-build-from-json.py       ← [host] derive the two CSVs from catalog.json
│   ├── 06-add-popularity.py        ← [host] add `pop` score from TMDb keyless export
│   └── 05-deploy.sh                ← [host] rsync site/ to the nginx host
└── .claude/
    └── launch.json                 ← local "hbo-catalog" server (python http.server on :8766)
```

## Deploy

The site is static files under an existing nginx web root, so shipping is a plain rsync — no nginx
config change:

```bash
bash scripts/05-deploy.sh
```

It rsyncs `site/index.html` + `site/catalog.json` to the `den.tanaev.su` host (an nginx static host,
reached via the `reports` ssh alias) into `…/public/hbo/`, fixes perms, then curls
`/hbo/` and `/hbo/catalog.json` to confirm both return `200`. The page sets `noindex,nofollow` (it's a
personal tool on a public domain). Requires an ssh `reports` alias in your `~/.ssh/config` with access
to that host.

## License / ownership

Personal project — private, © dt. HBO Max catalogue metadata and cover images are © Warner Bros.
Discovery and are used here for personal, non-commercial reference only.
