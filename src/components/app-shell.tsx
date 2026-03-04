import { Link } from '@tanstack/react-router'
import { Activity, FileText, Home, Star, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { useExtraction } from '@/context/extraction-context'
import { cn } from '@/lib/utils'

type AppSection = 'home' | 'video' | 'srt' | 'task'

interface AppShellProps {
  active: AppSection
  children: ReactNode
}

const NAV_ITEMS = [
  { id: 'home', label: 'Overview', to: '/', icon: Home },
  { id: 'video', label: 'Video Lab', to: '/video', icon: Video },
  { id: 'srt', label: 'SRT Lab', to: '/srt', icon: FileText },
] as const

export function AppShell({ active, children }: AppShellProps) {
  const { state } = useExtraction()

  const activeTasks = state.tasks.filter(
    (task) =>
      task.status === 'processing' ||
      task.status === 'transcribing' ||
      task.status === 'translating',
  ).length

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,179,43,0.16),transparent_34%),radial-gradient(circle_at_85%_12%,rgba(72,187,174,0.16),transparent_26%),linear-gradient(135deg,rgba(7,17,26,0.92),rgba(10,24,38,0.98))]" />
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:36px_36px] opacity-[0.08]" />

      <div className="relative mx-auto flex min-h-screen max-w-[1720px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="glass-panel flex shrink-0 flex-col gap-5 rounded-[2rem] p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72 lg:p-5">
          <div className="flex items-start justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
            <div>
              <p className="eyebrow-label text-[var(--app-accent)]">
                Subtitle Suite
              </p>
              <h1 className="display-type mt-2 text-2xl">Control Room</h1>
              <p className="mt-2 text-sm text-white/[0.72]">
                Desktop-first batching for transcription and subtitle delivery.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.12] bg-white/[0.08] p-3 text-[var(--app-accent)]">
              <Star className="h-5 w-5" />
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id

              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={cn(
                    'flex min-w-fit items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all lg:min-w-0',
                    isActive
                      ? 'border-[#f7b32b]/40 bg-[linear-gradient(135deg,rgba(247,179,43,0.18),rgba(247,179,43,0.08))] text-white shadow-[0_12px_28px_rgba(247,179,43,0.18)]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="grid gap-3 lg:mt-auto">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Activity className="h-4 w-4 text-[var(--app-success)]" />
                <span>Session Pulse</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-white/[0.55]">Queued</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {state.tasks.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/[0.55]">Live</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {activeTasks}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 text-sm text-white/[0.68]">
              <p className="eyebrow-label text-white/[0.42]">Workflow Notes</p>
              <p className="mt-3">
                Queue files in bulk, keep an eye on health checks, then inspect
                failures without losing their logs.
              </p>
            </div>
          </div>
        </aside>

        <main className="glass-panel flex-1 rounded-[2rem] p-4 sm:p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
