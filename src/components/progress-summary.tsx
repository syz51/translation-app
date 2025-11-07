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
import { useMatch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'
import { useSrtTranslationCommands } from '@/hooks/use-srt-translation-commands'
import { useBackendHealth } from '@/hooks/use-backend-health'
import { env } from '@/env'

export const ProgressSummary = memo(function ProgressSummary() {
  const { state, dispatch } = useExtraction()
  const { startExtraction } = useExtractionCommands()
  const { startTranslation } = useSrtTranslationCommands()
  const [targetLanguage, setTargetLanguage] =
    useState<string>('Chinese Simplified')

  // Detect current route using useMatch (more efficient than router.state)
  const isSrtFlow = !!useMatch({ from: '/srt', shouldThrow: false })
  const isVideoFlow = !!useMatch({ from: '/video', shouldThrow: false })

  // Check backend health for video workflow only when needed
  const backendHealth = useBackendHealth(isVideoFlow && state.tasks.length > 0)

  // Memoize task counts to avoid recalculation on every render
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

  const {
    total: totalTasks,
    completed: completedTasks,
    failed: failedTasks,
    processing: processingTasks,
    transcribing: transcribingTasks,
    translating: translatingTasks,
    pending: pendingTasks,
  } = taskCounts

  // For SRT flow, also require target language
  // For video flow, require backend to be healthy
  const canStart =
    totalTasks > 0 &&
    state.outputFolder &&
    !state.isProcessing &&
    pendingTasks > 0 &&
    (isSrtFlow ? !!state.targetLanguage : true) &&
    (isVideoFlow ? backendHealth.isHealthy : true)

  const handleStart = useCallback(async () => {
    console.log('[ProgressSummary] Button clicked', {
      canStart,
      isSrtFlow,
      totalTasks,
      outputFolder: state.outputFolder,
      targetLanguage: state.targetLanguage,
      pendingTasks,
      isProcessing: state.isProcessing,
    })

    if (!canStart || !state.outputFolder) return

    dispatch({ type: 'START_PROCESSING' })
    try {
      if (isSrtFlow && state.targetLanguage) {
        // SRT translation flow
        console.log('[ProgressSummary] Starting SRT translation', {
          tasks: state.tasks.map((t) => ({
            taskId: t.id,
            filePath: t.filePath,
          })),
          outputFolder: state.outputFolder,
          targetLanguage: state.targetLanguage,
        })
        await startTranslation(
          state.tasks.map((t) => ({ taskId: t.id, filePath: t.filePath })),
          state.outputFolder,
          state.targetLanguage,
        )
      } else if (isVideoFlow) {
        // Video transcription flow
        await startExtraction(state.tasks, state.outputFolder, targetLanguage)
      }
    } catch (error) {
      console.error('Error starting process:', error)

      // Mark all pending tasks as failed
      state.tasks
        .filter((t) => t.status === 'pending')
        .forEach((t) => {
          dispatch({
            type: 'TASK_FAILED',
            taskId: t.id,
            error: error instanceof Error ? error.message : String(error),
          })
        })

      dispatch({ type: 'STOP_PROCESSING' })

      // Show error to user
      alert(
        `Failed to start processing: ${error instanceof Error ? error.message : String(error)}\n\nPlease check backend is running at ${env.VITE_BACKEND_URL}`,
      )
    }
  }, [
    canStart,
    state.outputFolder,
    state.tasks,
    state.targetLanguage,
    isSrtFlow,
    isVideoFlow,
    dispatch,
    startTranslation,
    startExtraction,
    targetLanguage,
  ])

  const handleClearCompleted = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED' })
  }, [dispatch])

  if (totalTasks === 0) {
    return null
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Progress Summary</h3>
          {completedTasks > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCompleted}
              disabled={state.isProcessing}
            >
              Clear Completed
            </Button>
          )}
        </div>

        {isVideoFlow && (
          <div className="flex items-center gap-3">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <Select
              value={targetLanguage}
              onValueChange={setTargetLanguage}
              disabled={state.isProcessing}
            >
              <SelectTrigger className="w-[200px]">
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
        )}

        <div className="grid grid-cols-6 gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-gray-500/10 p-2">
              <Clock className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTasks}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-500/10 p-2">
              <Play className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{processingTasks}</p>
              <p className="text-xs text-muted-foreground">Extracting</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full bg-purple-500/10 p-2">
              <Loader2 className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{transcribingTasks}</p>
              <p className="text-xs text-muted-foreground">Transcribing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full bg-yellow-500/10 p-2">
              <Languages className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{translatingTasks}</p>
              <p className="text-xs text-muted-foreground">Translating</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-500/10 p-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedTasks}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full bg-red-500/10 p-2">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{failedTasks}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>

        {!state.outputFolder && totalTasks > 0 && (
          <p className="text-sm text-amber-600">
            Please select an output folder to start processing
          </p>
        )}

        {isSrtFlow && !state.targetLanguage && totalTasks > 0 && (
          <p className="text-sm text-amber-600">
            Please select a target language to start translation
          </p>
        )}

        {isVideoFlow && totalTasks > 0 && (
          <div className="flex items-center gap-2">
            {backendHealth.isChecking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                <span className="text-sm text-muted-foreground">
                  Checking transcription backend...
                </span>
              </>
            ) : backendHealth.isHealthy ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">
                  Transcription backend connected
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">
                  Transcription backend unavailable: {backendHealth.error}
                </span>
              </>
            )}
          </div>
        )}

        <Button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full"
          size="lg"
        >
          {state.isProcessing
            ? 'Processing...'
            : isSrtFlow
              ? 'Start Translation'
              : 'Start Extraction, Transcription & Translation'}
        </Button>
      </div>
    </Card>
  )
})
