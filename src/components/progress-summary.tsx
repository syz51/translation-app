import {
  CheckCircle2,
  Clock,
  Languages,
  Loader2,
  Play,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
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

export function ProgressSummary() {
  const { state, dispatch } = useExtraction()
  const { startExtraction } = useExtractionCommands()
  const { startTranslation } = useSrtTranslationCommands()
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] =
    useState<string>('Chinese Simplified')

  // Detect current route
  const currentPath = router.state.location.pathname
  const isSrtFlow = currentPath === '/srt'
  const isVideoFlow = currentPath === '/video'

  const totalTasks = state.tasks.length
  const completedTasks = state.tasks.filter(
    (t) => t.status === 'completed',
  ).length
  const failedTasks = state.tasks.filter((t) => t.status === 'failed').length
  const processingTasks = state.tasks.filter(
    (t) => t.status === 'processing',
  ).length
  const transcribingTasks = state.tasks.filter(
    (t) => t.status === 'transcribing',
  ).length
  const translatingTasks = state.tasks.filter(
    (t) => t.status === 'translating',
  ).length
  const pendingTasks = state.tasks.filter((t) => t.status === 'pending').length

  // For SRT flow, also require target language
  const canStart =
    totalTasks > 0 &&
    state.outputFolder &&
    !state.isProcessing &&
    pendingTasks > 0 &&
    (isSrtFlow ? !!state.targetLanguage : true)

  const handleStart = async () => {
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
      dispatch({ type: 'STOP_PROCESSING' })
    }
  }

  const handleClearCompleted = () => {
    dispatch({ type: 'CLEAR_COMPLETED' })
  }

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
}
