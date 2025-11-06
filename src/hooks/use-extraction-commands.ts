import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { ExtractionTask, LogEntry } from '@/types/extraction'
import { env } from '@/env'

export function useExtractionCommands() {
  const selectVideoFiles = async (): Promise<Array<string>> => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Video Files',
            extensions: [
              'mp4',
              'avi',
              'mkv',
              'mov',
              'wmv',
              'flv',
              'webm',
              'm4v',
              'mpg',
              'mpeg',
            ],
          },
        ],
      })

      if (!selected) {
        return []
      }

      return Array.isArray(selected) ? selected : [selected]
    } catch (error) {
      console.error('Failed to select video files:', error)
      throw error
    }
  }

  const selectOutputFolder = async (): Promise<string | null> => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })

      return selected
    } catch (error) {
      console.error('Failed to select output folder:', error)
      throw error
    }
  }

  /**
   * Starts the extraction, transcription, and translation pipeline.
   * This will:
   * 1. Extract audio from video files to WAV format
   * 2. Upload audio to AssemblyAI for transcription
   * 3. Translate SRT to target language
   * 4. Generate final SRT subtitle files
   */
  const startExtraction = async (
    tasks: Array<ExtractionTask>,
    outputFolder: string,
    targetLanguage: string = 'Chinese Simplified',
  ): Promise<void> => {
    try {
      await invoke('extract_audio_batch', {
        tasks: tasks.map((task) => ({
          id: task.id,
          filePath: task.filePath,
          targetLanguage,
        })),
        outputFolder,
        transcriptionServerUrl: env.VITE_TRANSCRIPTION_SERVER_URL,
        targetLanguage,
        translationServerUrl: env.VITE_TRANSLATION_SERVER_URL,
      })
    } catch (error) {
      console.error(
        'Failed to start extraction, transcription, and translation:',
        error,
      )
      throw error
    }
  }

  const cancelExtraction = async (taskId: string): Promise<void> => {
    try {
      await invoke('cancel_extraction', { taskId })
    } catch (error) {
      console.error('Failed to cancel extraction:', error)
      throw error
    }
  }

  const getTaskLogs = async (taskId: string): Promise<Array<LogEntry>> => {
    try {
      const logs = await invoke<Array<LogEntry>>('get_task_logs', { taskId })
      return logs
    } catch (error) {
      console.error('Failed to get task logs:', error)
      throw error
    }
  }

  const getLogFolder = async (): Promise<string> => {
    try {
      const folder = await invoke<string>('get_log_folder')
      return folder
    } catch (error) {
      console.error('Failed to get log folder:', error)
      throw error
    }
  }

  return {
    selectVideoFiles,
    selectOutputFolder,
    startExtraction,
    cancelExtraction,
    getTaskLogs,
    getLogFolder,
  }
}
