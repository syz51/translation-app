import {
  CheckCircle2,
  Eye,
  FileText,
  FileVideo,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { memo, useCallback, useEffect, useState } from 'react'
import type { ExtractionTask } from '@/types/extraction'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'

interface TaskItemProps {
  task: ExtractionTask
}

type StageTone = 'future' | 'done' | 'active' | 'failed'

const VIDEO_STAGES = ['Queued', 'Extract', 'Transcribe', 'Translate', 'Done']
const SRT_STAGES = ['Queued', 'Translate', 'Done']

export const TaskItem = memo(function TaskItem({ task }: TaskItemProps) {
  const { dispatch } = useExtraction()
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())

  const isSubtitleTask = task.fileName.toLowerCase().endsWith('.srt')
  const stages = isSubtitleTask ? SRT_STAGES : VIDEO_STAGES

  useEffect(() => {
    if (
      task.status === 'processing' ||
      task.status === 'transcribing' ||
      task.status === 'translating'
    ) {
      const interval = setInterval(() => {
        setNow(Date.now())
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [task.status])

  const getDuration = () => {
    if (!task.startTime) return null
    const endTime = task.endTime || now
    const duration = Math.round((endTime - task.startTime) / 1000)
    return `${duration}s`
  }

  const handleRemove = useCallback(() => {
    if (
      task.status !== 'processing' &&
      task.status !== 'transcribing' &&
      task.status !== 'translating'
    ) {
      dispatch({ type: 'REMOVE_TASK', taskId: task.id })
    }
  }, [dispatch, task.id, task.status])

  const handleViewDetails = useCallback(() => {
    navigate({ to: '/task/$taskId', params: { taskId: task.id } })
  }, [navigate, task.id])

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
          badge: 'border-white/10 bg-white/[0.04] text-white/70',
          step: 0,
        }
    }
  })()

  const getStageTone = (index: number): StageTone => {
    if (task.status === 'failed') {
      if (index < statusMeta.step) return 'done'
      if (index === statusMeta.step) return 'failed'
      return 'future'
    }

    if (index < statusMeta.step) return 'done'
    if (index === statusMeta.step) return 'active'
    return 'future'
  }

  const primaryPath = task.outputPath || task.transcriptPath
  const primaryPathLabel =
    task.status === 'completed'
      ? 'Output'
      : task.transcriptPath
        ? 'Transcript'
        : 'Source'

  return (
    <article className="rounded-[1.6rem] border border-white/[0.08] bg-black/[0.18] p-5 transition-colors hover:border-white/[0.14]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div className="rounded-3xl border border-white/[0.08] bg-white/[0.05] p-3 text-white/[0.78]">
                {isSubtitleTask ? (
                  <FileText className="h-5 w-5" />
                ) : (
                  <FileVideo className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-white">
                  {task.fileName}
                </p>
                <p className="mt-1 truncate text-sm text-white/[0.5]">
                  {task.filePath}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusMeta.badge}>
                    <span className="mr-1">{statusMeta.icon}</span>
                    {statusMeta.label}
                  </Badge>
                  {getDuration() && (
                    <Badge
                      variant="outline"
                      className="border-white/[0.08] bg-white/[0.03] text-white/[0.68]"
                    >
                      {getDuration()}
                    </Badge>
                  )}
                  {task.targetLanguage && (
                    <Badge
                      variant="outline"
                      className="border-white/[0.08] bg-white/[0.03] text-white/[0.68]"
                    >
                      {task.targetLanguage}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDetails}
              className="rounded-full border-white/[0.08] bg-white/[0.03] text-white/[0.72] hover:bg-white/[0.08] hover:text-white"
            >
              <Eye className="h-4 w-4" />
              Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={
                task.status === 'processing' ||
                task.status === 'transcribing' ||
                task.status === 'translating'
              }
              className="rounded-full border-white/[0.08] bg-white/[0.03] text-white/[0.72] hover:bg-white/[0.08] hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stages.map((stage, index) => {
            const tone = getStageTone(index)
            const className =
              tone === 'done'
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                : tone === 'active'
                  ? 'border-[#f7b32b]/30 bg-[#f7b32b]/10 text-white'
                  : tone === 'failed'
                    ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/[0.48]'

            return (
              <div
                key={`${task.id}-${stage}`}
                className={`rounded-2xl border px-3 py-3 text-sm font-medium ${className}`}
              >
                {stage}
              </div>
            )
          })}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div>
            {task.error ? (
              <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">
                {task.error}
              </p>
            ) : (
              <p className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/[0.66]">
                {primaryPathLabel}: {primaryPath || task.filePath}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
})
