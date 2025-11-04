import { createContext, useContext, useReducer } from 'react'
import type { ReactNode } from 'react'
import type {
  ExtractionAction,
  ExtractionState,
  ExtractionTask,
} from '@/types/extraction'

const initialState: ExtractionState = {
  tasks: [],
  outputFolder: null,
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
        progress: 0,
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

    case 'UPDATE_TASK_PROGRESS':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? { ...task, progress: action.progress }
            : task,
        ),
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

    case 'TASK_COMPLETED':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                status: 'completed' as const,
                progress: 100,
                outputPath: action.outputPath,
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
