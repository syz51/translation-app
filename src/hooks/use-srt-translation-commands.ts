import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { env } from '@/env'

export function useSrtTranslationCommands() {
  const selectSrtFiles = async (): Promise<Array<string>> => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: 'SRT Subtitles',
          extensions: ['srt'],
        },
      ],
    })

    if (!selected) return []
    return Array.isArray(selected) ? selected : [selected]
  }

  const startTranslation = async (
    tasks: Array<{ taskId: string; filePath: string }>,
    outputFolder: string,
    targetLanguage: string,
  ) => {
    console.log('[useSrtTranslationCommands] Starting translation with:', {
      tasks,
      outputFolder,
      targetLanguage,
      backendUrl: env.VITE_BACKEND_URL,
    })

    try {
      await invoke('translate_srt_batch', {
        tasks: tasks.map((t) => ({
          id: t.taskId,
          filePath: t.filePath,
        })),
        outputFolder,
        targetLanguage,
        backendUrl: env.VITE_BACKEND_URL,
      })
      console.log(
        '[useSrtTranslationCommands] Translation started successfully',
      )
    } catch (error) {
      console.error('[useSrtTranslationCommands] Translation failed:', error)
      throw error
    }
  }

  return { selectSrtFiles, startTranslation }
}
