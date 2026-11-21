// Fallback OSM extraction via the main OSM API (api.openstreetmap.org).
//
// When every Overpass mirror is unreachable (some hosting environments block
// them), the /api/0.6/map call is a fully global alternative: it returns the
// raw XML of all nodes/ways in a bbox. This module converts that XML into the
// same element JSON shape the Overpass API produces, filtered to the asset
// classes the InfraSet tool uses.
//
// Limits of the map call: 50,000 nodes per request (HTTP 400 above that), so
// very dense 15x14 km boxes may fail; the route maps that to a clear message.

import { ClassToggles, OsmFeature } from '@/lib/infraset'

const OSM_API_UA = 'InfraSetWebTool/0.2 (OpenStreetMap data; InfraSet LCA demo tool)'

const HIGHWAY_VEHICLE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|busway)$/
const HIGHWAY_PATH = /^(footway|path|pedestrian|cycleway|steps)$/
const RAILWAY_WAY = /^(rail|light_rail|subway|narrow_gauge|tram|platform)$/

function wayMatches(tags: Record<string, string>): boolean {
  const h = tags.highway
  if (h && (HIGHWAY_VEHICLE.test(h) || HIGHWAY_PATH.test(h))) return true
  const r = tags.railway
  if (r && RAILWAY_WAY.test(r)) return true
  return false
}

function nodeMatches(tags: Record<string, string>): boolean {
  const h = tags.highway
  if (h === 'street_lamp' || h === 'stop' || h === 'give_way') return true
  if (tags.traffic_sign) return true
  if (tags.barrier === 'bollard') return true
  const r = tags.railway
  if (r === 'level_crossing' || r === 'station' || r === 'halt' || r === 'tram_stop') return true
  return false
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

const ATTR_RE = /([a-zA-Z_]+)="([^"]*)"/g
const TAG_RE = /<tag k="([^"]+)" v="([^"]+)"/g
const ND_RE = /<nd ref="(\d+)"/g

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(ATTR_RE)) out[m[1]] = decodeEntities(m[2])
  return out
}

function parseTags(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(TAG_RE)) out[decodeEntities(m[1])] = decodeEntities(m[2])
  return out
}

export class OsmApiTooLargeError extends Error {
  constructor() {
    super('area too dense for the OSM API fallback (50,000-node limit)')
  }
}

export interface OsmApiResult {
  elements: OsmFeature[]
  nodesInResponse: number
  waysInResponse: number
}

export async function extractFromOsmMapApi(
  bbox: number[],
  _toggles: ClassToggles,
  timeoutMs = 75_000,
): Promise<OsmApiResult> {
  const [s, w, n, e] = bbox
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${w},${s},${e},${n}`
  const res = await fetch(url, {
    headers: { 'User-Agent': OSM_API_UA, Accept: 'application/xml' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    if (res.status === 400) {
      const text = await res.text().catch(() => '')
      if (/too many nodes|50000|smaller area/i.test(text)) throw new OsmApiTooLargeError()
      throw new Error(`OSM API returned HTTP 400${text ? `: ${text.slice(0, 160)}` : ''}`)
    }
    if (res.status === 503) {
      throw new Error('OSM API is temporarily saturated (HTTP 503); retry shortly')
    }
    throw new Error(`OSM API returned HTTP ${res.status}`)
  }
  const xml = await res.text()

  // --- coordinates for every node (tagged or not; ways need them all) ---
  // A single sequential pass: matches `<node .../>` (untagged) and
  // `<node ...><tag/></node>` (tagged) in document order without overlap.
  const NODE_RE = /<node\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g
  const coords = new Map<number, [number, number]>()
  const elements: OsmFeature[] = []
  for (const m of xml.matchAll(NODE_RE)) {
    const a = parseAttrs(m[1])
    const id = Number(a.id)
    const lat = Number(a.lat)
    const lon = Number(a.lon)
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    coords.set(id, [lat, lon])
    const tags = m[2] ? parseTags(m[2]) : {}
    if (Object.keys(tags).length && nodeMatches(tags)) {
      elements.push({ type: 'node', id, lat, lon, tags })
    }
  }

  // --- ways: keep class-matching ones and resolve geometry from node refs ---
  // Same sequential pattern so a rare self-closed `<way .../>` (deleted way)
  // cannot swallow following ways.
  const WAY_RE = /<way\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/way>)/g
  let waysInResponse = 0
  for (const m of xml.matchAll(WAY_RE)) {
    const a = parseAttrs(m[1])
    const tags = m[2] ? parseTags(m[2]) : {}
    waysInResponse += 1
    if (!wayMatches(tags)) continue
    const geometry: { lat: number; lon: number }[] = []
    for (const nd of (m[2] ?? '').matchAll(ND_RE)) {
      const c = coords.get(Number(nd[1]))
      if (c) geometry.push({ lat: c[0], lon: c[1] })
    }
    if (geometry.length >= 2) {
      elements.push({ type: 'way', id: Number(a.id), tags, geometry })
    }
  }

  return {
    elements,
    nodesInResponse: coords.size,
    waysInResponse,
  }
}
