import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type {
  ProgressEvent,
  TaskCompleteEvent,
  TaskErrorEvent,
  TaskStartedEvent,
} from '@/types/extraction'
import { useExtraction } from '@/context/extraction-context'

export function useExtractionEvents() {
  const { dispatch } = useExtraction()

  useEffect(() => {
    const unlistenPromises: Array<Promise<UnlistenFn>> = []

    // Listen for task started events
    const taskStartedPromise = listen<TaskStartedEvent>(
      'task:started',
      (event) => {
        dispatch({
          type: 'TASK_STARTED',
          taskId: event.payload.taskId,
        })
      },
    )
    unlistenPromises.push(taskStartedPromise)

    // Listen for progress events
    const progressPromise = listen<ProgressEvent>('task:progress', (event) => {
      dispatch({
        type: 'UPDATE_TASK_PROGRESS',
        taskId: event.payload.taskId,
        progress: event.payload.progress,
      })
    })
    unlistenPromises.push(progressPromise)

    // Listen for task completed events
    const completePromise = listen<TaskCompleteEvent>(
      'task:completed',
      (event) => {
        dispatch({
          type: 'TASK_COMPLETED',
          taskId: event.payload.taskId,
          outputPath: event.payload.outputPath,
        })
      },
    )
    unlistenPromises.push(completePromise)

    // Listen for task error events
    const errorPromise = listen<TaskErrorEvent>('task:failed', (event) => {
      dispatch({
        type: 'TASK_FAILED',
        taskId: event.payload.taskId,
        error: event.payload.error,
      })
    })
    unlistenPromises.push(errorPromise)

    // Listen for batch complete event
    const batchCompletePromise = listen('batch:complete', () => {
      dispatch({ type: 'STOP_PROCESSING' })
    })
    unlistenPromises.push(batchCompletePromise)

    // Cleanup function
    return () => {
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten())
      })
    }
  }, [dispatch])
}
