'use client'

import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, RotateCcw, TriangleAlert } from 'lucide-react'
import {
  CalcResponse, ASSET_TYPE_LABELS, downloadCsv,
  fmtGhg, fmtEnergy, fmtWater, fmtMass, fmtNumber, fmtLength,
} from '@/lib/infraset'

type Metric = 'ghg' | 'energy' | 'water' | 'mass'

const METRICS: { key: Metric; label: string; unit: string; scale: (v: number) => number }[] = [
  { key: 'ghg', label: 'GHG', unit: 't CO2e', scale: (v) => v / 1000 },
  { key: 'energy', label: 'Embodied energy', unit: 'TJ', scale: (v) => v / 1_000_000 },
  { key: 'water', label: 'Embodied water', unit: 'ML', scale: (v) => v / 1_000_000 },
  { key: 'mass', label: 'Mass', unit: 't', scale: (v) => v },
]

function shortenCat(name: string) {
  const map: Record<string, string> = {
    'Concrete and plaster products': 'Concrete & plaster',
    'Sand, stone and ceramics': 'Sand, stone, ceramics',
    Metals: 'Metals',
    Plastics: 'Plastics',
    Miscellaneous: 'Miscellaneous',
    Timber: 'Timber',
    Glass: 'Glass',
    Insulation: 'Insulation',
  }
  return map[name] || name
}

export default function ResultsPanel({
  results,
  onBack,
  corridorName,
}: {
  results: CalcResponse
  onBack: () => void
  corridorName: string | null
}) {
  const [metric, setMetric] = useState<Metric>('ghg')
  const h = results.headline

  const chartData = useMemo(
    () =>
      results.categories.map((c) => {
        const m = METRICS.find((x) => x.key === metric)!
        return {
          name: shortenCat(c.category),
          Initial: Number(m.scale(metric === 'ghg' ? c.initial_ghg_kgCO2e : metric === 'energy' ? c.initial_energy_MJ : metric === 'water' ? c.initial_water_L : c.initial_mass_t).toFixed(2)),
          Maintenance: Number(m.scale(metric === 'ghg' ? c.maint_ghg_kgCO2e : metric === 'energy' ? c.maint_energy_MJ : metric === 'water' ? c.maint_water_L : c.maint_mass_t).toFixed(2)),
        }
      }),
    [results.categories, metric]
  )

  const csvName = `infraset_results_${(corridorName || 'area').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}.csv`

  const cards = [
    { title: 'Total mass', value: fmtMass(h.total_mass_t), sub: `initial ${fmtMass(h.initial.mass_t)} + maintenance ${fmtMass(h.maintenance.mass_t)}` },
    { title: 'Total GHG', value: fmtGhg(h.total.ghg_kgCO2e), sub: `initial ${fmtGhg(h.initial.ghg_kgCO2e)} + maintenance ${fmtGhg(h.maintenance.ghg_kgCO2e)}` },
    { title: 'Total energy', value: fmtEnergy(h.total.energy_MJ), sub: `initial ${fmtEnergy(h.initial.energy_MJ)} + maintenance ${fmtEnergy(h.maintenance.energy_MJ)}` },
    { title: 'Total water', value: fmtWater(h.total.water_L), sub: `initial ${fmtWater(h.initial.water_L)} + maintenance ${fmtWater(h.maintenance.water_L)}` },
  ]

  const p = results.params_used

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Results</h3>
          <p className="text-sm text-muted-foreground">
            {corridorName ? `${corridorName} — ` : ''}
            POA {p.poa} y · Traffic factor {p.traffic_factor} · Wastage {p.wastage_pct}% ·
            {' '}reductions E/W/GHG {p.energy_reduction_pct}/{p.water_reduction_pct}/{p.ghg_reduction_pct}%
            {p.pkt ? ` · per ${p.pkt} million PKT` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <RotateCcw className="mr-2 h-4 w-4" /> Adjust inputs
          </Button>
          <Button onClick={() => downloadCsv(results.csv_rows, csvName)}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800">{c.value}</div>
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Life cycle flows by material category</CardTitle>
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={metric === m.key ? 'default' : 'outline'}
                className={metric === m.key ? 'bg-emerald-700 hover:bg-emerald-800' : ''}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString('en-US')} />
                <Legend />
                <Bar dataKey="Initial" fill="#059669" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Maintenance" fill="#d97706" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Values in {METRICS.find((m) => m.key === metric)!.unit}. Initial impacts occur once at construction;
            maintenance is scaled by the period of analysis (POA/60) and by the traffic factor for
            wear-sensitive elements (asphalt pavement, rail track) only.
          </p>
        </CardContent>
      </Card>

      {results.warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="mb-1 flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" /> Warnings</div>
          <ul className="list-disc pl-5">
            {results.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detailed breakdown ({results.items.length} matched groups)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto infraset-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/95 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">InfraSet element</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2 text-right">Initial GHG</th>
                  <th className="px-3 py-2 text-right">Maintenance GHG</th>
                  <th className="px-3 py-2 text-right">Initial mass</th>
                  <th className="px-3 py-2 text-right">Length</th>
                </tr>
              </thead>
              <tbody>
                {results.items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="whitespace-nowrap">{ASSET_TYPE_LABELS[it.asset_type] || it.asset_type}</Badge>
                      <div className="mt-0.5 text-xs text-muted-foreground">OSM: {it.osm_class}</div>
                    </td>
                    <td className="px-3 py-2">
                      {it.element_label}
                      <div className="text-xs text-muted-foreground">{it.element_key} · replacements/60y: {it.replacement_factor}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtNumber(it.qty, 0)} {it.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtGhg(it.initial_ghg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtGhg(it.maint_ghg)}
                      {it.tf_effective > 1 && (
                        <span className="ml-1 text-[10px] font-semibold text-amber-700">TF x{it.tf_effective}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMass(it.initial_mass / 1000)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtLength(it.length_m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Life cycle stage coverage: modules A1&ndash;A3 (product stage) and B2&ndash;B5 (maintenance and
        replacement), consistent with the InfraSet system boundary. End-of-life modules C1&ndash;C4 are
        outside the declared boundary. Results use the EPiC hybrid coefficients as embedded in the
        InfraSet database and are indicative for the selected study area.
      </p>
    </div>
  )
}
