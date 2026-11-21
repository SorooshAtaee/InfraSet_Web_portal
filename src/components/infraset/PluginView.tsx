'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, Download, PackageOpen, TerminalSquare } from 'lucide-react'

const PLUGIN_VERSION = 'v2.0.0'
const LEGACY_VERSION = 'v0.2'
const LEGACY_URL = `/plugins/InfraSet_Grasshopper_plugin_${LEGACY_VERSION}.zip`

const RHINO_PACKAGES = [
  {
    rhino: 'Rhino 7',
    url: '/plugins/Infraset2_plugin_v2.0.0_Rhino7.zip',
  },
  {
    rhino: 'Rhino 9',
    url: '/plugins/Infraset2_plugin_v2.0.0_Rhino9.zip',
  },
]

const PACKAGE_CONTENTS = [
  { file: 'Infraset2.gha (Rhino 7) / Infraset2-rhino9.gha (Rhino 9)', desc: 'compiled Grasshopper assembly with the InfraSet components' },
  { file: 'infraset2-2.0.0-rh7_0-any.yak / infraset2-2.0.0-rh9_0-any.yak', desc: 'package for the Rhino Package Manager (yak)' },
  { file: 'Infraset2-source.zip', desc: 'complete C# source (Infraset2.sln, Infraset2.csproj)' },
]

const LEGACY_FILES = [
  'Infraset238.py',
  'Frontend_element_InfraSet.py',
  'Frontend_assembly_InfraSet.py',
  'Frontend_Infrastructure_InfraSet.py',
  'Result_InfraSet.py',
  'README.txt',
]

const COMPONENTS = [
  {
    name: 'InfraSet Element',
    file: 'Frontend_element_InfraSet.py',
    inputs: 'connect_button, element_category, No, element_data_list, wastage %, material_service_life (POA), energy/water/GHG reduction factors',
    outputs: 'Initial embodied energy, water, GHG; maintenance flows scaled by POA/60; mass by 8 material categories; full category breakdowns (initial + maintenance)',
  },
  {
    name: 'InfraSet Assembly',
    file: 'Frontend_assembly_InfraSet.py',
    inputs: 'assembly_category, No, dimensions (length, width, height or area), wastage %, POA, reduction factors, traffic_factor, PKT_million_60_years',
    outputs: 'Per-assembly embodied flows including Traffic Factor scaling on maintenance, normalisation per million passenger-kilometres (PKT)',
  },
  {
    name: 'InfraSet Infrastructure (aggregator)',
    file: 'Frontend_Infrastructure_InfraSet.py',
    inputs: 'up to 10 assembly/element data lists, energy/water/GHG reduction factors',
    outputs: 'Corridor-level totals with key-name normalisation across chained components (the extract_kv_lists() aggregation fix)',
  },
  {
    name: 'Result (CSV export)',
    file: 'Result_InfraSet.py',
    inputs: 'input_data (key-value panel), file_path, file_name',
    outputs: 'CSV file with Parameter / Value rows for every model output',
  },
]

const PARAMETERS = [
  ['No', 'Number of units of the element or assembly (e.g. number of light posts, m2 of pavement when combined with dimensions).'],
  ['Wastage coefficient (%)', 'Construction waste allowance added to initial quantities.'],
  ['Material service life / POA (years)', 'Period of analysis for the assessment (60-year reference). Maintenance scales by POA/60.'],
  ['Traffic Factor (TF)', 'Multiplier on maintenance for wear-sensitive elements (asphalt pavement, rail track). TF = 1 is the baseline.'],
  ['Energy / Water / GHG reduction factors (%)', 'Material-substitution or efficiency scenarios applied to the corresponding flow.'],
  ['PKT (million passenger-km / 60 y)', 'Optional functional-unit normalisation: results are divided by the passenger transport demand.'],
]

