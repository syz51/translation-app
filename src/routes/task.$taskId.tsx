import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileVideo,
  Loader2,
  XCircle,
} from 'lucide-react'
import type { LogEntry } from '@/types/extraction'
import { AppShell } from '@/components/app-shell'
import { LogViewer } from '@/components/log-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'

export const Route = createFileRoute('/task/$taskId')({
  component: TaskDetailsPage,
})

function TaskDetailsPage() {
  const { taskId } = Route.useParams()
  const navigate = useNavigate()
  const { state } = useExtraction()
  const { getTaskLogs } = useExtractionCommands()
  const [historicalLogs, setHistoricalLogs] = useState<Array<LogEntry>>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [now, setNow] = useState(Date.now())

  const task = state.tasks.find((entry) => entry.id === taskId)
  const isSubtitleTask = task
    ? task.fileName.toLowerCase().endsWith('.srt')
    : false
  const returnRoute = isSubtitleTask ? '/srt' : '/video'
  const stages = isSubtitleTask
    ? ['Queued', 'Translate', 'Done']
    : ['Queued', 'Extract', 'Transcribe', 'Translate', 'Done']

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await getTaskLogs(taskId)
        setHistoricalLogs(logs)
      } catch (error) {
        console.error('Failed to load logs:', error)
      } finally {
        setIsLoadingLogs(false)
      }
    }

    loadLogs()
  }, [getTaskLogs, taskId])

  useEffect(() => {
    if (
      task &&
      (task.status === 'processing' ||
        task.status === 'transcribing' ||
        task.status === 'translating')
    ) {
      const interval = setInterval(() => {
        setNow(Date.now())
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [task?.status])

  if (!task) {
    return (
      <AppShell active="task">
        <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8">
          <Button
            variant="outline"
            onClick={() => navigate({ to: '/' })}
            className="border-white/[0.08] bg-white/[0.03] text-white/[0.72] hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Button>
          <p className="display-type mt-8 text-4xl text-white">
            Task not found
          </p>
        </div>
      </AppShell>
    )
  }

  const statusMeta = (() => {
    switch (task.status) {
      case 'completed':
        return {
          label: 'Completed',
          icon: <CheckCircle2 className="h-4 w-4" />,
          badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
          step: stages.length - 1,
        }
      case 'failed':
        return {
          label: 'Failed',
          icon: <XCircle className="h-4 w-4" />,
          badge: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
          step: Math.max(1, stages.length - 2),
        }
      case 'processing':
        return {
          label: isSubtitleTask ? 'Preparing' : 'Extracting audio',
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          badge: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
          step: isSubtitleTask ? 0 : 1,
        }
      case 'transcribing':
        return {
          label: 'Transcribing',
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          badge: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
          step: 2,
        }
      case 'translating':
        return {
          label: 'Translating',
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          badge: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
          step: isSubtitleTask ? 1 : 3,
        }
      default:
        return {
          label: 'Queued',
          icon: isSubtitleTask ? (
            <FileText className="h-4 w-4" />
          ) : (
            <FileVideo className="h-4 w-4" />
          ),
          badge: 'border-white/[0.08] bg-white/[0.03] text-white/[0.7]',
          step: 0,
        }
    }
  })()

  const getDuration = () => {
    if (!task.startTime) return null
    const endTime = task.endTime || now
    const duration = Math.round((endTime - task.startTime) / 1000)
    return `${duration}s`
  }

  const allLogs = task.logs.length > 0 ? task.logs : historicalLogs

  return (
    <AppShell active="task">
      <div className="grid gap-6">
        <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 sm:p-8">
          <Button
            variant="outline"
            onClick={() => navigate({ to: returnRoute })}
            className="border-white/[0.08] bg-white/[0.03] text-white/[0.72] hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {isSubtitleTask ? 'SRT Lab' : 'Video Lab'}
          </Button>

          <div className="mt-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <p className="eyebrow-label text-white/[0.42]">
                Task Diagnostics
              </p>
              <h1 className="display-type mt-2 text-4xl break-words text-white sm:text-5xl">
                {task.fileName}
              </h1>
              <p className="mt-3 text-sm leading-6 break-all text-white/[0.58]">
                {task.filePath}
              </p>
            </div>

            <div className="rounded-[1.6rem] border border-white/[0.08] bg-black/[0.18] p-4">
              <Badge variant="outline" className={statusMeta.badge}>
                <span className="mr-1">{statusMeta.icon}</span>
                {statusMeta.label}
              </Badge>
              {getDuration() && (
                <p className="mt-3 text-sm text-white/[0.62]">
                  Runtime: {getDuration()}
                </p>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stages.map((stage, index) => {
              const isDone = task.status !== 'failed' && index < statusMeta.step
              const isActive =
                task.status !== 'failed' && index === statusMeta.step
              const isFailed =
                task.status === 'failed' && index === statusMeta.step

              const tone = isDone
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                : isActive
                  ? 'border-[#f7b32b]/30 bg-[#f7b32b]/10 text-white'
                  : isFailed
                    ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/[0.46]'

              return (
                <div
                  key={`${task.id}-${stage}`}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium ${tone}`}
                >
                  {stage}
                </div>
              )
            })}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
            <p className="eyebrow-label text-white/[0.42]">Task Metadata</p>
            <h2 className="display-type mt-1 text-3xl text-white">
              Everything needed to diagnose the run
            </h2>

            <div className="mt-6 grid gap-4 text-sm">
              <MetadataRow label="Task ID" value={task.id} mono />
              <MetadataRow label="Source file" value={task.filePath} mono />
              {task.outputPath && (
                <MetadataRow label="Output file" value={task.outputPath} mono />
              )}
              {task.transcriptPath && (
                <MetadataRow
                  label="Transcript file"
                  value={task.transcriptPath}
                  mono
                />
              )}
              {task.error && (
                <MetadataRow
                  label="Failure"
                  value={task.error}
                  accent="text-rose-200"
                />
              )}
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
            <p className="eyebrow-label text-white/[0.42]">Logs</p>
            <h2 className="display-type mt-1 text-3xl text-white">
              Event stream
            </h2>

            <div className="mt-6">
              {isLoadingLogs ? (
                <div className="rounded-[1.6rem] border border-white/[0.08] bg-black/[0.24] px-6 py-12 text-center">
                  <p className="text-sm text-white/[0.62]">Loading logs...</p>
                </div>
              ) : (
                <LogViewer logs={allLogs} />
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}

interface MetadataRowProps {
  label: string
  value: string
  mono?: boolean
  accent?: string
}

function MetadataRow({
  label,
  value,
  mono = false,
  accent = 'text-white/[0.76]',
}: MetadataRowProps) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/[0.18] px-4 py-4">
      <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
        {label}
      </p>
      <p
        className={`mt-3 text-sm leading-6 break-all ${accent} ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}
