# InfraSet Web Portal

A parametric **Life Cycle Assessment (LCA) and Material Flow Analysis (MFA)** web tool for
transport infrastructure assets, based on the InfraSet PhD model (Soroosh Ataee,
Université catholique de Louvain) and the OpenStreetMap ecosystem.

The site has three pages (single-page app with hash navigation):

| Page | Hash | What it does |
| --- | --- | --- |
| About the project | `#about` | Project, method, case studies, publications |
| Plugin download | `#plugin` | Grasshopper/Rhino plugin package download + install guide |
| Web tool | `#tool` | OSM area selection → quantity take-off → LCA/MFA calculation |

## Architecture

```
Browser (React / Next.js 16)
├─ Leaflet map + OSM tiles, bbox drawing, place search, class selection
│
▼  POST /api/infraset/overpass   GET /api/infraset/geocode
│   Server-side proxies (no direct browser→Overpass calls):
│   • overpass: races 4 public mirrors in parallel, first data wins,
│     reports per-mirror status so failures are explainable
│   • geocode: Nominatim place search for "find a place"
│
▼  POST /api/infraset/match      POST /api/infraset/calculate
Next.js API routes (thin wrappers, src/app/api/infraset/*)
│  spawn python3 (JSON on stdin → JSON on stdout)
│
▼
Python engine (engine/, pure standard library, no pip packages)
├─ engine/infraset_engine.py   OSM feature matching + LCA/MFA calculation
│                              (port of the thesis model: lengths via haversine,
│                               TF & POA scaling, PKT normalisation, CSV export)
└─ engine/infraset_db.py       InfraSet material database (EPiC coefficients)
                               + element recipes (port of Infraset238.py)
```

The calculation logic is **Python** (the language of the thesis backend); the Next.js API
routes only marshal JSON between the browser and the Python engine.

Offline demo corridors (extracted from OpenStreetMap) are bundled in `public/demo/` so the
tool works even when public Overpass mirrors are unreachable: Louvain-la-Neuve–Ottignies
(BE), Coburg–Moreland (AU) and Zürich HB–Hardbrücke (CH).

Study areas are always clamped to ≈15 km per side (see `clampBbox` in `src/lib/infraset.ts`)
so live queries stay within what public mirrors answer reliably.

## Troubleshooting live OSM extraction

The Web tool fetches live data **server-side** (`/api/infraset/overpass`), which races
four mirrors: `overpass-api.de`, `overpass.kumi.systems`, `maps.mail.ru`, `overpass.osm.ch`.
If none of them returns data, it **falls back to the main OSM API**
(`api.openstreetmap.org/api/0.6/map`), which is fully global and converts the raw XML into
the same element format.

- The OSM API fallback caps at **50,000 nodes per request**. For dense areas it
  automatically retries on the central 1/2, 1/4, then 1/8 of the box and reports the box
  actually used (the map rectangle and notice reflect this).
- Place search (`/api/infraset/geocode`, Nominatim) is limited to ~1 request/second by
  Nominatim policy; if you hit HTTP 429, wait a few seconds and search again.
- Public Overpass mirrors rate-limit (HTTP 429) under load; retry after a minute or use a
  smaller area.
- `overpass.osm.ch` only carries **Swiss** data — it answers empty outside Switzerland.
- If results seem empty for a rural area, enable more asset classes or enlarge the area.
- If the UI reports that every source failed, the **server's** network blocks outbound
  access (some sandboxes do). On a normal PC/VPS/Docker host all sources answer. The
  bundled demo corridors keep the tool usable regardless.

## Run locally

Prerequisites: **Bun** (or Node 20+), **Python 3.10+** (standard library only).

```bash
bun install        # or: npm install
bun run dev        # dev server on http://localhost:3000
```

Production:

```bash
bun run build      # next build (standalone output)
bun run start      # serves on port 3000
```

The Python engine can also be used standalone (same JSON contract as the API routes):

```bash
python3 engine/infraset_engine.py match  < payload.json > matched.json
python3 engine/infraset_engine.py calc   < payload.json > results.json
```

## Deploy to the cloud

The app is one service: a Node/Bun process that shells out to `python3`. Any host that
gives you **both Node and Python** works.

### Option A — Docker (Render, Railway, Fly.io, Compute Engine, any VPS)

A `Dockerfile` is included. Build and run:

```bash
docker build -t infraset-web .
docker run -p 3000:3000 infraset-web
```

On Render/Railway: create a service from the repo/Dockerfile and expose port 3000.
On a VPS: run the container behind Caddy/Nginx for TLS.

### Option B — VPS without Docker (Ubuntu 22.04+)

```bash
sudo apt update && sudo apt install -y curl python3
curl -fsSL https://bun.sh/install | bash
git clone <your-repo> && cd infraset-web
bun install && bun run build
PORT=3000 bun run start          # keep alive with pm2/systemd
```

### Option C — Vercel / Netlify (static + edge hosts)

The UI and the API routes deploy fine, **but** most Node serverless runtimes do not ship a
`python3` binary, so the two calculation endpoints would need the engine ported to
JavaScript or the API pointed at a small Python microservice. For a thesis-ready setup,
Option A/B is recommended.

## Where to change things

| Content | File |
| --- | --- |
| About text, case studies, publications | `src/components/infraset/AboutView.tsx` |
| Plugin page, download link | `src/components/infraset/PluginView.tsx` |
| Tool workflow (classes, parameters, steps) | `src/components/infraset/ToolView.tsx` |
| Shared OSM helpers (query builder, bbox clamp, mirror list) | `src/lib/infraset.ts` |
| Overpass proxy (mirror racing) | `src/app/api/infraset/overpass/route.ts` |
| Place search proxy (Nominatim) | `src/app/api/infraset/geocode/route.ts` |
| Results view (cards, chart, CSV) | `src/components/infraset/ResultsPanel.tsx` |
| Material/element database | `engine/infraset_db.py` |
| Matching rules & calculation | `engine/infraset_engine.py` |
| Plugin packages served for download | `public/plugins/`: Infraset2 v2.0.0 builds for Rhino 7 and Rhino 9 (each ZIP: compiled `.gha` assembly + yak package + C# source) and the legacy v0.2 GHPython package (rebuild legacy with `python3 scripts/build_plugin_zip.py`; rebuild the Rhino builds with `python3 scripts/build_rhino_packages.py` from the original uploads) |
| Demo datasets | `public/demo/` (Swiss extracts can be re-fetched with `scripts/fetch_demo_zurich.py`) |

## Credits

InfraSet model and databases: Soroosh Ataee (PhD thesis, UCLouvain, supervisor
Prof. André Stephan), built on the EPiC hybrid LCA database.
Map data © OpenStreetMap contributors. Results are indicative.
