'use client'

import { useEffect, useRef } from 'react'
import type * as LType from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { OsmFeature } from '@/lib/infraset'

// Palette (no blues/indigos per design rules)
const COLORS: Record<string, string> = {
  road: '#64748b',
  path: '#059669',
  rail: '#be123c',
  tram: '#d97706',
  platform: '#047857',
  lamp: '#ca8a04',
  sign: '#ea580c',
  bollard: '#57534e',
  crossing: '#dc2626',
  station: '#1c1917',
  other: '#94a3b8',
}

function classify(tags: Record<string, string> | undefined): string {
  const t = tags || {}
  if (t.railway === 'tram') return 'tram'
  if (t.railway === 'platform') return 'platform'
  if (t.railway === 'rail' || t.railway === 'light_rail' || t.railway === 'subway' || t.railway === 'narrow_gauge') return 'rail'
  if (t.railway === 'level_crossing') return 'crossing'
  if (t.railway === 'station' || t.railway === 'halt' || t.railway === 'tram_stop') return 'station'
  if (t.highway === 'street_lamp') return 'lamp'
  if (t.highway === 'stop' || t.highway === 'give_way' || t.traffic_sign) return 'sign'
  if (t.barrier === 'bollard') return 'bollard'
  if (t.highway && ['footway', 'path', 'pedestrian', 'cycleway', 'steps'].includes(t.highway)) return 'path'
  if (t.highway) return 'road'
  return 'other'
}

export interface MapPanelProps {
  bbox: number[] | null
  features: OsmFeature[]
  drawBboxMode: boolean
  onBboxChange: (bbox: number[]) => void
  fitSignal: number
  onMapReady?: (map: LType.Map) => void
}

export default function MapPanel({
  bbox,
  features,
  drawBboxMode,
  onBboxChange,
  fitSignal,
  onMapReady,
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LType.Map | null>(null)
  const LRef = useRef<typeof LType | null>(null)
  const bboxRectRef = useRef<LType.Rectangle | null>(null)
  const featureLayerRef = useRef<LType.LayerGroup | null>(null)
  const cornerARef = useRef<[number, number] | null>(null)
  const cornerMarkerRef = useRef<LType.CircleMarker | null>(null)
  const drawModeRef = useRef(drawBboxMode)
  const onBboxChangeRef = useRef(onBboxChange)
  const onMapReadyRef = useRef(onMapReady)

  drawModeRef.current = drawBboxMode
  onBboxChangeRef.current = onBboxChange
  onMapReadyRef.current = onMapReady

  // Initialise map once
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(containerRef.current, {
        preferCanvas: true,
        center: [50.66, 4.59],
        zoom: 13,
        zoomControl: true,
      })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      featureLayerRef.current = L.layerGroup().addTo(map)
      map.on('click', (e: LType.LeafletMouseEvent) => {
        if (!drawModeRef.current) return
        const latlng: [number, number] = [e.latlng.lat, e.latlng.lng]
        if (!cornerARef.current) {
          cornerARef.current = latlng
          if (cornerMarkerRef.current) cornerMarkerRef.current.remove()
          cornerMarkerRef.current = L.circleMarker(latlng, {
            radius: 6, color: '#16a34a', weight: 2, fillColor: '#dcfce7', fillOpacity: 0.9,
          }).addTo(map)
        } else {
          const a = cornerARef.current
          const south = Math.min(a[0], latlng[0])
          const north = Math.max(a[0], latlng[0])
          const west = Math.min(a[1], latlng[1])
          const east = Math.max(a[1], latlng[1])
          cornerARef.current = null
          if (cornerMarkerRef.current) {
            cornerMarkerRef.current.remove()
            cornerMarkerRef.current = null
          }
          onBboxChangeRef.current([south, west, north, east])
        }
      })
      mapRef.current = map
      onMapReadyRef.current?.(map)
      // initial bbox display
      if (bbox) drawBbox(L, map, bbox)
    }
    init()
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        bboxRectRef.current = null
        featureLayerRef.current = null
        cornerMarkerRef.current = null
        cornerARef.current = null
      }
    }
  }, [])

  function drawBbox(L: typeof LType, map: LType.Map, b: number[]) {
    const bounds: LType.LatLngBoundsExpression = [
      [b[0], b[1]],
      [b[2], b[3]],
    ]
    if (bboxRectRef.current) {
      bboxRectRef.current.setBounds(bounds)
    } else {
      bboxRectRef.current = L.rectangle(bounds, {
        color: '#16a34a', weight: 2, fillOpacity: 0.06, dashArray: '6 4',
      }).addTo(map)
    }
  }

  // Redraw / fit bbox when it changes (with fit signal)
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map || !bbox) return
    drawBbox(L, map, bbox)
    if (fitSignal > 0) {
      map.fitBounds([
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ], { padding: [24, 24] })
    }
  }, [bbox, fitSignal])

  // Render extracted features overlay
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    const layer = featureLayerRef.current
    if (!L || !map || !layer) return
    layer.clearLayers()
    if (!features.length) return
    const renderer = L.canvas({ padding: 0.3 })
    const MAX = 6000
    const list = features.slice(0, MAX)
    for (const f of list) {
      const cls = classify(f.tags)
      const color = COLORS[cls]
      if (f.type === 'way' && f.geometry && f.geometry.length >= 2) {
        const latlngs: [number, number][] = f.geometry.map((p) => [p.lat, p.lon])
        L.polyline(latlngs, {
          renderer, color, weight: cls === 'rail' || cls === 'tram' ? 3 : 2, opacity: 0.85,
        }).addTo(layer)
      } else if (f.type === 'node' && f.lat !== undefined && f.lon !== undefined) {
        L.circleMarker([f.lat, f.lon], {
          renderer, radius: cls === 'station' ? 6 : 3.5,
          color, weight: 1.5,
          fillColor: color, fillOpacity: 0.8,
        }).addTo(layer)
      }
    }
  }, [features])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md border bg-background/95 px-3 py-2 text-[11px] leading-relaxed shadow-sm"
        aria-hidden="true"
      >
        <div className="mb-1 font-semibold">OSM overlay</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {[
            ['road', 'Vehicle roads'],
            ['path', 'Active transport'],
            ['rail', 'Railway'],
            ['tram', 'Tramway'],
            ['lamp', 'Street lamps'],
            ['sign', 'Traffic signs'],
            ['bollard', 'Bollards'],
            ['station', 'Stations / stops'],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: COLORS[k] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      {drawBboxMode && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow">
          Click two corners of the study area on the map
        </div>
      )}
    </div>
  )
}
