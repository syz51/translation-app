import { useCallback, useState } from 'react'
import { FileText, FolderOutput, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'
import { useSrtTranslationCommands } from '@/hooks/use-srt-translation-commands'
import { getDirectoryFromPath } from '@/lib/utils'

export function SrtFileSelector() {
  const { state, dispatch } = useExtraction()
  const { selectSrtFiles } = useSrtTranslationCommands()
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    (files: Array<string>) => {
      if (files.length === 0) return

      const tasks = files.map((filePath) => ({
        fileName: filePath.split('/').pop() || filePath,
        filePath,
      }))

      dispatch({ type: 'ADD_TASKS', tasks })

      // Auto-populate output folder on first use
      if (!state.outputFolder && !state.lastOutputPath && files.length > 0) {
        const firstFilePath = files[0]
        const inputDirectory = getDirectoryFromPath(firstFilePath)
        if (inputDirectory) {
          dispatch({ type: 'SET_OUTPUT_FOLDER', folder: inputDirectory })
        }
      }
    },
    [dispatch, state.outputFolder, state.lastOutputPath],
  )

  const handleSelectFiles = async () => {
    try {
      const files = await selectSrtFiles()
      handleFiles(files)
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      // In Tauri, File objects have a path property
      const files = Array.from(e.dataTransfer.files).map(
        (file) => (file as File & { path: string }).path,
      )
      handleFiles(files)
    },
    [handleFiles],
  )

  return (
    <section
      className={`border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? 'rounded-[1.9rem] border-[var(--app-highlight)] bg-[linear-gradient(135deg,rgba(72,187,174,0.14),rgba(72,187,174,0.04))]'
          : 'rounded-[1.9rem] border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] hover:border-white/[0.18]'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div
              className={`rounded-3xl border p-4 transition-colors ${
                isDragging
                  ? 'border-[#48bbad]/40 bg-[#48bbad]/10 text-[#48bbad]'
                  : 'border-white/10 bg-white/[0.06] text-white/[0.76]'
              }`}
            >
              <Upload className="h-7 w-7" />
            </div>
            <div>
              <p className="eyebrow-label text-white/[0.42]">Source Intake</p>
              <h3 className="display-type mt-1 text-3xl text-white">
                {isDragging ? 'Drop subtitle files now' : 'Load subtitle files'}
              </h3>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/[0.68] sm:text-base">
            This path is optimized for fast subtitle-only jobs. Add multiple SRT
            files at once, then move straight to language choice and export.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold tracking-[0.18em] text-white/[0.54] uppercase">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              Native SRT
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              Batch Queue
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              Preserves Originals
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={handleSelectFiles}
              size="lg"
              className="sm:min-w-52"
            >
              Browse SRT Files
            </Button>
            <p className="text-sm text-white/[0.54]">
              Drop anywhere in this panel for faster batching.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-black/[0.18] p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[var(--app-highlight)]" />
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
                  In Queue
                </p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {state.tasks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/[0.18] p-4">
            <div className="flex items-center gap-3">
              <FolderOutput className="h-5 w-5 text-[var(--app-accent)]" />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
                  Smart Default
                </p>
                <p className="mt-1 truncate text-sm text-white/[0.76]">
                  {state.outputFolder ||
                    state.lastOutputPath ||
                    'Uses source folder on first drop'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
