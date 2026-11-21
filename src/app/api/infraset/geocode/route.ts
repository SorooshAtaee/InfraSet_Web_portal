import { NextRequest, NextResponse } from 'next/server'
import { clampBbox, GeocodeResult } from '@/lib/infraset'

export const maxDuration = 30

const NOMINATIM_UA = 'InfraSetWebTool/0.2 (OpenStreetMap data; InfraSet LCA demo tool)'

interface NominatimHit {
  display_name?: string
  name?: string
  lat?: string
  lon?: string
  type?: string
  boundingbox?: string[] // [south, north, west, east] as strings
}

/**
 * Server-side proxy for the Nominatim place search, so the browser never
 * talks to external services directly (same reasoning as the Overpass proxy).
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '6')
  url.searchParams.set('addressdetails', '0')

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      const hint = res.status === 429
        ? 'place search is rate-limited right now (Nominatim allows about 1 request per second) — wait a few seconds and try again'
        : `Nominatim returned HTTP ${res.status}`
      return NextResponse.json({ error: hint, results: [] }, { status: 502 })
    }
    const hits = (await res.json()) as NominatimHit[]
    const results: GeocodeResult[] = []
    for (const h of hits) {
      const lat = parseFloat(h.lat ?? '')
      const lon = parseFloat(h.lon ?? '')
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      let bbox: number[] | null = null
      if (Array.isArray(h.boundingbox) && h.boundingbox.length === 4) {
        // Nominatim order is [south, north, west, east]; convert to SWNE.
        const s = parseFloat(h.boundingbox[0])
        const n = parseFloat(h.boundingbox[1])
        const w = parseFloat(h.boundingbox[2])
        const e = parseFloat(h.boundingbox[3])
        if ([s, n, w, e].every(Number.isFinite)) bbox = [s, w, n, e]
      }
      if (!bbox) {
        // Fall back to a compact square (~3 km) around the point.
        const d = 0.015
        bbox = [lat - d, lon - d, lat + d, lon + d]
      }
      const displayName = h.display_name || h.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`
      const shortName = displayName.split(',').slice(0, 2).join(', ')
      results.push({ display_name: displayName, short_name: shortName, lat, lon, bbox, type: h.type ?? '' })
    }
    return NextResponse.json({ results })
  } catch (e) {
    const message = e instanceof Error
      ? (e.name === 'TimeoutError' || e.name === 'AbortError' ? 'Nominatim request timed out' : e.message)
      : String(e)
    return NextResponse.json({ error: message, results: [] }, { status: 502 })
  }
}
