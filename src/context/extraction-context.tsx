import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import type {
  ExtractionAction,
  ExtractionState,
  ExtractionTask,
} from '@/types/extraction'
import { useSettingsStore } from '@/hooks/use-settings-store'

const initialState: ExtractionState = {
  tasks: [],
  outputFolder: null,
  lastOutputPath: null,
  isProcessing: false,
}

function extractionReducer(
  state: ExtractionState,
  action: ExtractionAction,
): ExtractionState {
  switch (action.type) {
    case 'ADD_TASKS': {
      const newTasks: Array<ExtractionTask> = action.tasks.map((task) => ({
        ...task,
        id: crypto.randomUUID(),
        status: 'pending' as const,
        logs: [],
      }))
      return {
        ...state,
        tasks: [...state.tasks, ...newTasks],
      }
    }

    case 'SET_OUTPUT_FOLDER':
      return {
        ...state,
        outputFolder: action.folder,
      }

    case 'SET_LAST_OUTPUT_PATH':
      return {
        ...state,
        lastOutputPath: action.path,
      }

    case 'START_PROCESSING':
      return {
        ...state,
        isProcessing: true,
      }

    case 'STOP_PROCESSING':
      return {
        ...state,
        isProcessing: false,
      }

    case 'TASK_STARTED':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, status: 'processing' as const, startTime: Date.now() }
            : task,
        ),
      }

    case 'TASK_TRANSCRIBING':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, status: 'transcribing' as const }
            : task,
        ),
      }

    case 'TASK_TRANSLATING':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, status: 'translating' as const }
            : task,
        ),
      }

    case 'TASK_COMPLETED':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                status: 'completed' as const,
                outputPath: action.outputPath,
                endTime: Date.now(),
              }
            : task,
        ),
      }

    case 'TASK_TRANSCRIPTION_COMPLETE':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                status: 'completed' as const,
                outputPath: action.transcriptPath, // Use transcript path as the main output (audio is temp and gets cleaned up)
                transcriptPath: action.transcriptPath,
                endTime: Date.now(),
              }
            : task,
        ),
      }

    case 'TRANSLATION_COMPLETE':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                status: 'completed' as const,
                outputPath: action.translatedPath, // Use translated path as the final output
                endTime: Date.now(),
              }
            : task,
        ),
      }

    case 'TASK_FAILED':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                status: 'failed' as const,
                error: action.error,
                endTime: Date.now(),
              }
            : task,
        ),
      }

    case 'REMOVE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.taskId),
      }

    case 'CLEAR_COMPLETED':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.status !== 'completed'),
      }

    case 'RESET':
      return initialState

    case 'ADD_LOG_ENTRY':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, logs: [...task.logs, action.logEntry] }
            : task,
        ),
      }

    default:
      return state
  }
}

interface ExtractionContextValue {
  state: ExtractionState
  dispatch: React.Dispatch<ExtractionAction>
}

const ExtractionContext = createContext<ExtractionContextValue | undefined>(
  undefined,
)

export function ExtractionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(extractionReducer, initialState)
  const { getLastOutputPath, isReady } = useSettingsStore()

  // Load last output path from store on mount
  useEffect(() => {
    if (isReady) {
      getLastOutputPath().then((path) => {
        if (path) {
          dispatch({ type: 'SET_LAST_OUTPUT_PATH', path })
          // Set as default output folder if no folder is currently set
          if (!state.outputFolder) {
            dispatch({ type: 'SET_OUTPUT_FOLDER', folder: path })
          }
        }
      })
    }
  }, [isReady, getLastOutputPath])

  return (
    <ExtractionContext.Provider value={{ state, dispatch }}>
      {children}
    </ExtractionContext.Provider>
  )
}

export function useExtraction() {
  const context = useContext(ExtractionContext)
  if (context === undefined) {
    throw new Error('useExtraction must be used within an ExtractionProvider')
  }
  return context
}
