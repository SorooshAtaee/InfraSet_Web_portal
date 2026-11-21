import { NextRequest, NextResponse } from 'next/server'
import { buildOverpassQuery, ClassToggles, MirrorAttempt, OVERPASS_MIRRORS } from '@/lib/infraset'
import { extractFromOsmMapApi, OsmApiTooLargeError } from '@/lib/osmApiExtract'

export const maxDuration = 180

const PER_MIRROR_TIMEOUT_MS = 75_000

/**
 * Server-side proxy for live OpenStreetMap (Overpass) extraction.
 *
 * Why a proxy instead of a direct browser fetch?
 *  - avoids CORS / mixed-content / restrictive-iframe issues in the browser
 *  - mirrors are raced in parallel; the first one that returns features wins
 *  - every mirror attempt is reported back so the UI can explain failures
 */
export async function POST(req: NextRequest) {
  let bbox: number[] = []
  let toggles: ClassToggles | null = null
  try {
    const body = await req.json()
    bbox = Array.isArray(body?.bbox) ? body.bbox : []
    toggles = body?.toggles ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) {
    return NextResponse.json(
      { error: 'Provide a bbox as [south, west, north, east].' },
      { status: 400 },
    )
  }
  const query = buildOverpassQuery(
    bbox,
    toggles ?? {
      vehicleRoads: true, activeTransport: true, railTracks: true, tramways: true,
      platforms: true, lamps: true, signs: true, bollards: true, crossings: true, stations: true,
    },
  )
  if (!query) {
    return NextResponse.json({ error: 'Enable at least one asset class.' }, { status: 400 })
  }

  // Each task returns its own attempt + payload, so there is no shared state
  // between concurrent requests.
  interface TaskResult {
    mirror: string
    ok: boolean
    status?: number
    error?: string
    elements: Array<Record<string, unknown>>
  }

  const settled: TaskResult[] = await Promise.all(
    OVERPASS_MIRRORS.map(async (mirror): Promise<TaskResult> => {
      const host = new URL(mirror).host
      const task: TaskResult = { mirror: host, ok: false, elements: [] }
      try {
        const res = await fetch(mirror, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(PER_MIRROR_TIMEOUT_MS),
        })
        task.status = res.status
        if (!res.ok) {
          task.error = res.status === 429
            ? 'rate limited (HTTP 429)'
            : `HTTP ${res.status}`
          return task
        }
        const text = await res.text()
        let json: { elements?: unknown[] }
        try {
          json = JSON.parse(text)
        } catch {
          task.error = 'returned a non-JSON response'
          return task
        }
        const elements = Array.isArray(json.elements)
          ? (json.elements as Array<Record<string, unknown>>)
          : []
        task.ok = true
        task.elements = elements
        if (!elements.length) {
          // Regional mirrors answer 200 with an empty set outside their region.
          task.error = 'reachable, but no features for this area (mirror may be regional)'
        }
      } catch (e) {
        if (e instanceof Error) {
          task.error = e.name === 'TimeoutError' || e.name === 'AbortError'
            ? 'timed out'
            : e.message || 'network error'
        } else {
          task.error = String(e)
        }
      }
      return task
    }),
  )

  // Keep mirror order stable for display regardless of completion order.
  const ordered = OVERPASS_MIRRORS.map((m) => new URL(m).host)
    .map((host) => settled.find((t) => t.mirror === host))
    .filter((t): t is TaskResult => Boolean(t))

  const attempts: MirrorAttempt[] = ordered.map(({ mirror, ok, status, error, elements }) => ({
    mirror, ok, status, error, elements: elements.length,
  }))

  const winner = ordered.find((t) => t.ok && t.elements.length > 0)
  if (winner) {
    return NextResponse.json(
      { elements: winner.elements, mirror: winner.mirror, attempts },
      { status: 200 },
    )
  }

  // ---------------------------------------------------------------------
  // Fallback: main OSM API map call (global, works where Overpass is blocked)
  // The map call caps at 50,000 nodes, so on density errors the box is
  // auto-shrunk around its centre (full -> 1/2 -> 1/4 -> 1/8 span) until it
  // fits; the bbox actually used is returned so the UI can show it.
  // ---------------------------------------------------------------------
  const fallbackAttempt: MirrorAttempt = { mirror: 'api.openstreetmap.org (map fallback)', ok: false }
  attempts.push(fallbackAttempt)
  try {
    const togglesSafe = toggles ?? {
      vehicleRoads: true, activeTransport: true, railTracks: true, tramways: true,
      platforms: true, lamps: true, signs: true, bollards: true, crossings: true, stations: true,
    }
    const [s, w, n, e] = bbox
    const cLat = (s + n) / 2
    const cLon = (w + e) / 2
    let spanLat = n - s
    let spanLon = e - w
    let used: number[] | null = null
    let fb: { elements: Array<Record<string, unknown>>; nodesInResponse: number; waysInResponse: number } | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      const halfLat = spanLat / 2
      const halfLon = spanLon / 2
      const tryBox = [cLat - halfLat, cLon - halfLon, cLat + halfLat, cLon + halfLon]
      try {
        const r = await extractFromOsmMapApi(tryBox, togglesSafe)
        fb = r
        used = tryBox
        break
      } catch (err) {
        if (err instanceof OsmApiTooLargeError && attempt < 3 && spanLat > 0.002 && spanLon > 0.002) {
          spanLat /= 2
          spanLon /= 2
          continue
        }
        throw err
      }
    }

    fallbackAttempt.ok = true
    if (fb && fb.elements.length > 0 && used) {
      fallbackAttempt.elements = fb.elements.length
      return NextResponse.json(
        {
          elements: fb.elements,
          mirror: fallbackAttempt.mirror,
          bbox: used.map((v) => Number(v.toFixed(5))),
          attempts,
        },
        { status: 200 },
      )
    }
    fallbackAttempt.error = fb
      ? `no InfraSet-class features in this area (${fb.nodesInResponse} nodes, ${fb.waysInResponse} ways scanned)`
      : 'area is too dense for this source (50,000-node limit) even after shrinking — draw a smaller rectangle'
  } catch (e) {
    fallbackAttempt.error = e instanceof OsmApiTooLargeError
      ? 'area is too dense for this source (50,000-node limit) — shrink the study box to a few km per side'
      : e instanceof Error
        ? (e.name === 'TimeoutError' || e.name === 'AbortError' ? 'timed out' : e.message)
        : String(e)
  }

  const anyReachable = ordered.some((t) => t.ok) || fallbackAttempt.ok
  const noData = attempts.some((a) => a.ok && (a.elements ?? 0) === 0)
  return NextResponse.json(
    {
      error: noData
        ? 'OpenStreetMap sources responded, but no features were found for this area and asset selection. The area may be unmapped, or the selection is too narrow.'
        : 'The server could not reach any Overpass mirror, and the OSM API fallback failed too. Check the server network, or use one of the bundled demo corridors.',
      attempts,
    },
    { status: 502 },
  )
}
