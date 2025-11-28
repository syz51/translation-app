export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'transcribing'
  | 'translating'
  | 'completed'
  | 'failed'

export type WorkflowType = 'video' | 'srt'

export type FilterStatus = 'all' | 'running' | 'failed'

export type LogType =
  | 'metadata'
  | 'ffprobe'
  | 'ffmpeg'
  | 'assemblyai'
  | 'translation'
  | 'error'

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
  outputPath?: string
  transcriptPath?: string
  targetLanguage?: string
  error?: string
  startTime?: number
  endTime?: number
  logs: Array<LogEntry>
}

export interface ExtractionState {
  tasks: Array<ExtractionTask>
  isProcessing: boolean
  targetLanguage: string | null
  workflowType: WorkflowType
  filterStatus: FilterStatus
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

export interface TranscriptionStartedEvent {
  taskId: string
}

export interface TranscriptionPollingEvent {
  taskId: string
  status: string
}

export interface TranscriptionCompleteEvent {
  taskId: string
  /** Path to the temporary extracted audio file (will be cleaned up after transcription) */
  audioPath: string
  /** Path to the final SRT transcript file */
  transcriptPath: string
}

export interface TranslationStartedEvent {
  taskId: string
}

export interface TranslationCompleteEvent {
  taskId: string
  /** Path to the final translated SRT file */
  translatedPath: string
}

export type ExtractionAction =
  | {
      type: 'ADD_TASKS'
      tasks: Array<Omit<ExtractionTask, 'status' | 'logs'> & { id?: string }>
    }
  | { type: 'SET_TARGET_LANGUAGE'; language: string }
  | { type: 'SET_WORKFLOW_TYPE'; workflowType: WorkflowType }
  | { type: 'SET_FILTER_STATUS'; filterStatus: FilterStatus }
  | { type: 'START_PROCESSING' }
  | { type: 'STOP_PROCESSING' }
  | { type: 'TASK_STARTED'; taskId: string }
  | { type: 'TASK_TRANSCRIBING'; taskId: string }
  | { type: 'TASK_TRANSLATING'; taskId: string }
  | { type: 'TASK_COMPLETED'; taskId: string; outputPath: string }
  | {
      type: 'TASK_TRANSCRIPTION_COMPLETE'
      taskId: string
      audioPath: string
      transcriptPath: string
    }
  | {
      type: 'TRANSLATION_COMPLETE'
      taskId: string
      translatedPath: string
    }
  | { type: 'TASK_FAILED'; taskId: string; error: string }
  | { type: 'REMOVE_TASK'; taskId: string }
  | { type: 'RETRY_TASK'; taskId: string }
  | { type: 'DOWNLOAD_TASK'; taskId: string }
  | { type: 'OPEN_FOLDER'; taskId: string }
  | { type: 'CANCEL_TASK'; taskId: string }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'RESET' }
  | { type: 'ADD_LOG_ENTRY'; taskId: string; logEntry: LogEntry }
