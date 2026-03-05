import {
  CheckCircle2,
  Clock,
  Languages,
  Loader2,
  Play,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useMatch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useExtraction } from '@/context/extraction-context'
import { env } from '@/env'
import { useBackendHealth } from '@/hooks/use-backend-health'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'
import { useSrtTranslationCommands } from '@/hooks/use-srt-translation-commands'

export const ProgressSummary = memo(function ProgressSummary() {
  const { state, dispatch } = useExtraction()
  const { startExtraction } = useExtractionCommands()
  const { startTranslation } = useSrtTranslationCommands()
  const [targetLanguage, setTargetLanguage] =
    useState<string>('Chinese Simplified')

  const isSrtFlow = !!useMatch({ from: '/srt', shouldThrow: false })
  const isVideoFlow = !!useMatch({ from: '/video', shouldThrow: false })
  const backendHealth = useBackendHealth(isVideoFlow)

  const taskCounts = useMemo(() => {
    const counts = {
      total: state.tasks.length,
      completed: 0,
      failed: 0,
      processing: 0,
      transcribing: 0,
      translating: 0,
      pending: 0,
    }

    for (const task of state.tasks) {
      switch (task.status) {
        case 'completed':
          counts.completed++
          break
        case 'failed':
          counts.failed++
          break
        case 'processing':
          counts.processing++
          break
        case 'transcribing':
          counts.transcribing++
          break
        case 'translating':
          counts.translating++
          break
        case 'pending':
          counts.pending++
          break
      }
    }

    return counts
  }, [state.tasks])

  const canStart =
    taskCounts.total > 0 &&
    !!state.outputFolder &&
    !state.isProcessing &&
    taskCounts.pending > 0 &&
    (isSrtFlow ? !!state.targetLanguage : true) &&
    (isVideoFlow ? backendHealth.isHealthy : true)

  const readiness = [
    {
      label: 'Files queued',
      description:
        taskCounts.total > 0
          ? `${taskCounts.total} items ready`
          : 'Add files to build a batch',
      ready: taskCounts.total > 0,
    },
    {
      label: 'Output folder',
      description: state.outputFolder || 'No destination selected',
      ready: !!state.outputFolder,
    },
    isSrtFlow
      ? {
          label: 'Language',
          description: state.targetLanguage || 'Choose a target language',
          ready: !!state.targetLanguage,
        }
      : {
          label: 'Backend health',
          description: backendHealth.isChecking
            ? 'Checking transcription backend'
            : backendHealth.isHealthy
              ? 'Transcription backend connected'
              : backendHealth.error || 'Backend unavailable',
          ready: backendHealth.isHealthy,
        },
  ]

  const handleStart = useCallback(async () => {
    if (!canStart || !state.outputFolder) return

    dispatch({ type: 'START_PROCESSING' })

    try {
      if (isSrtFlow && state.targetLanguage) {
        await startTranslation(
          state.tasks.map((task) => ({
            taskId: task.id,
            filePath: task.filePath,
          })),
          state.outputFolder,
          state.targetLanguage,
        )
      } else if (isVideoFlow) {
        await startExtraction(state.tasks, state.outputFolder, targetLanguage)
      }
    } catch (error) {
      state.tasks
        .filter((task) => task.status === 'pending')
        .forEach((task) => {
          dispatch({
            type: 'TASK_FAILED',
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          })
        })

      dispatch({ type: 'STOP_PROCESSING' })

      alert(
        `Failed to start processing: ${error instanceof Error ? error.message : String(error)}\n\nPlease check backend is running at ${env.VITE_BACKEND_URL}`,
      )
    }
  }, [
    canStart,
    dispatch,
    isSrtFlow,
    isVideoFlow,
    startExtraction,
    startTranslation,
    state.outputFolder,
    state.targetLanguage,
    state.tasks,
    targetLanguage,
  ])

  const handleClearCompleted = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED' })
  }, [dispatch])

  return (
    <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="eyebrow-label text-white/[0.42]">Launch Console</p>
            <h3 className="display-type mt-1 text-3xl text-white">
              Review readiness before committing the batch
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/[0.68]">
              This panel stays visible even when the queue is empty, so the user
              always knows what is blocking the next run.
            </p>
          </div>

          {isVideoFlow && (
            <div className="rounded-3xl border border-white/[0.08] bg-black/[0.18] p-4 xl:min-w-72">
              <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
                Video Output Language
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Languages className="h-4 w-4 text-[var(--app-accent)]" />
                <Select
                  value={targetLanguage}
                  onValueChange={setTargetLanguage}
                  disabled={state.isProcessing}
                >
                  <SelectTrigger className="h-11 border-white/[0.08] bg-black/[0.25] text-white">
                    <SelectValue placeholder="Select target language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chinese Simplified">
                      Chinese Simplified (简体中文)
                    </SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readiness.map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-white/[0.08] bg-black/[0.18] p-4"
            >
              <div className="flex items-center gap-3">
                {item.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-300" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-white/[0.52]">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            icon={<Clock className="h-4 w-4 text-white/[0.6]" />}
            label="Pending"
            value={taskCounts.pending}
          />
          <MetricCard
            icon={<Play className="h-4 w-4 text-sky-300" />}
            label="Extracting"
            value={taskCounts.processing}
          />
          <MetricCard
            icon={<Loader2 className="h-4 w-4 text-indigo-300" />}
            label="Transcribing"
            value={taskCounts.transcribing}
          />
          <MetricCard
            icon={<Languages className="h-4 w-4 text-amber-200" />}
            label="Translating"
            value={taskCounts.translating}
          />
          <MetricCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-300" />}
            label="Completed"
            value={taskCounts.completed}
          />
          <MetricCard
            icon={<XCircle className="h-4 w-4 text-rose-300" />}
            label="Failed"
            value={taskCounts.failed}
          />
        </div>

        {isVideoFlow && (
          <div className="rounded-3xl border border-white/[0.08] bg-black/[0.18] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {backendHealth.isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white/[0.56]" />
                  <span className="text-white/[0.66]">
                    Checking transcription backend...
                  </span>
                </>
              ) : backendHealth.isHealthy ? (
                <>
                  <Wifi className="h-4 w-4 text-emerald-300" />
                  <span className="text-emerald-200">
                    Backend connected and ready for long-running jobs.
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-rose-300" />
                  <span className="text-rose-200">
                    {backendHealth.error || 'Backend unavailable'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={handleStart}
            disabled={!canStart}
            size="lg"
            className="sm:min-w-72"
          >
            {state.isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : isSrtFlow ? (
              'Start Translation'
            ) : (
              'Start Full Video Pipeline'
            )}
          </Button>

          {taskCounts.completed > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleClearCompleted}
              disabled={state.isProcessing}
              className="border-white/[0.08] bg-white/[0.03] text-white/[0.72] hover:bg-white/[0.08] hover:text-white"
            >
              Clear Completed
            </Button>
          )}
        </div>
      </div>
    </section>
  )
})

interface MetricCardProps {
  icon: ReactNode
  label: string
  value: number
}

function MetricCard({ icon, label, value }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/[0.18] p-4">
      <div className="flex items-center gap-2 text-sm text-white/[0.62]">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}
