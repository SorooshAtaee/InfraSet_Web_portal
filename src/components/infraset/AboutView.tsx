'use client'

import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Building2, GitBranch, Layers, LineChart, Route, Signal, TrainFront, Truck,
} from 'lucide-react'

const CASE_STUDIES = [
  {
    name: 'Boulevard du Souverain',
    place: 'Brussels, Belgium',
    stage: 'Verification & validation',
    text: 'Pilot case on a 1 km urban section used to verify computational accuracy against manual BoQ assessments and validate against published peer-reviewed data.',
  },
  {
    name: 'Louvain-la-Neuve\u2013Brussels railway corridor',
    place: 'Belgium (Infrabel Line 161)',
    stage: 'Validation & scenario testing',
    text: 'Validating model outputs against real-world as-built Bills of Quantities and testing traffic and service-life scenarios on the Belgian railway.',
  },
  {
    name: 'Bell\u2013Moreland Level Crossing Removal Project',
    place: 'Melbourne, Australia',
    stage: 'Validation & scenario testing',
    text: 'Validating the tool in a complex, multi-modal road\u2013rail interface (Upfield line, Coburg\u2013Moreland) and testing traffic / service-life scenarios.',
  },
]

const PUBLICATIONS = [
  {
    text: 'Ataee, S. & Stephan, A. (under review). A multi-scale, bottom-up parametric tool for an integrated material flow analysis and life cycle assessment of transport infrastructure assets.',
    venue: 'Journal of Industrial Ecology',
  },
  {
    text: 'Ataee, S. & Stephan, A. (2025). Life cycle assessment and material flow analysis of road and rail infrastructure assets \u2013 A critical review.',
    venue: 'Cleaner Environmental Systems \u2014 doi.org/10.1016/j.cesys.2025.100259',
  },
  {
    text: 'Ataee, S. & Stephan, A. (2025). InfraSet Grasshopper: A Parametric Tool for Integrated LCA and MFA.',
    venue: 'Proceedings of the Architectural Science Association (ASA) Conference',
  },
  {
    text: 'Ataee, S. & Stephan, A. (2022). Improving the life cycle greenhouse gas emissions of transport infrastructure assets \u2013 a case study in Brussels, Belgium.',
    venue: 'IOP Conference Series: Earth and Environmental Science, 1122, 012029',
  },
]

