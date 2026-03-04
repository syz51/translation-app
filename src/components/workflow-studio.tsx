import {
  AudioLines,
  FolderOutput,
  Languages,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { FileSelector } from '@/components/file-selector'
import { LanguageSelector } from '@/components/language-selector'
import { OutputFolderSelector } from '@/components/output-folder-selector'
import { ProgressSummary } from '@/components/progress-summary'
import { SrtFileSelector } from '@/components/srt-file-selector'
import { TaskList } from '@/components/task-list'
import { AppShell } from '@/components/app-shell'
import { useExtraction } from '@/context/extraction-context'

interface WorkflowStudioProps {
  mode: 'video' | 'srt'
}

const COPY = {
  video: {
    eyebrow: 'Video Pipeline',
    title: 'Transcribe once, ship polished subtitles in batches.',
    description:
      'Import source videos, extract speech, pass through transcription, and deliver translated subtitles without leaving the desktop app.',
    process: [
      'Drop videos',
      'Extract speech',
      'Transcribe remotely',
      'Deliver translated SRT',
    ],
    notes: [
      'Backend availability is checked before launch so long jobs fail early, not halfway through.',
      'The queue keeps failed items visible, which makes retries and diagnosis much faster.',
      'Recent output folders are remembered, reducing repetitive setup across sessions.',
    ],
  },
  srt: {
    eyebrow: 'SRT Pipeline',
    title: 'Turn subtitle revisions into a focused translation desk.',
    description:
      'Load finished SRT files, choose the delivery language, and manage translation output with the same queue and diagnostics used for larger batches.',
    process: [
      'Drop subtitle files',
      'Choose target language',
      'Translate in batches',
      'Export localized SRT',
    ],
    notes: [
      'Language selection is now a single-click decision instead of a generic dropdown.',
      'Queue filters make it easier to isolate failed files in large subtitle batches.',
      'The same detail view and logs stay available for post-run review.',
    ],
  },
} as const

export function WorkflowStudio({ mode }: WorkflowStudioProps) {
  const { state } = useExtraction()
  const copy = COPY[mode]

  const completedTasks = state.tasks.filter(
    (task) => task.status === 'completed',
  ).length
  const completionRate =
    state.tasks.length === 0
      ? '0%'
      : `${Math.round((completedTasks / state.tasks.length) * 100)}%`

  return (
    <AppShell active={mode}>
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
            <p className="eyebrow-label text-[var(--app-accent)]">
              {copy.eyebrow}
            </p>
            <h2 className="display-type mt-4 max-w-4xl text-4xl leading-tight text-white sm:text-5xl">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/[0.72] sm:text-lg">
              {copy.description}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {copy.process.map((step, index) => (
                <div
                  key={step}
                  className="rounded-3xl border border-white/10 bg-black/[0.18] p-4"
                >
                  <p className="text-xs font-semibold tracking-[0.24em] text-white/[0.42] uppercase">
                    Step {index + 1}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/80">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.75rem] border border-white/10 bg-black/[0.18] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.08] p-3 text-[var(--app-accent)]">
                  <AudioLines className="h-5 w-5" />
                </div>
                <div>
                  <p className="eyebrow-label text-white/[0.42]">Queue Depth</p>
                  <p className="mt-1 text-3xl font-semibold text-white">
                    {state.tasks.length}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/[0.68]">
                Built for multi-file work. The Rust backend processes up to four
                items in parallel.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/[0.18] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.08] p-3 text-[var(--app-highlight)]">
                  <FolderOutput className="h-5 w-5" />
                </div>
                <div>
                  <p className="eyebrow-label text-white/[0.42]">
                    Output Readiness
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-white">
                    {completionRate}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/[0.68]">
                Finished files keep a consistent naming pattern with language
                suffixes, which reduces manual cleanup after a batch.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-black/[0.18] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.08] p-3 text-[var(--app-success)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="eyebrow-label text-white/[0.42]">
                    Experience Gains
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    Faster triage, less repeated setup
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-white/[0.68]">
                {copy.notes.map((note) => (
                  <div
                    key={note}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(330px,0.8fr)_minmax(0,1.2fr)]">
          <div className="grid gap-6">
            {mode === 'video' ? <FileSelector /> : <SrtFileSelector />}

            {mode === 'srt' && <LanguageSelector />}

            <OutputFolderSelector />

            <ProgressSummary />
          </div>

          <div className="grid gap-6">
            <TaskList mode={mode} />

            <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/[0.08] p-3 text-[var(--app-accent)]">
                  {mode === 'video' ? (
                    <Sparkles className="h-5 w-5" />
                  ) : (
                    <Languages className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="eyebrow-label text-white/[0.42]">
                    Why This Layout
                  </p>
                  <h3 className="display-type mt-1 text-2xl text-white">
                    Built around actual operator behavior.
                  </h3>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm leading-6 text-white/[0.68]">
                <div className="rounded-2xl border border-white/[0.08] bg-black/[0.15] px-4 py-3">
                  Setup controls stay in one column, so users can scan readiness
                  from top to bottom without jumping between cards.
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/[0.15] px-4 py-3">
                  Queue controls now support search and status filtering, which
                  matters as soon as a batch grows beyond a handful of files.
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-black/[0.15] px-4 py-3">
                  The detail view remains available for deep diagnostics, but
                  the main workspace now answers most of the “what is happening
                  right now?” questions inline.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