export default function PluginView() {
  return (
    <div className="max-w-6xl mx-auto px-4 pb-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">InfraSet Grasshopper Plugin</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The full InfraSet model runs as a parametric plugin inside Rhino/Grasshopper, built on
          IronPython (the Python environment embedded in Rhino). This page explains the
          requirements, the components and their parameters, and how to install the package.
        </p>
      </div>

      <Alert className="mb-6 border-emerald-300 bg-emerald-50 text-emerald-900">
        <Info className="h-4 w-4" />
        <AlertTitle>Download the plugin &mdash; Infraset2 ({PLUGIN_VERSION}) builds for Rhino 7 and Rhino 9</AlertTitle>
        <AlertDescription>
          Each ZIP bundles the compiled Grasshopper assembly (.gha), the matching yak package for
          the Rhino Package Manager and the full source code. The legacy GHPython package
          ({LEGACY_VERSION}) remains available further down this page. A public repository
          (GitHub / Food4Rhino) will follow the thesis release; until then this site hosts the
          official packages.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Requirements */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><TerminalSquare className="h-4 w-4 text-emerald-700" /> Requirements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Rhinoceros 7 or 9 (Windows or macOS) &mdash; download the package built for your Rhino version</li>
              <li>Grasshopper (bundled with Rhino)</li>
              <li>EPiC database coefficients are already embedded in the InfraSet material database</li>
            </ul>
            <p className="pt-2 text-xs">
              Note: the web tool on this site uses the same databases ported to CPython 3 &mdash;
              external geospatial libraries (OSMnx, GeoPandas) are not required inside Grasshopper
              because OSM extraction happens in the browser.
            </p>
          </CardContent>
        </Card>

        {/* Download card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Download className="h-4 w-4 text-emerald-700" /> Installation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Download the package built for your Rhino version below and unblock the ZIP before extracting (Windows: right-click &rarr; Properties &rarr; Unblock).</li>
              <li>
                Install the assembly: double-click the <code className="rounded bg-muted px-1 py-0.5 text-xs">.gha</code> file
                (Windows) or copy it into your Grasshopper <em>Libraries</em> folder
                (<code className="rounded bg-muted px-1 py-0.5 text-xs">%APPDATA%\Grasshopper\Libraries</code> on
                Windows; the Grasshopper Libraries folder under{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">~/Library/Application Support/McNeel</code> on macOS),
                then restart Rhino.
              </li>
              <li>
                Alternatively, install the bundled yak package from the command line:{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">yak install infraset2-2.0.0-rh7_0-any.yak</code>{' '}
                (Rhino 7) or{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">yak install infraset2-2.0.0-rh9_0-any.yak</code> (Rhino 9).
              </li>
              <li>
                Open Grasshopper: the InfraSet components appear on the <strong>InfraSet</strong> tab
                (or search for &ldquo;InfraSet&rdquo; in the component palette).
              </li>
              <li>
                The component and parameter references below document the InfraSet model
                (Element, Assembly, Infrastructure aggregator, Result) included in every package.
              </li>
            </ol>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {RHINO_PACKAGES.map((p) => (
                <Button key={p.rhino} asChild className="bg-emerald-700 hover:bg-emerald-800">
                  <a href={p.url} download title={`Download InfraSet plugin ${PLUGIN_VERSION} for ${p.rhino}`}>
                    <PackageOpen className="mr-2 h-4 w-4" />
                    Download for {p.rhino} ({PLUGIN_VERSION})
                  </a>
                </Button>
              ))}
              <Button asChild variant="outline">
                <a href="#tool" title="Open the OSM-based web tool">Open the web tool</a>
              </Button>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Package contents (each ZIP)
              </p>
              <ul className="space-y-1.5">
                {PACKAGE_CONTENTS.map((f) => (
                  <li key={f.file} className="flex flex-col gap-0.5 text-xs text-muted-foreground sm:flex-row sm:items-baseline sm:gap-2">
                    <code className="shrink-0 rounded bg-background px-1 py-0.5 font-mono text-foreground">{f.file}</code>
                    <span>{f.desc}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                <Download className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Unblock the ZIP before extracting (Windows: right-click &rarr; Properties &rarr; Unblock).
              </p>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Legacy package ({LEGACY_VERSION} &mdash; original GHPython components)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The first release, run from GHPython scripts (IronPython 2.7, built into Rhino):{' '}
                <code className="rounded bg-background px-1 py-0.5 font-mono">{LEGACY_FILES.join(', ')}</code>
              </p>
              <Button asChild variant="outline" className="mt-2">
                <a href={LEGACY_URL} download title={`Download legacy InfraSet plugin package ${LEGACY_VERSION}`}>
                  <Download className="mr-2 h-4 w-4" />
                  Download legacy package ({LEGACY_VERSION}, ZIP)
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component reference */}
      <h3 className="mb-3 mt-10 text-xl font-bold">Component reference</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {COMPONENTS.map((c) => (
          <Card key={c.name} className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{c.name}</CardTitle>
              <Badge variant="secondary" className="w-fit font-mono text-[11px]">{c.file}</Badge>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-emerald-800">Inputs:</span>{' '}
                <span className="text-muted-foreground">{c.inputs}</span>
              </div>
              <div>
                <span className="font-semibold text-emerald-800">Outputs:</span>{' '}
                <span className="text-muted-foreground">{c.outputs}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Parameter reference */}
      <h3 className="mb-3 mt-10 text-xl font-bold">Parameter reference</h3>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3">Parameter</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {PARAMETERS.map(([k, d]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="px-4 py-3 align-top font-medium">{k}</td>
                  <td className="px-4 py-3 align-top text-muted-foreground">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <h3 className="mb-3 mt-10 text-xl font-bold">System boundary</h3>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        The model covers modules A1&ndash;A3 (product stage) and B2&ndash;B5 (maintenance and
        replacement) of EN 15978. Operational energy modules (B6) and end-of-life modules
        (C1&ndash;C4) are outside the declared system boundary. Operational flows embedded in the
        element database (e.g. lighting electricity for light posts) are included where defined.
      </p>
    </div>
  )
}
