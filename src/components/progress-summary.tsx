import { CheckCircle2, Clock, Play, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'

export function ProgressSummary() {
  const { state, dispatch } = useExtraction()
  const { startExtraction } = useExtractionCommands()

  const totalTasks = state.tasks.length
  const completedTasks = state.tasks.filter(
    (t) => t.status === 'completed',
  ).length
  const failedTasks = state.tasks.filter((t) => t.status === 'failed').length
  const processingTasks = state.tasks.filter(
    (t) => t.status === 'processing',
  ).length
  const pendingTasks = state.tasks.filter((t) => t.status === 'pending').length

  const overallProgress =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const canStart =
    totalTasks > 0 &&
    state.outputFolder &&
    !state.isProcessing &&
    pendingTasks > 0

  const handleStart = async () => {
    if (!canStart || !state.outputFolder) return

    dispatch({ type: 'START_PROCESSING' })
    try {
      await startExtraction(state.tasks, state.outputFolder)
    } catch (error) {
      console.error('Error starting extraction:', error)
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

        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-500/10 p-2">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingTasks}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-full bg-yellow-500/10 p-2">
              <Play className="h-4 w-4 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{processingTasks}</p>
              <p className="text-xs text-muted-foreground">Processing</p>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">
              {completedTasks} / {totalTasks} ({Math.round(overallProgress)}%)
            </span>
          </div>
          <Progress value={overallProgress} />
        </div>

        {!state.outputFolder && totalTasks > 0 && (
          <p className="text-sm text-amber-600">
            Please select an output folder to start extraction
          </p>
        )}

        <Button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full"
          size="lg"
        >
          {state.isProcessing ? 'Processing...' : 'Start Extraction'}
        </Button>
      </div>
    </Card>
  )
}
