import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { ExtractionTask } from '@/types/extraction'

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
    tasks: Array<ExtractionTask>,
    targetLanguage: string,
    backendUrl: string,
  ) => {
    console.log('[useSrtTranslationCommands] Starting translation with:', {
      tasks,
      targetLanguage,
      backendUrl,
    })

    try {
      await invoke('translate_srt_batch', {
        tasks: tasks.map((t) => ({
          id: t.id,
          filePath: t.filePath,
        })),
        targetLanguage,
        backendUrl,
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
