'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  AlertTriangle, Compass, Loader2, MousePointerClick, Play, RefreshCcw, Search, Sparkles,
} from 'lucide-react'
import {
  CalcResponse, CalcParams, DemoCorridor, GeocodeResult, MatchItem, MatchParams, MatchResponse,
  MirrorAttempt, OsmFeature, ASSET_TYPE_LABELS, buildOverpassQuery, CLASS_LABELS, clampBbox,
  ClassToggles, DEFAULT_CLASS_TOGGLES, fmtLength, fmtNumber,
} from '@/lib/infraset'
import ResultsPanel from './ResultsPanel'

const MapPanel = dynamic(() => import('./MapPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map&hellip;
    </div>
  ),
})

const DEMO_CORRIDORS = [
  {
    slug: 'louvain_ottignies_be',
    label: 'Louvain-la-Neuve\u2013Ottignies rail corridor (Belgium)',
  },
  {
    slug: 'coburg_moreland_au',
    label: 'Coburg\u2013Moreland, Upfield line (Melbourne, Australia)',
  },
  {
    slug: 'zurich_hb_ch',
    label: 'Z\u00fcrich HB \u2013 Hardbr\u00fccke rail & tram pocket (Switzerland)',
  },
]

export default function ToolView() {
  const [view, setView] = useState<'input' | 'results'>('input')
  const [bbox, setBbox] = useState<number[] | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  const [drawMode, setDrawMode] = useState(false)
  const mapRef = useRef<{ getBounds: () => { getSouth: () => number; getWest: () => number; getNorth: () => number; getEast: () => number } } | null>(null)

  const [toggles, setToggles] = useState<ClassToggles>({ ...DEFAULT_CLASS_TOGGLES })

  const [matchParams, setMatchParams] = useState<MatchParams>({
    double_track: 2,
    platform_width: 3,
    station_area: 150,
    crossing_area: 60,
  })

  const [features, setFeatures] = useState<OsmFeature[] | null>(null)
  const [corridorName, setCorridorName] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<string | null>(null)
  const [summary, setSummary] = useState<MatchResponse['summary'] | null>(null)
  const [items, setItems] = useState<MatchItem[] | null>(null)

  const [fetching, setFetching] = useState(false)
  const [matching, setMatching] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [calcParams, setCalcParams] = useState<CalcParams>({
    poa: 60,
    traffic_factor: 1,
    wastage: 0,
    energy_reduction: 0,
    water_reduction: 0,
    ghg_reduction: 0,
    tf_on_road: true,
    tf_on_rail: true,
    pkt: null,
  })
  const [pktInput, setPktInput] = useState('')
  const [results, setResults] = useState<CalcResponse | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<GeocodeResult[] | null>(null)

  const hasFeatures = features !== null && features.length > 0

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const runMatch = useCallback(async (feats: OsmFeature[], b: number[] | null, noticeSuffix?: string) => {
    setMatching(true)
    setError(null)
    try {
      const res = await fetch('/api/infraset/match', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bbox: b, params: matchParams, features: feats }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Matching failed')
      const data = json as MatchResponse
      setItems(data.items)
      setSummary(data.summary)
      setResults(null)
      setView('input')
      const base = data.items.length
        ? `Matched ${data.items.length} element groups from ${data.summary.total_features} OSM features.`
        : 'Features were found, but none matched the enabled asset classes. Enable more classes or enlarge the area.'
      setNotice(noticeSuffix ? `${base} ${noticeSuffix}` : base)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setMatching(false)
    }
  }, [matchParams])

  const loadDemo = useCallback(async (slug: string, label: string) => {
    setError(null)
    setFetching(true)
    try {
      const res = await fetch(`/demo/${slug}.json`)
      if (!res.ok) throw new Error(`Could not load demo dataset (${res.status})`)
      const doc = await res.json() as DemoCorridor
      setFeatures(doc.elements)
      setBbox(doc.bbox)
      setFitSignal((v) => v + 1)
      setCorridorName(doc.name)
      setDataSource(doc.source)
      await runMatch(doc.elements, doc.bbox)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(false)
    }
  }, [runMatch])

  const fetchOverpass = useCallback(async () => {
    if (!bbox) {
      setError('Select a study area first (draw on the map, search a place, or use the current map view).')
      return
    }
    if (!buildOverpassQuery(bbox, toggles)) {
      setError('Enable at least one asset class.')
      return
    }
    setFetching(true)
    setError(null)
    setNotice(null)
    try {
      // Clamp oversized areas so the live query stays manageable.
      const { bbox: area, clamped } = clampBbox(bbox)
      if (clamped) {
        setBbox(area)
        setNotice(
          'The study area exceeded the ~15 \u00d7 15 km maximum and has been clamped to its centre. This cap exists because public Overpass servers time out or rate-limit extractions larger than ~15 km per side, and the in-browser matching and LCA calculation would become very slow.'
        )
      }
      const res = await fetch('/api/infraset/overpass', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bbox: area, toggles }),
        signal: AbortSignal.timeout(170_000),
      })
      const json = await res.json()
      if (!res.ok) {
        const attempts = (json.attempts || []) as MirrorAttempt[]
        const detail = attempts
          .map((a) => `${a.mirror}: ${a.error ?? 'failed'}`)
          .join('  |  ')
        throw new Error(
          `${json.error ?? 'Overpass fetch failed'}${detail ? ` — ${detail}` : ''}`
        )
      }
      const elements = (json.elements || []) as OsmFeature[]
      if (!elements.length) {
        setFeatures([])
        setNotice(
          'OpenStreetMap responded, but no mapped features were found inside this area for the enabled asset classes. Try enlarging the area or enabling more classes.'
        )
        return
      }
      // The fallback source may have auto-shrunk a dense area — show the box
      // actually used and say so.
      const usedBbox = (Array.isArray(json.bbox) && json.bbox.length === 4) ? json.bbox as number[] : null
      const shrunk = !!usedBbox && bbox.some((v, i) => Math.abs(v - (usedBbox as number[])[i]) > 1e-9)
      if (shrunk && usedBbox) setBbox(usedBbox)
      setFeatures(elements)
      setCorridorName(null)
      setDataSource(`Live OpenStreetMap query via ${json.mirror} (server proxy)`)
      let noticeSuffix: string | undefined
      if (shrunk && usedBbox) {
        const kmLat = ((usedBbox[2] - usedBbox[0]) * 111).toFixed(1)
        const kmLon = ((usedBbox[3] - usedBbox[1]) * 111 * Math.cos(((usedBbox[0] + usedBbox[2]) / 2) * Math.PI / 180)).toFixed(1)
        noticeSuffix =
          `Note: the selected area was too dense for the fallback extraction source, so the central ~${kmLon} × ${kmLat} km around its centre was extracted instead. Draw a smaller rectangle if you wanted a different part.`
      }
      await runMatch(elements, usedBbox ?? area, noticeSuffix)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFetching(false)
    }
  }, [bbox, toggles, runMatch])

  const useCurrentView = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const b = map.getBounds()
    const south = Number(b.getSouth().toFixed(5))
    const west = Number(b.getWest().toFixed(5))
    const north = Number(b.getNorth().toFixed(5))
    const east = Number(b.getEast().toFixed(5))
    // clamp to a sane maximum so Overpass queries stay reasonable
    const { bbox: area, clamped } = clampBbox([south, west, north, east])
    setBbox(area)
    setDrawMode(false)
    setFitSignal((v) => v + 1)
    setNotice(
      clamped
        ? 'The view exceeded the ~15 \u00d7 15 km maximum, so the study area was clamped to the centre of the view. The cap keeps extractions within what the public Overpass mirrors can return reliably and keeps the browser-side calculation fast.'
        : null
    )
  }, [])

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (q.length < 2) return
    setSearching(true)
    setError(null)
    try {
      const res = await fetch(`/api/infraset/geocode?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Place search failed')
      const results = (json.results || []) as GeocodeResult[]
      setSearchResults(results)
      if (!results.length) {
        setNotice(`No place found for "${q}". Try another spelling or add the country (e.g. "Ottignies, Belgium").`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  const applyGeocode = useCallback((g: GeocodeResult) => {
    // Search results get a tighter cap (~9 x 7 km) than drawn/view areas so
    // live extraction succeeds even on the constrained fallback source.
    const { bbox: area, clamped } = clampBbox(g.bbox, 0.08, 0.1)
    setFeatures(null)
    setSummary(null)
    setItems(null)
    setResults(null)
    setCorridorName(g.short_name)
    setDataSource('Study area selected via place search (Nominatim)')
    setBbox(area)
    setSearchResults(null)
    setDrawMode(false)
    setFitSignal((v) => v + 1)
    const kmLat = ((area[2] - area[0]) * 111).toFixed(1)
    const kmLon = ((area[3] - area[1]) * 111 * Math.cos(((area[0] + area[2]) / 2) * Math.PI / 180)).toFixed(1)
    setNotice(
      `Study area set from "${g.short_name}"${clamped ? ` (reduced to ~${kmLon} × ${kmLat} km around its centre for reliable extraction)` : ''}. Now click "Fetch & match this area".`
    )
  }, [])

  const runCalc = useCallback(async () => {
    if (!items || !items.length) return
    setCalculating(true)
    setError(null)
    try {
      const params: CalcParams = { ...calcParams }
      const pkt = parseFloat(pktInput)
      params.pkt = Number.isFinite(pkt) && pkt > 0 ? pkt : null
      const res = await fetch('/api/infraset/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items, params }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Calculation failed')
      setResults(json as CalcResponse)
      setView('results')
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCalculating(false)
    }
  }, [items, calcParams, pktInput])

  const updateItem = (id: string, patch: Partial<MatchItem>) => {
    setItems((prev) => prev ? prev.map((it) => (it.id === id ? { ...it, ...patch } : it)) : prev)
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const totalRailKm = useMemo(() => {
    if (!summary) return null
    const keys = Object.keys(summary.lengths_m).filter((k) => k.startsWith('rail:') || k.startsWith('tram:'))
    const total = keys.reduce((acc, k) => acc + summary.lengths_m[k], 0)
    return total / 1000
  }, [summary])

  // -------------------------------------------------------------------------

  if (view === 'results' && results) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <ResultsPanel
          results={results}
          corridorName={corridorName}
          onBack={() => setView('input')}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">InfraSet Web Tool</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Select an area on the map, extract roads, railways, tramways, stations and ancillary
          assets from OpenStreetMap, assign them to the InfraSet element database (ported from the
          Grasshopper backend), then run the life cycle assessment and material flow analysis with
          your own scenario parameters.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mb-4 border-emerald-300 bg-emerald-50 text-emerald-900">
          <Sparkles className="h-4 w-4" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,440px)_1fr]">
        {/* ------------------------------ Left: map ------------------------------ */}
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          {/* Place search — easiest way to pick any area */}
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="text-xs font-semibold">Find a place</div>
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                placeholder="e.g. Ottignies, Leuven, Bern main station"
                className="h-8 text-sm"
                aria-label="Search a place by name"
              />
              <Button
                variant="outline"
                className="h-8 shrink-0"
                onClick={runSearch}
                disabled={searching || searchQuery.trim().length < 2}
              >
                {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </div>
            {searchResults && searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border bg-background text-sm infraset-scroll">
                {searchResults.map((g, i) => (
                  <button
                    key={`${g.lat}-${g.lon}-${i}`}
                    className="block w-full truncate border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/70"
                    onClick={() => applyGeocode(g)}
                    title={g.display_name}
                  >
                    <span className="font-medium">{g.short_name}</span>
                    {g.type && <span className="ml-2 text-xs text-muted-foreground">({g.type})</span>}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Search sets a study area for you; you can still draw a rectangle or use the current view.
            </p>
          </div>
          <div className="h-[420px] overflow-hidden rounded-lg border shadow-sm">
            <MapPanel
              bbox={bbox}
              features={features || []}
              drawBboxMode={drawMode}
              onBboxChange={(b) => {
                const { bbox: area, clamped } = clampBbox(b)
                setBbox(area)
                setDrawMode(false)
                if (clamped) {
                  setNotice('The drawn rectangle exceeded the ~15 \u00d7 15 km maximum (the cap that keeps the public Overpass mirrors responsive) and has been clamped to that size.')
                }
              }}
              fitSignal={fitSignal}
              onMapReady={(m) => { mapRef.current = m as never }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={drawMode ? 'default' : 'outline'}
              className={drawMode ? 'bg-emerald-700 hover:bg-emerald-800' : ''}
              onClick={() => setDrawMode((v) => !v)}
            >
              <MousePointerClick className="mr-2 h-4 w-4" />
              {drawMode ? 'Drawing: click two corners' : 'Draw study area'}
            </Button>
            <Button variant="outline" onClick={useCurrentView}>
              <Compass className="mr-2 h-4 w-4" /> Use current view
            </Button>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-2">
            <div className="font-semibold">Study area (south, west, north, east)</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['south', 'west', 'north', 'east'] as const).map((lbl, i) => (
                <div key={lbl}>
                  <Label className="text-[10px] uppercase text-muted-foreground">{lbl}</Label>
                  <Input
                    className="h-7 text-xs tabular-nums"
                    type="number"
                    step="0.00001"
                    value={bbox ? bbox[i] : ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      if (!Number.isFinite(v)) return
                      setBbox((prev) => {
                        const nb = prev ? [...prev] : [50.64, 4.56, 50.68, 4.62]
                        nb[i] = v
                        return nb
                      })
                    }}
                    aria-label={lbl}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------ Right: steps ------------------------------ */}
        <div className="space-y-5">
          {/* Step 1 — presets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">1 &middot; Or start from a sample case study</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Bundled sample datasets extracted from OpenStreetMap (work offline):
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_CORRIDORS.map((d) => (
                  <Button
                    key={d.slug}
                    variant="outline"
                    onClick={() => loadDemo(d.slug, d.label)}
                    disabled={fetching || matching}
                  >
                    {fetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    {d.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Note: these samples are short excerpts captured within the web tool&apos;s ~15 &times; 15 km
                extraction limit, so their quantities and results differ from the full corridor
                assessments in the thesis and the Grasshopper plugin, which cover the complete
                routes with as-built data.
              </p>
              {dataSource && (
                <p className="text-xs text-muted-foreground">Data source: {dataSource}</p>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — asset classes & assumptions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2 &middot; Asset classes &amp; matching assumptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(CLASS_LABELS) as (keyof ClassToggles)[]).map((k) => (
                  <label key={k} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/60 cursor-pointer">
                    <Checkbox
                      checked={toggles[k]}
                      onCheckedChange={(v) => setToggles((prev) => ({ ...prev, [k]: v === true }))}
                      aria-label={CLASS_LABELS[k]}
                    />
                    <span>{CLASS_LABELS[k]}</span>
                  </label>
                ))}
              </div>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Tracks per line</Label>
                  <Input
                    type="number" min={1} max={8} value={matchParams.double_track}
                    onChange={(e) => setMatchParams((p) => ({ ...p, double_track: Math.max(1, parseInt(e.target.value) || 1) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Platform width (m)</Label>
                  <Input
                    type="number" min={1} step={0.5} value={matchParams.platform_width}
                    onChange={(e) => setMatchParams((p) => ({ ...p, platform_width: Math.max(1, parseFloat(e.target.value) || 1) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Station area (m&sup2;)</Label>
                  <Input
                    type="number" min={0} step={10} value={matchParams.station_area}
                    onChange={(e) => setMatchParams((p) => ({ ...p, station_area: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Crossing panel (m&sup2;)</Label>
                  <Input
                    type="number" min={0} step={5} value={matchParams.crossing_area}
                    onChange={(e) => setMatchParams((p) => ({ ...p, crossing_area: Math.max(0, parseFloat(e.target.value) || 0) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Roadway widths per OSM class and path widths use InfraSet defaults; quantities can be
                overridden per group in step 4.
              </p>
            </CardContent>
          </Card>

          {/* Step 3 — fetch */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">3 &middot; Extract from OpenStreetMap &amp; match to the InfraSet database</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={fetchOverpass}
                  disabled={fetching || matching || !bbox}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  {fetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                  {fetching ? 'Querying Overpass\u2026' : 'Fetch & match this area'}
                </Button>
                {hasFeatures && (
                  <Button
                    variant="outline"
                    onClick={() => runMatch(features!, bbox)}
                    disabled={fetching || matching}
                  >
                    {matching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Re-match with current assumptions
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Live queries run through this site&apos;s own server, which races several public
                Overpass API mirrors and uses the first that returns data. Study areas are capped
                at ~15 &times; 15 km so the mirrors can respond reliably (larger extractions time out
                or get rate-limited) and the browser-side matching and LCA stay fast. If no mirror
                is reachable from your host, use a sample case study (step 1).
              </p>
              {summary && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(summary.counts).slice(0, 14).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[11px]">
                        {k.replace(':', ' ')} &times; {v}
                      </Badge>
                    ))}
                    {Object.keys(summary.counts).length > 14 && (
                      <Badge variant="secondary" className="text-[11px]">
                        +{Object.keys(summary.counts).length - 14} more classes
                      </Badge>
                    )}
                  </div>
                  {totalRailKm !== null && totalRailKm > 0 && (
                    <p className="text-xs text-muted-foreground">Total rail + tram length in area: {fmtLength(totalRailKm * 1000)}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 4 — review matched items */}
          {items && items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  4 &middot; Review matched elements ({items.length} groups)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[420px] overflow-y-auto infraset-scroll">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/95 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Include</th>
                        <th className="px-3 py-2">OSM class</th>
                        <th className="px-3 py-2">InfraSet element</th>
                        <th className="px-3 py-2 text-right">Quantity</th>
                        <th className="px-3 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className={`border-t ${it.included ? '' : 'opacity-45'}`}>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={it.included}
                              onCheckedChange={(v) => updateItem(it.id, { included: v === true })}
                              aria-label={`include ${it.osm_class}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="whitespace-nowrap">
                              {ASSET_TYPE_LABELS[it.asset_type] || it.asset_type}
                            </Badge>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {it.osm_class} &middot; {it.count_features} feature{it.count_features > 1 ? 's' : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {it.element_label}
                            {it.wear_sensitive && (
                              <Badge className="ml-2 bg-amber-100 text-amber-900 hover:bg-amber-100" variant="secondary">
                                TF-sensitive
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="h-8 w-28 text-right tabular-nums"
                              type="number" min={0}
                              value={it.qty}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value)
                                updateItem(it.id, { qty: Number.isFinite(v) ? v : 0 })
                              }}
                              aria-label={`quantity for ${it.osm_class}`}
                            />
                            <div className="mt-0.5 text-[11px] text-muted-foreground">{it.unit}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {it.detail || (it.length_m ? `${fmtLength(it.length_m)} total` : '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 5 — scenario & calculate */}
          {items && items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">5 &middot; Scenario parameters &amp; calculate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Period of analysis (POA)</Label>
                      <span className="text-sm font-semibold tabular-nums">{calcParams.poa} years</span>
                    </div>
                    <Slider
                      min={20} max={200} step={5} value={[calcParams.poa]}
                      onValueChange={([v]) => setCalcParams((p) => ({ ...p, poa: v }))}
                      aria-label="Period of analysis"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Maintenance and replacement burdens scale with POA/60 (60-year reference).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Traffic factor (TF)</Label>
                      <span className="text-sm font-semibold tabular-nums">TF = {calcParams.traffic_factor}</span>
                    </div>
                    <Slider
                      min={0.5} max={5} step={0.25} value={[calcParams.traffic_factor]}
                      onValueChange={([v]) => setCalcParams((p) => ({ ...p, traffic_factor: v }))}
                      aria-label="Traffic factor"
                    />
                    <div className="flex flex-wrap gap-4 pt-1">
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={calcParams.tf_on_road}
                          onCheckedChange={(v) => setCalcParams((p) => ({ ...p, tf_on_road: v }))}
                          aria-label="apply traffic factor to road pavement"
                        />
                        Apply to road pavement
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch
                          checked={calcParams.tf_on_rail}
                          onCheckedChange={(v) => setCalcParams((p) => ({ ...p, tf_on_rail: v }))}
                          aria-label="apply traffic factor to rail track"
                        />
                        Apply to rail track
                      </label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <Label className="text-xs">Wastage (%)</Label>
                    <Input
                      type="number" min={0} max={100} value={calcParams.wastage}
                      onChange={(e) => setCalcParams((p) => ({ ...p, wastage: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Energy reduction (%)</Label>
                    <Input
                      type="number" min={0} max={100} value={calcParams.energy_reduction}
                      onChange={(e) => setCalcParams((p) => ({ ...p, energy_reduction: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Water reduction (%)</Label>
                    <Input
                      type="number" min={0} max={100} value={calcParams.water_reduction}
                      onChange={(e) => setCalcParams((p) => ({ ...p, water_reduction: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">GHG reduction (%)</Label>
                    <Input
                      type="number" min={0} max={100} value={calcParams.ghg_reduction}
                      onChange={(e) => setCalcParams((p) => ({ ...p, ghg_reduction: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">
                      Optional: normalise per PKT (million passenger-km over 60 y)
                    </Label>
                    <Input
                      type="number" min={0} placeholder="e.g. 12.5 (leave empty for absolute values)"
                      value={pktInput}
                      onChange={(e) => setPktInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Included groups: {items.filter((i) => i.included).length} / {items.length}
                    {' '}&middot; Total quantity units: {fmtNumber(items.reduce((a, i) => a + (i.included ? i.qty : 0), 0), 0)}
                  </p>
                  <Button
                    onClick={runCalc}
                    disabled={calculating}
                    size="lg"
                    className="bg-emerald-700 hover:bg-emerald-800"
                  >
                    {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Run LCA / MFA
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
