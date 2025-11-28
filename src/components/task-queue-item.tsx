import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  CheckCircle,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FileVideo,
  FolderOpen,
  Loader2,
  RotateCw,
  X,
  XCircle,
} from 'lucide-react'
import { openPath } from '@tauri-apps/plugin-opener'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import type { ExtractionTask } from '@/types/extraction'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useExtraction } from '@/context/extraction-context'

interface TaskQueueItemProps {
  task: ExtractionTask
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function TaskQueueItem({ task }: TaskQueueItemProps) {
  const { dispatch } = useExtraction()
  const [fileSize, setFileSize] = useState<number | null>(null)

  const isVideo = task.filePath.match(
    /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|mpg|mpeg)$/i,
  )
  const isRunning = ['processing', 'transcribing', 'translating'].includes(
    task.status,
  )
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'

  // Fetch file size when task is completed
  useEffect(() => {
    if (isCompleted) {
      invoke<number>('get_completed_file_size', { taskId: task.id })
        .then(setFileSize)
        .catch((error) => {
          console.error('Failed to get file size:', error)
          setFileSize(null)
        })
    }
  }, [isCompleted, task.id])

  const handleDownload = async () => {
    try {
      // Generate suggested filename from original file
      const fileName = task.fileName.replace(/\.[^/.]+$/, '')
      const suggestedName = `${fileName}_${task.targetLanguage || 'translated'}.srt`

      const savePath = await save({
        defaultPath: suggestedName,
        filters: [{ name: 'SRT Files', extensions: ['srt'] }],
      })

      if (savePath) {
        // Copy completed file from temp storage to user-selected location
        await invoke('copy_completed_file', {
          taskId: task.id,
          destinationPath: savePath,
        })
      }
    } catch (error: any) {
      console.error('Failed to download file:', error)

      // If temp file is missing, offer to rerun task
      if (error?.toString().includes('not found')) {
        const shouldRerun = confirm(
          'File no longer available in temp storage. Would you like to rerun this task?',
        )
        if (shouldRerun) {
          handleRetry()
        }
      } else {
        alert(`Download failed: ${error}`)
      }
    }
  }

  const handleOpenFolder = async () => {
    try {
      const tempDir = await invoke<string>('get_temp_output_folder')
      await openPath(tempDir)
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  const handleRetry = () => {
    dispatch({ type: 'RETRY_TASK', taskId: task.id })
  }

  const handleCancel = () => {
    dispatch({ type: 'CANCEL_TASK', taskId: task.id })
  }

  const handleDelete = async () => {
    try {
      // Delete temp files and logs for this task
      await invoke('delete_task_files', { taskId: task.id })
      dispatch({ type: 'REMOVE_TASK', taskId: task.id })
    } catch (error) {
      console.error('Failed to delete task files:', error)
      // Still remove from UI even if cleanup fails
      dispatch({ type: 'REMOVE_TASK', taskId: task.id })
    }
  }

  const getStatusBadge = () => {
    switch (task.status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            Pending
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        )
      case 'transcribing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Transcribing
          </Badge>
        )
      case 'translating':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Translating
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="gap-1 bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        )
      case 'failed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Failed
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{task.error || 'Unknown error'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      default:
        return null
    }
  }

  const getDuration = () => {
    if (!task.startTime) return null
    const endTime = task.endTime || Date.now()
    const duration = Math.floor((endTime - task.startTime) / 1000)
    const minutes = Math.floor(duration / 60)
    const seconds = duration % 60
    return `${minutes}m ${seconds}s`
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[1fr_120px_100px_140px_auto] items-center gap-4 p-4">
        {/* File Info */}
        <div className="flex items-center gap-3">
          {isVideo ? (
            <FileVideo className="h-5 w-5 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-card-foreground">
              {task.fileName}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {getDuration() && <span>{getDuration()}</span>}
              {getDuration() && fileSize && <span>•</span>}
              {fileSize && <span>{formatFileSize(fileSize)}</span>}
            </div>
          </div>
        </div>

        {/* Task Type */}
        <div>
          <Badge variant="outline">
            {isVideo ? 'TRANSCRIPT' : 'TRANSLATE'}
          </Badge>
        </div>

        {/* Target Language */}
        <div>
          <span className="text-sm text-muted-foreground">
            {task.targetLanguage || 'N/A'}
          </span>
        </div>

        {/* Status/Progress */}
        <div>
          {isRunning ? (
            <div className="space-y-2">
              <Progress value={33} className="h-2" />
              {getStatusBadge()}
            </div>
          ) : (
            getStatusBadge()
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isCompleted && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownload}
                      className="h-8 w-8"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download file</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenFolder}
                      className="h-8 w-8"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open folder</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          {isFailed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRetry}
                    className="h-8 w-8"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Retry task</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {isRunning && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    className="h-8 w-8 text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel task</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <Link to="/task/$taskId" params={{ taskId: task.id }}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View logs</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <X className="mr-2 h-4 w-4" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Error Accordion */}
      {isFailed && task.error && (
        <Accordion type="single" collapsible>
          <AccordionItem value="error" className="border-t border-border">
            <AccordionTrigger className="px-4 py-2 text-sm hover:no-underline">
              <span className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                View error details
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="rounded-md bg-destructive/10 p-3">
                <p className="text-sm text-destructive-foreground">
                  {task.error}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}
