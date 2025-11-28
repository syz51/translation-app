import { useCallback, useState } from 'react'
import { FileText, FileVideo, Upload, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import type { WorkflowType } from '@/types/extraction'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface UnifiedDropZoneProps {
  workflowType: WorkflowType
  selectedFiles: Array<string>
  onFilesSelected: (files: Array<string>) => void
  onRemoveFile: (index: number) => void
}

export function UnifiedDropZone({
  workflowType,
  selectedFiles,
  onFilesSelected,
  onRemoveFile,
}: UnifiedDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const isVideo = workflowType === 'video'
  const label = isVideo ? 'video files' : 'subtitle files'
  const Icon = isVideo ? FileVideo : FileText

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      const paths = files.map(
        (file) => (file as File & { path?: string }).path || file.name,
      )
      onFilesSelected(paths)
    },
    [onFilesSelected],
  )

  const handleBrowseClick = useCallback(async () => {
    try {
      const filters = isVideo
        ? [
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
          ]
        : [
            {
              name: 'Subtitle Files',
              extensions: ['srt'],
            },
          ]

      const selected = await open({
        multiple: true,
        filters,
      })

      if (!selected) return

      const paths = Array.isArray(selected) ? selected : [selected]
      onFilesSelected(paths)
    } catch (error) {
      console.error('File selection error:', error)
    }
  }, [isVideo, onFilesSelected])

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border bg-card hover:border-primary/50 hover:bg-card/80',
        )}
      >
        <Icon className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold text-card-foreground">
          Drop {label} here
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          or click to browse files
        </p>
        <Button onClick={handleBrowseClick}>
          <Upload className="mr-2 h-4 w-4" />
          Select Files
        </Button>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-card-foreground">
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => {
              const fileName = file.split(/[/\\]/).pop() || file
              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-card-foreground">
                      {fileName}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveFile(index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
