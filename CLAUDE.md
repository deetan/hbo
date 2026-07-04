# CLAUDE.md — hbo (HBO Max → Serbian-learning catalogue)

## Response language

**Always reply in English**, even when the user writes in Russian. The user explicitly prefers English
(Cyrillic costs ~2x more tokens). Switch only if explicitly asked ("ответь по-русски" / "in Russian").
Pass this rule through to any subagents you spawn.

## TL;DR + read order

A self-contained, dependency-free web catalogue of HBO Max (Serbia / Adria) content, built to help the
owner learn Serbian by finding titles with Serbian/Croatian/Bosnian (and Russian) audio or subtitles.
Data is harvested from HBO's content API, baked into `site/catalog.json`, and browsed by a single
static `site/index.html`. Live at <https://den.tanaev.su/hbo/>.

Read, in order:
1. **`HANDOFF.md`** — the authoritative context: the reverse-engineered HBO Max API playbook, the
   harvest gotchas (clipboard bridge, download block), prior-pass results, and the refresh recipe. Most
   of the hard-won knowledge lives here; do not duplicate it — extend it.
2. **`README.md`** — human-facing overview, architecture diagram, run/deploy commands.
3. **`site/index.html`** — the entire UI (HTML + CSS + JS in one file). The faceting logic is the
   interesting part (see "Mental model").
4. **`scripts/`** — the harvest → build → deploy pipeline (numbered 01, 01c, 02, 02b, 03, 04, 05, 06).

## Mental model

Two clearly separated phases:

- **Harvest + build (manual, occasional).** HBO exposes no audio/subtitle taxonomy, so the only way to
  know each title's languages is to hit its per-title API route. The `scripts/0*` files run *inside a
  logged-in `play.hbomax.com` browser tab* (pasted via Claude-in-Chrome `javascript_tool`), using
  cookie auth (`fetch(..., {credentials:'include'})`). They accumulate state in
  `localStorage['hbocat_v1']` (resumable), then export `site/catalog.json` via a clipboard bridge.
  Two host-side Python scripts post-process it (popularity + CSVs). Full method: HANDOFF.md §5–§6.
- **Browse (runtime).** `site/index.html` does `fetch('./catalog.json')` and does *everything else in
  the browser* — no backend, no build step, no framework. Deploy = copy two files to nginx.

`catalog.json` schema (friendly, produced by `scripts/03-export-base64.js`):
`{ generated, region, count, titles: [{ id, type: "movie"|"series", title, original, desc, year,
rating (age), genres[], cover (CDN URL), audio[] (RAW track names), subs[] (RAW), seasons, episodes,
kids (bool), url, pop (float) }] }`.

**The key invariant — RAW track names, normalised at display time.** `catalog.json` stores HBO's raw
track strings (`"Serbian (Cyrillic)"`, `"English - Original"`, `"Polish - SDH"`). Both the UI and
`scripts/04-build-from-json.py` normalise them identically so counts agree:
- strip role suffixes `- Original` / `- Audio Description` / `- SDH` / `- CC` from both audio & subs;
- **audio only:** also drop the script qualifier (`Serbian (Cyrillic)` → `Serbian`) — spoken language
  has no script;
- **subtitles:** keep the script (`Serbian (Latin)` vs `Serbian (Cyrillic)` are different subtitle
  tracks and both matter). See `audNorm` / `subNorm` in `index.html`.

**Faceting semantics (the subtle bit in `index.html`):**
- Facets are AND *across* categories (Type AND Year AND Audio AND Subs AND Genre AND text search).
- **Audio and Subtitles are OR *within* the facet** — selecting Croatian + Serbian audio matches titles
  with *either*. Genre is AND within.
- Every action recomputes **live result counts on every facet chip**. The OR facets (audio/subs) count
  their own options while *ignoring their own current selection* (the `skip` argument to `matches()`),
  so the numbers stay meaningful; genre/type count over the fully-filtered set.
- Serbian-family (`serbian|croatian|bosnian|montenegrin`) + Russian are pinned to the top of the
  language facets and ★-highlighted (`PRI_RE` / `PRI()` in the JS). Default sort is `pop`.

## How to develop here

**No build for the UI.** Edit `site/index.html` directly and refresh. To preview locally you must serve
over HTTP (the page fetches `catalog.json`; `file://` fails on the fetch):

```bash
python3 -m http.server 8766 --directory site   # then http://localhost:8766/
```

There's also a `.claude/launch.json` config named `hbo-catalog` that runs exactly this on port 8766 —
use the preview/run tooling if available.

**Adding a UI feature** (a new facet, sort, badge): it's all in the single `<script>` in `index.html`.
The pattern for a facet is `makeFacet(stateKey, items, chipsEl, moreEl, filterEl, limit)` wired into
`apply()` (which recomputes counts) and `syncActive()` (the removable pills). Follow the existing
audio/subs facets.

