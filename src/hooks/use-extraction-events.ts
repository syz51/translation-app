import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type {
  TaskCompleteEvent,
  TaskErrorEvent,
  TaskLogEvent,
  TaskStartedEvent,
  TranscriptionCompleteEvent,
  TranscriptionPollingEvent,
  TranscriptionStartedEvent,
} from '@/types/extraction'
import { useExtraction } from '@/context/extraction-context'

export function useExtractionEvents() {
  const { dispatch } = useExtraction()

  useEffect(() => {
    let isMounted = true
    const unlisteners: Array<UnlistenFn> = []

    // Setup all listeners
    const setupListeners = async () => {
      // Set up all listeners in parallel for better performance
      const listeners = await Promise.all([
        // Listen for task started events
        listen<TaskStartedEvent>('task:started', (event) => {
          dispatch({
            type: 'TASK_STARTED',
            taskId: event.payload.taskId,
          })
        }),

        // Listen for task completed events
        listen<TaskCompleteEvent>('task:completed', (event) => {
          dispatch({
            type: 'TASK_COMPLETED',
            taskId: event.payload.taskId,
            outputPath: event.payload.outputPath,
          })
        }),

        // Listen for task error events
        listen<TaskErrorEvent>('task:failed', (event) => {
          dispatch({
            type: 'TASK_FAILED',
            taskId: event.payload.taskId,
            error: event.payload.error,
          })
        }),

        // Listen for batch complete event
        listen('batch:complete', () => {
          dispatch({ type: 'STOP_PROCESSING' })
        }),

        // Listen for log events
        listen<TaskLogEvent>('task:log', (event) => {
          dispatch({
            type: 'ADD_LOG_ENTRY',
            taskId: event.payload.taskId,
            logEntry: {
              timestamp: event.payload.timestamp,
              type: event.payload.type,
              message: event.payload.message,
            },
          })
        }),

        // Listen for transcription started events
        listen<TranscriptionStartedEvent>('transcription:started', (event) => {
          dispatch({
            type: 'TASK_TRANSCRIBING',
            taskId: event.payload.taskId,
          })
        }),

        // Listen for transcription polling events
        listen<TranscriptionPollingEvent>('transcription:polling', (event) => {
          // Just listening for potential future use (like updating UI with current status)
          // Logs are already emitted from the backend via task:log events
          console.log(
            `Transcription polling: ${event.payload.taskId} - ${event.payload.status}`,
          )
        }),

        // Listen for transcription complete events
        listen<TranscriptionCompleteEvent>(
          'transcription:complete',
          (event) => {
            dispatch({
              type: 'TASK_TRANSCRIPTION_COMPLETE',
              taskId: event.payload.taskId,
              audioPath: event.payload.audioPath,
              transcriptPath: event.payload.transcriptPath,
            })
          },
        ),
      ])

      // If component unmounted during setup, cleanup immediately
      if (!isMounted) {
        listeners.forEach((unlisten) => unlisten())
        return
      }

      // Store unlisteners for cleanup
      unlisteners.push(...listeners)
    }

    setupListeners()

    // Cleanup function - unsubscribe from all events
    return () => {
      isMounted = false
      unlisteners.forEach((unlisten) => unlisten())
    }
  }, [dispatch])
}
