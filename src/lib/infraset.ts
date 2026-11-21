// Shared types and helpers for the InfraSet web tool

export interface MatchParams {
  double_track: number
  platform_width: number
  station_area: number
  crossing_area: number
}

export interface MatchItem {
  id: string
  asset_type: string
  osm_class: string
  element_key: string
  element_label: string
  unit: string
  unit_label: string
  qty: number
  count_features: number
  length_m: number | null
  wear_sensitive: boolean
  replacement_factor: number
  included: boolean
  detail?: string
}

export interface MatchSummary {
  bbox: number[] | null
  counts: Record<string, number>
  lengths_m: Record<string, number>
  total_features: number
  skipped: number
  n_items: number
}

export interface MatchResponse {
  items: MatchItem[]
  summary: MatchSummary
}

export interface CalcParams {
  poa: number
  traffic_factor: number
  wastage: number
  energy_reduction: number
  water_reduction: number
  ghg_reduction: number
  tf_on_road: boolean
  tf_on_rail: boolean
  pkt?: number | null
}

export interface Headline {
  total_mass_t: number
  initial: { mass_t: number; energy_MJ: number; water_L: number; ghg_kgCO2e: number }
  maintenance: { mass_t: number; energy_MJ: number; water_L: number; ghg_kgCO2e: number }
  total: { mass_t: number; energy_MJ: number; water_L: number; ghg_kgCO2e: number }
  annualised_ghg_kgCO2e_per_year: number
}

export interface CategoryRow {
  category: string
  initial_mass_t: number
  maint_mass_t: number
  initial_energy_MJ: number
  maint_energy_MJ: number
  initial_water_L: number
  maint_water_L: number
  initial_ghg_kgCO2e: number
  maint_ghg_kgCO2e: number
}

export interface CalcItemResult extends MatchItem {
  initial_ghg: number
  initial_energy: number
  initial_water: number
  initial_mass: number
  maint_ghg: number
  maint_energy: number
  maint_water: number
  maint_mass: number
  tf_effective: number
}

export interface CalcResponse {
  headline: Headline
  categories: CategoryRow[]
  items: CalcItemResult[]
  csv_rows: (string | number)[][]
  warnings: string[]
  params_used: CalcParams & {
    wastage_pct: number
    energy_reduction_pct: number
    water_reduction_pct: number
    ghg_reduction_pct: number
  }
}

export type OsmFeature = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export interface DemoCorridor {
  name: string
  bbox: number[]
  source: string
  elements: OsmFeature[]
}

// ---------------------------------------------------------------------------
// OSM Overpass helpers (shared by the client and the server-side proxy)
// ---------------------------------------------------------------------------

export interface ClassToggles {
  vehicleRoads: boolean
  activeTransport: boolean
  railTracks: boolean
  tramways: boolean
  platforms: boolean
  lamps: boolean
  signs: boolean
  bollards: boolean
  crossings: boolean
  stations: boolean
}

export const DEFAULT_CLASS_TOGGLES: ClassToggles = {
  vehicleRoads: true,
  activeTransport: true,
  railTracks: true,
  tramways: true,
  platforms: true,
  lamps: true,
  signs: true,
  bollards: true,
  crossings: true,
  stations: true,
}

export const CLASS_LABELS: Record<keyof ClassToggles, string> = {
  vehicleRoads: 'Vehicle roads (motorway → service)',
  activeTransport: 'Active-transport surfaces (footway, cycleway, path…)',
  railTracks: 'Railway tracks (rail, light rail, subway)',
  tramways: 'Tramways',
  platforms: 'Rail / tram platforms',
  lamps: 'Street lamps → InfraSet light posts',
  signs: 'Traffic signs → InfraSet sign posts',
  bollards: 'Bollards → InfraSet bollards',
  crossings: 'Level crossings',
  stations: 'Stations, halts & tram stops',
}

// Tried in parallel by the server-side proxy. overpass.osm.ch is a regional
// mirror (Switzerland only) and is kept last as a fallback.
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
]

export interface MirrorAttempt {
  mirror: string
  ok: boolean
  status?: number
  error?: string
  elements?: number
}