**Regenerating `catalog.json`** (when HBO content drifts): follow HANDOFF.md's refresh recipe. Summary:
browser scripts `01 → 02` (poll `02b` until done) `→ 01c → 03` (real click on the COPY button →
`pbpaste | base64 -D > site/catalog.json`), then host-side `python3 scripts/06-add-popularity.py` and
`python3 scripts/04-build-from-json.py`. Sanity-check against HANDOFF.md §8 (expect ~2,400 titles,
~138 SR/HR-audio).

## Deploy / release

```bash
bash scripts/05-deploy.sh
```

Rsyncs `site/index.html` + `site/catalog.json` to the nginx host `den.tanaev.su` (ssh alias `reports`)
into `…/public/hbo/`, fixes perms, and curls `/hbo/` + `/hbo/catalog.json` for `200`s. It's a subdir of
an existing web root with `try_files`, so **no nginx config change** is needed. Before deploying, verify
the site loads locally and `catalog.json` parses.

Requires an ssh `reports` alias with access to the host (kept in `~/.ssh/config`, not in this repo).

## Conventions

- Vanilla everything: **no npm, no framework, no dependencies, no bundler.** Keep it that way — the
  value is a single portable HTML file.
- UI copy is in **Russian** (the owner's working language); docs/comments/commit messages are in
  **English** (see the language block above). Catalogue title data stays in HBO's English.
- Scripts are numbered by pipeline stage; `[browser]` ones are pasted into the page, `[host]` ones run
  with `python3`/`bash`. Keep new steps numbered and note in the file header which environment they run
  in and what they read/write.
- `catalog.json` is generated data but **is committed** (it *is* the deliverable — the site can't run
  without it). Don't hand-edit it; regenerate.

## Gotchas & known issues

- **Serve over HTTP, not `file://`.** The page `fetch()`es `catalog.json`, which `file://` blocks.
- **The site blocks programmatic downloads** and a localhost POST bridge (CSP `upgrade-insecure-requests`).
  The working data-out path is the **clipboard**: script 03 injects a COPY button; you must click it
  with a **real** trusted gesture (a synthetic `.click()` won't grant clipboard-write). Details:
  HANDOFF.md §6.
- **base64, not raw, over the clipboard.** `pbpaste` mangles non-ASCII; script 03 emits base64 and you
  `base64 -D` it. Watch for a **clipboard race** — if the pasted length ≠ the button's reported b64
  length, something clobbered the clipboard; re-click and paste again immediately.
- **`javascript_tool` returns are ~1 KB-capped** — scripts accumulate data in `window`/localStorage and
  return only small summaries.
- **Harvest completeness caveats** (see HANDOFF.md §5): a series' per-title route usually loads only
  ~Season 1 edits, so a show dubbed *only* in a later season could be missed. Trailer edits carry only
  `English - Original` audio, which is why you must hit the per-title route, not the collection listing.
- **Popularity is approximate.** HBO exposes no per-title popularity; `pop` comes from matching titles
  against TMDb's keyless export (~81% match; unmatched → `pop 0.0`, sorted to the bottom by recency).
- **Cover images are live CDN URLs**, not bundled — the UI needs internet to show thumbnails. A fully
  offline copy would require downloading ~2,400 images (see HANDOFF.md §7 "Offline images").
- **`noindex,nofollow`** is intentional in `index.html` — it's a personal tool on a public domain.
- Script 03 **drops the ~12 "(with ASL)"/"(with BASL)" sign-language dupe editions**, so the shown
  `count` (~2,394) is slightly under the harvested 2,406.

## What NOT to touch / do

- **Do not attempt to download HBO video** — DRM-protected, and out of scope. This project is metadata +
  cover URLs only.
- **Do not scrape auth tokens** from the browser. Cookie auth via `credentials:'include'` is sufficient
  and correct; storing session credentials in this folder is a leak risk (see HANDOFF.md §9) — don't.
- Don't add build tooling / dependencies to the UI. Don't hand-edit `catalog.json`.

## Secrets & data

- **No secrets in this repo, by design.** Harvest auth is just the live logged-in Chrome session's
  HttpOnly cookies (never read, never stored). No tokens, no `.env`. This repo is **PUBLIC** — keep it
  that way: nothing beyond the already-public `den.tanaev.su` URL should appear.
- Deploy relies on an ssh `reports` alias that lives in your local `~/.ssh/config`, **not** in the repo.
- `.gitignore` only excludes `.DS_Store`.
- **Committed data:** `site/catalog.json` and the two `data/*.csv` are generated but tracked (they're the
  deliverable). The intermediate harvest state lives only in the browser's `localStorage['hbocat_v1']`
  and is *not* in git — a fresh machine has no harvest state; you re-run the browser scripts to rebuild.

## Git / backup — MANDATORY

This project is backed up to **https://github.com/deetan/hbo** (**PUBLIC**).

After any meaningful change: `git add -A && git commit && git push`. Do not leave work unpushed at the
end of a session. Because the repo is public, double-check no personal data, tokens, credentials, or
private server internals (beyond the public `den.tanaev.su` URL) land in a commit before pushing.
