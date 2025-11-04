import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { ExtractionTask } from '@/types/extraction'

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

  const startExtraction = async (
    tasks: Array<ExtractionTask>,
    outputFolder: string,
  ): Promise<void> => {
    try {
      await invoke('extract_audio_batch', {
        tasks: tasks.map((task) => ({
          id: task.id,
          filePath: task.filePath,
        })),
        outputFolder,
      })
    } catch (error) {
      console.error('Failed to start extraction:', error)
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

  return {
    selectVideoFiles,
    selectOutputFolder,
    startExtraction,
    cancelExtraction,
  }
}
