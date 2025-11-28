import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import type { TaskStatus } from '@/types/extraction'
import { TaskQueueFilters } from '@/components/task-queue-filters'
import { TaskQueueItem } from '@/components/task-queue-item'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'

export const Route = createFileRoute('/queue')({
  component: TaskQueue,
})

const isRunningStatus = (status: TaskStatus): boolean => {
  return ['processing', 'transcribing', 'translating'].includes(status)
}

function TaskQueue() {
  const { state, dispatch } = useExtraction()

  const filteredTasks = useMemo(() => {
    switch (state.filterStatus) {
      case 'running':
        return state.tasks.filter((t) => isRunningStatus(t.status))
      case 'failed':
        return state.tasks.filter((t) => t.status === 'failed')
      case 'all':
      default:
        return state.tasks
    }
  }, [state.tasks, state.filterStatus])

  const hasCompletedTasks = useMemo(
    () => state.tasks.some((t) => t.status === 'completed'),
    [state.tasks],
  )

  const handleClearCompleted = () => {
    dispatch({ type: 'CLEAR_COMPLETED' })
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="container mx-auto max-w-7xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              Task Queue
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage your transcription and translation tasks
            </p>
          </div>
          {hasCompletedTasks && (
            <Button
              variant="outline"
              onClick={handleClearCompleted}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Completed
            </Button>
          )}
        </header>

        {/* Filters */}
        <div className="mb-6">
          <TaskQueueFilters />
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
              <p className="text-muted-foreground">
                {state.filterStatus === 'all'
                  ? 'No tasks yet. Create a new task to get started.'
                  : `No ${state.filterStatus} tasks.`}
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <TaskQueueItem key={task.id} task={task} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