export function buildOverpassQuery(b: number[], t: ClassToggles): string | null {
  const bbox = `${b[0]},${b[1]},${b[2]},${b[3]}`
  const parts: string[] = []
  if (t.vehicleRoads)
    parts.push(`way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|busway)$"](${bbox});`)
  if (t.activeTransport)
    parts.push(`way["highway"~"^(footway|path|pedestrian|cycleway|steps)$"](${bbox});`)
  if (t.railTracks)
    parts.push(`way["railway"~"^(rail|light_rail|subway|narrow_gauge)$"](${bbox});`)
  if (t.tramways)
    parts.push(`way["railway"="tram"](${bbox});`)
  if (t.platforms)
    parts.push(`way["railway"="platform"](${bbox});`)
  if (t.lamps)
    parts.push(`node["highway"="street_lamp"](${bbox});`)
  if (t.signs) {
    parts.push(`node["highway"~"^(stop|give_way)$"](${bbox});`)
    parts.push(`node["traffic_sign"](${bbox});`)
  }
  if (t.bollards)
    parts.push(`node["barrier"="bollard"](${bbox});`)
  if (t.crossings)
    parts.push(`node["railway"="level_crossing"](${bbox});`)
  if (t.stations)
    parts.push(`node["railway"~"^(station|halt|tram_stop)$"](${bbox});`)
  if (!parts.length) return null
  return `[out:json][timeout:60];\n(\n  ${parts.join('\n  ')}\n);\nout geom;`
}

// Recommended maximum study-area span (degrees). Larger boxes make live
// Overpass queries slow or fail, so views are clamped to this size.
export const MAX_SPAN_LAT = 0.14 // ~15.5 km north-south
export const MAX_SPAN_LON = 0.2 // ~14 km east-west at 50°N

function round5(v: number): number {
  return Number(v.toFixed(5))
}

export function clampBbox(
  b: number[],
  maxLat = MAX_SPAN_LAT,
  maxLon = MAX_SPAN_LON,
): { bbox: number[]; clamped: boolean } {
  if (!Array.isArray(b) || b.length !== 4 || b.some((v) => !Number.isFinite(v))) {
    return { bbox: b, clamped: false }
  }
  const [south, west, north, east] = b
  const cLat = (south + north) / 2
  const cLon = (west + east) / 2
  let s = south
  let n = north
  let w = west
  let e = east
  let clamped = false
  if (n - s > maxLat) {
    const half = maxLat / 2
    s = cLat - half
    n = cLat + half
    clamped = true
  }
  if (e - w > maxLon) {
    const half = maxLon / 2
    w = cLon - half
    e = cLon + half
    clamped = true
  }
  return { bbox: [round5(s), round5(w), round5(n), round5(e)], clamped }
}

export interface GeocodeResult {
  display_name: string
  short_name: string
  lat: number
  lon: number
  bbox: number[] // south, west, north, east (clamped later by clampBbox)
  type: string
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtNumber(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '-'
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function fmtMass(tonnes: number): string {
  return `${fmtNumber(tonnes, tonnes >= 100 ? 0 : 2)} t`
}

export function fmtGhg(kg: number): string {
  if (Math.abs(kg) >= 1_000_000) return `${fmtNumber(kg / 1_000_000, 2)} ktCO2e`
  return `${fmtNumber(kg, 0)} kgCO2e`
}

export function fmtEnergy(mj: number): string {
  if (Math.abs(mj) >= 1_000_000) return `${fmtNumber(mj / 1_000_000, 2)} TJ`
  if (Math.abs(mj) >= 1000) return `${fmtNumber(mj / 1000, 2)} GJ`
  return `${fmtNumber(mj, 0)} MJ`
}

export function fmtWater(litres: number): string {
  if (Math.abs(litres) >= 1_000_000) return `${fmtNumber(litres / 1_000_000, 2)} ML`
  return `${fmtNumber(litres, 0)} L`
}

export function fmtLength(m: number | null | undefined): string {
  if (m === null || m === undefined) return '-'
  if (m >= 1000) return `${fmtNumber(m / 1000, 2)} km`
  return `${fmtNumber(m, 0)} m`
}

export function downloadCsv(rows: (string | number)[][], filename: string) {
  const escape = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  road: 'Road',
  path: 'Active-transport surface',
  rail: 'Railway',
  tram: 'Tramway',
  platform: 'Rail platform',
  lamp: 'Street lighting',
  sign: 'Traffic sign',
  bollard: 'Bollard',
  crossing: 'Level crossing',
  station: 'Station / stop',
}
