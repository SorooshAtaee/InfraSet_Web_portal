'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Puzzle, Wrench, LayoutDashboard } from 'lucide-react'
import AboutView from '@/components/infraset/AboutView'
import PluginView from '@/components/infraset/PluginView'
import ToolView from '@/components/infraset/ToolView'

type ViewKey = 'about' | 'plugin' | 'tool'

const VIEWS: { key: ViewKey; label: string; short: string; icon: typeof LayoutDashboard }[] = [
  { key: 'about', label: 'About the project', short: 'About', icon: LayoutDashboard },
  { key: 'plugin', label: 'Plugin download', short: 'Plugin', icon: Puzzle },
  { key: 'tool', label: 'Web tool', short: 'Tool', icon: Wrench },
]

function viewFromHash(): ViewKey {
  const h = window.location.hash.replace('#', '')
  return h === 'plugin' || h === 'tool' ? (h as ViewKey) : 'about'
}

export default function Home() {
  const [view, setView] = useState<ViewKey>('about')

  useEffect(() => {
    const sync = () => setView(viewFromHash())
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  const go = (key: ViewKey) => {
    window.location.hash = key
    setView(key)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-[1000] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <button
            onClick={() => go('about')}
            className="flex items-center gap-2.5"
            aria-label="InfraSet home"
          >
            <Image
              src="/logo.png"
              alt="InfraSet logo"
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-lg bg-white shadow-sm ring-1 ring-border"
            />
            <span className="text-left">
              <span className="block text-sm font-bold leading-tight">InfraSet</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                LCA &amp; MFA for transport infrastructure
              </span>
            </span>
          </button>
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            {VIEWS.map((v) => {
              const active = view === v.key
              return (
                <button
                  key={v.key}
                  onClick={() => go(v.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <v.icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{v.label}</span>
                  <span className="sm:hidden">{v.short}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-8">
        {view === 'about' && <AboutView />}
        {view === 'plugin' && <PluginView />}
        {view === 'tool' && <ToolView />}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <p>
            InfraSet &mdash; A parametric Life Cycle Assessment and Material Flow Analysis model
            for Transport Infrastructure Assets. PhD research by Soroosh Ataee, Universit&eacute;
            catholique de Louvain.
          </p>
          <p>Map data &copy; OpenStreetMap contributors &middot; results are indicative</p>
        </div>
      </footer>
    </div>
  )
}
