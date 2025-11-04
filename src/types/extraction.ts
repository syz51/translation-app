export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type LogType = 'metadata' | 'ffprobe' | 'ffmpeg' | 'error'

export interface LogEntry {
  timestamp: string
  type: LogType
  message: string
}

export interface ExtractionTask {
  id: string
  fileName: string
  filePath: string
  status: TaskStatus
  progress: number // 0-100
  outputPath?: string
  error?: string
  startTime?: number
  endTime?: number
  logs: Array<LogEntry>
}

export interface ExtractionState {
  tasks: Array<ExtractionTask>
  outputFolder: string | null
  lastOutputPath: string | null
  isProcessing: boolean
}

export interface ProgressEvent {
  taskId: string
  progress: number
}

export interface TaskCompleteEvent {
  taskId: string
  outputPath: string
}

export interface TaskErrorEvent {
  taskId: string
  error: string
}

export interface TaskStartedEvent {
  taskId: string
}

export interface TaskLogEvent {
  taskId: string
  timestamp: string
  type: LogType
  message: string
}

export type ExtractionAction =
  | {
      type: 'ADD_TASKS'
      tasks: Array<Omit<ExtractionTask, 'id' | 'status' | 'progress' | 'logs'>>
    }
  | { type: 'SET_OUTPUT_FOLDER'; folder: string }
  | { type: 'SET_LAST_OUTPUT_PATH'; path: string | null }
  | { type: 'START_PROCESSING' }
  | { type: 'STOP_PROCESSING' }
  | { type: 'UPDATE_TASK_PROGRESS'; taskId: string; progress: number }
  | { type: 'TASK_STARTED'; taskId: string }
  | { type: 'TASK_COMPLETED'; taskId: string; outputPath: string }
  | { type: 'TASK_FAILED'; taskId: string; error: string }
  | { type: 'REMOVE_TASK'; taskId: string }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'RESET' }
  | { type: 'ADD_LOG_ENTRY'; taskId: string; logEntry: LogEntry }
