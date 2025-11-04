import {
  CheckCircle2,
  Eye,
  FileVideo,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ExtractionTask } from '@/types/extraction'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'

interface TaskItemProps {
  task: ExtractionTask
}

export function TaskItem({ task }: TaskItemProps) {
  const { dispatch } = useExtraction()
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())

  // Update time every second for in-progress tasks
  useEffect(() => {
    if (task.status === 'processing' || task.status === 'transcribing') {
      const interval = setInterval(() => {
        setNow(Date.now())
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [task.status])

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'transcribing':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />
      case 'failed':
        return <XCircle className="h-4 w-4" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'transcribing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      default:
        return <FileVideo className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    switch (task.status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'processing':
        return 'Extracting Audio'
      case 'transcribing':
        return 'Transcribing'
      default:
        return 'Pending'
    }
  }

  const getDuration = () => {
    if (!task.startTime) return null
    const endTime = task.endTime || now
    const duration = Math.round((endTime - task.startTime) / 1000)
    return `${duration}s`
  }

  const handleRemove = () => {
    if (task.status !== 'processing' && task.status !== 'transcribing') {
      dispatch({ type: 'REMOVE_TASK', taskId: task.id })
    }
  }

  const handleViewDetails = () => {
    navigate({ to: '/task/$taskId', params: { taskId: task.id } })
  }

  return (
    <div className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-muted p-2">
              <FileVideo className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{task.fileName}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className={getStatusColor()}>
                  <span className="mr-1">{getStatusIcon()}</span>
                  {getStatusText()}
                </Badge>
                {getDuration() && (
                  <span className="text-xs text-muted-foreground">
                    {getDuration()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {task.error && <p className="text-sm text-red-500">{task.error}</p>}

          {task.outputPath && (
            <p className="truncate text-xs text-muted-foreground">
              Audio: {task.outputPath}
            </p>
          )}

          {task.transcriptPath && (
            <p className="truncate text-xs text-muted-foreground">
              Transcript: {task.transcriptPath}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleViewDetails}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={
              task.status === 'processing' || task.status === 'transcribing'
            }
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="Remove Task"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
