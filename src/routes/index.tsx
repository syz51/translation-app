import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  AudioLines,
  FileText,
  FolderOutput,
  Video,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { useExtraction } from '@/context/extraction-context'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  const { state } = useExtraction()

  return (
    <AppShell active="home">
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
            <p className="eyebrow-label text-[var(--app-accent)]">
              Desktop UX Redesign
            </p>
            <h2 className="display-type mt-4 max-w-4xl text-4xl leading-tight text-white sm:text-6xl">
              A calmer, denser control surface for subtitle work.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/[0.72] sm:text-lg">
              The new layout treats this like an operations tool, not a
              marketing page. Workflow choice, queue state, and task recovery
              stay visible from the first screen onward.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Link
                to="/video"
                className="rounded-[1.8rem] border border-white/10 bg-black/[0.18] p-6 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-3xl bg-white/[0.08] p-4 text-[var(--app-accent)]">
                    <Video className="h-8 w-8" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/40" />
                </div>
                <h3 className="display-type mt-6 text-3xl text-white">
                  Video Lab
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/[0.68]">
                  Run the full pipeline from source footage to translated
                  subtitles, with backend health and batch readiness surfaced up
                  front.
                </p>
                <div className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">
                  Open Video Workflow
                </div>
              </Link>

              <Link
                to="/srt"
                className="rounded-[1.8rem] border border-white/10 bg-black/[0.18] p-6 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-3xl bg-white/[0.08] p-4 text-[var(--app-highlight)]">
                    <FileText className="h-8 w-8" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-white/40" />
                </div>
                <h3 className="display-type mt-6 text-3xl text-white">
                  SRT Lab
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/[0.68]">
                  Move quickly through subtitle-only jobs with direct language
                  selection and a queue that is easier to filter and inspect.
                </p>
                <div className="mt-6 inline-flex h-10 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-6 text-sm font-medium text-white">
                  Open SRT Workflow
                </div>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-black/[0.18] p-6">
              <p className="eyebrow-label text-white/[0.42]">Current Session</p>
              <p className="mt-3 text-4xl font-semibold text-white">
                {state.tasks.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/[0.68]">
                Tasks already in memory. You can jump directly into a workflow
                without losing the current queue.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/[0.18] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.08] p-3 text-[var(--app-accent)]">
                  <AudioLines className="h-5 w-5" />
                </div>
                <div>
                  <p className="eyebrow-label text-white/[0.42]">
                    New Experience
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    Desktop-first orchestration
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm leading-6 text-white/[0.68]">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  Persistent left rail gives users a stable way to switch
                  workflows without losing orientation.
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  Searchable queues cut down the time needed to find a single
                  failed item in larger batches.
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  Readiness checks are visible before launch, which matches how
                  users assess risk before committing to long jobs.
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/[0.18] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.08] p-3 text-[var(--app-success)]">
                  <FolderOutput className="h-5 w-5" />
                </div>
                <div>
                  <p className="eyebrow-label text-white/[0.42]">
                    Design Intent
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    Reduce uncertainty, not just clutter
                  </p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-white/[0.68]">
                This redesign focuses on the moments that matter most in a real
                desktop tool: setting up quickly, seeing whether the system is
                ready, tracking progress across many files, and diagnosing
                exceptions without digging around the UI.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