export default function AboutView() {
  return (
    <div className="max-w-6xl mx-auto px-4 pb-16">
      {/* Hero */}
      <section className="rounded-xl border bg-gradient-to-br from-emerald-50 via-background to-background p-8 shadow-sm">
        <Badge className="bg-emerald-700 hover:bg-emerald-700">PhD research project &middot; UCLouvain</Badge>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Image
            src="/logo.png"
            alt="InfraSet logo: circular map encircled by arrows, with a location pin"
            width={96}
            height={96}
            priority
            className="h-20 w-20 shrink-0 rounded-xl bg-white shadow-sm ring-1 ring-border"
          />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            InfraSet
            <span className="mt-2 block text-lg font-medium text-muted-foreground sm:text-xl">
              A parametric Life Cycle Assessment and Material Flow Analysis model for
              Transport Infrastructure Assets
            </span>
          </h1>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed sm:text-base">
          InfraSet is a bottom-up, multi-scale parametric framework for assessing the embodied
          environmental flows and material stocks of transport infrastructure assets (TIAs) &mdash;
          roads, railways, tramways, bicycle paths, pedestrian systems and their ancillary
          components. It is developed by <strong>Soroosh Ataee</strong> at the Faculty of
          Architecture, Architectural Engineering and Urban Planning, Universit&eacute; catholique
          de Louvain, under the supervision of <strong>Prof. Andr&eacute; Stephan</strong> and{' '}
          <strong>Prof. Sergio Altomonte</strong>, and implemented as a Rhino/Grasshopper plugin
          grounded in the hybrid <strong>EPiC database</strong>.
        </p>
      </section>

      {/* What it does */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">What InfraSet does</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Existing LCA studies of infrastructure are often fragmented, rely on truncated
          process-based data, and ignore real-world operational dynamics such as traffic-induced
          degradation. InfraSet addresses these gaps by structuring infrastructure hierarchically
          and testing scenarios dynamically.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Layers,
              title: 'Nested multi-scale structure',
              text: 'Materials \u2192 elements \u2192 assemblies \u2192 full corridors, with aggregation of mass, embodied energy, water and GHG at every scale.',
            },
            {
              icon: Signal,
              title: 'Traffic Factor (TF)',
              text: 'Traffic-induced degradation is embedded structurally: wear-sensitive maintenance pathways (e.g. asphalt pavement, rail track) scale with traffic intensity.',
            },
            {
              icon: LineChart,
              title: 'Dynamic scenario testing',
              text: 'Period of analysis, service lives, replacement indices, material substitution and wastage/reduction factors are user-controlled parameters.',
            },
            {
              icon: Route,
              title: 'GIS & OSM integration',
              text: 'Roads, railways and ancillary assets are located and quantified from geospatial data \u2014 this web tool queries OpenStreetMap live and assigns features to the InfraSet element database.',
            },
            {
              icon: GitBranch,
              title: 'Hybrid LCA foundation',
              text: 'EPiC hybrid coefficients avoid truncation error of process-based inventories while keeping input data requirements explicit and transparent.',
            },
            {
              icon: Building2,
              title: 'Verified against as-built projects',
              text: 'Achieved \u224895\u201399% alignment with as-built material quantities across two real-world case studies (Belgium and Australia).',
            },
          ].map((f) => (
            <Card key={f.title} className="h-full">
              <CardHeader className="pb-2">
                <f.icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.text}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Key findings */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Key findings from the case studies</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold text-emerald-800">&times;1.96</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Extending the analysis period of replacement-sensitive elements from 60 to 120 years
                raises cumulative maintenance burdens in the Australian case &mdash; while lowering
                annualised maintenance intensity.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold text-emerald-800">+69.4% vs +1.15%</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Under a traffic-doubling scenario (TF&nbsp;=&nbsp;2), maintenance GHG rose by 69.4%
                in the Belgian railway case but only 1.15% in the Australian road&ndash;rail case &mdash;
                a contrast explained by infrastructure composition, material intensity and
                traffic-sensitive maintenance assumptions.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-2xl font-bold text-emerald-800">&gt;50%</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Metals and concrete dominate the initial embodied impacts: metals account for less
                than a tenth of the mass but drive over half of initial embodied GHG emissions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Case studies */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Case studies</h2>
        <div className="mt-4 space-y-4">
          {CASE_STUDIES.map((cs) => (
            <Card key={cs.name}>
              <CardContent className="flex flex-col gap-1 pt-5 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex gap-2 pt-0.5">
                  {cs.name.includes('railway') ? (
                    <TrainFront className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <Truck className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{cs.name}</h3>
                    <Badge variant="outline">{cs.stage}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{cs.place}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{cs.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* This portal */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">About this web portal</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          This portal complements the Grasshopper plugin. The <strong>Web Tool</strong> page
          connects the InfraSet calculation engine (Python, ported from the plugin&rsquo;s
          material and element databases) to live OpenStreetMap data: it extracts roads, railways,
          tramways, platforms, stations and ancillary assets &mdash; light posts, sign posts,
          bollards, level crossings &mdash; inside your selected study area, assigns each feature
          group to an InfraSet element, lets you review quantities and set scenario parameters
          (period of analysis, traffic factor, wastage, reduction factors), and computes the
          initial and maintenance life cycle flows with charts and CSV export. The{' '}
          <strong>Plugin</strong> page documents how to install and use the full Rhino/Grasshopper
          version for geometry-based assessments.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['OpenStreetMap', 'Road / rail / ancillary extraction via Overpass API, matched by class to InfraSet element recipes'],
            ['Python engine', 'Material & element databases ported from Infraset238; thesis equations incl. TF and POA scaling'],
            ['User control', 'Every matching assumption, quantity and scenario parameter is editable before calculation'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border bg-muted/40 p-4">
              <div className="font-semibold text-sm">{t}</div>
              <div className="mt-1 text-xs text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Publications */}
      <section className="mt-10">
        <h2 className="text-xl font-bold">Publications produced during this PhD</h2>
        <div className="mt-4 space-y-3">
          {PUBLICATIONS.map((p, i) => (
            <div key={i} className="rounded-lg border p-4">
              <p className="text-sm leading-relaxed">{p.text}</p>
              <p className="mt-1 text-xs italic text-muted-foreground">{p.venue}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-10" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Doctor in Engineering Sciences thesis, submitted September 2026. Funded by the Fonds
        Sp&eacute;cial de Recherche (FSR) and the Fonds de la Recherche Scientifique (FNRS).
        The InfraSet web tool is a companion demonstrator: results are indicative and use the
        EPiC-derived coefficients embedded in the InfraSet database; EPiC database data is
        licensed by The University of Melbourne and is not redistributed here.
      </p>
    </div>
  )
}
