import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
    <Card
      className={`border-2 border-dashed p-8 transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div
          className={`rounded-full p-4 transition-colors ${
            isDragging ? 'bg-primary/10' : 'bg-muted'
          }`}
        >
          <Upload
            className={`h-8 w-8 transition-colors ${
              isDragging ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {isDragging ? 'Drop SRT files here' : 'Select SRT Files'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Drag and drop SRT files or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Supports: .srt subtitle files
          </p>
        </div>
        <Button onClick={handleSelectFiles} size="lg">
          Browse Files
        </Button>
      </div>
    </Card>
  )
}
