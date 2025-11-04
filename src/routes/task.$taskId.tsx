import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileVideo,
  XCircle,
} from 'lucide-react'
import type { LogEntry } from '@/types/extraction'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LogViewer } from '@/components/log-viewer'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'

export const Route = createFileRoute('/task/$taskId')({
  component: TaskDetailsPage,
})

function TaskDetailsPage() {
  const { taskId } = Route.useParams()
  const navigate = useNavigate()
  const { state } = useExtraction()
  const { getTaskLogs } = useExtractionCommands()
  const [historicalLogs, setHistoricalLogs] = useState<Array<LogEntry>>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [now, setNow] = useState(Date.now())

  const task = state.tasks.find((t) => t.id === taskId)

  // Load historical logs on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await getTaskLogs(taskId)
        setHistoricalLogs(logs)
      } catch (error) {
        console.error('Failed to load logs:', error)
      } finally {
        setIsLoadingLogs(false)
      }
    }

    loadLogs()
  }, [taskId, getTaskLogs])

  // Update time every second for in-progress tasks
  useEffect(() => {
    if (
      task &&
      (task.status === 'processing' || task.status === 'transcribing')
    ) {
      const interval = setInterval(() => {
        setNow(Date.now())
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [task?.status])

  if (!task) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: '/' })}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <Card className="p-8">
            <p className="text-center text-muted-foreground">Task not found</p>
          </Card>
        </div>
      </div>
    )
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return <Clock className="h-5 w-5 animate-spin text-blue-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'processing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    }
  }

  const getDuration = () => {
    if (!task.startTime) return null
    const endTime = task.endTime || now
    const duration = Math.round((endTime - task.startTime) / 1000)
    return `${duration}s`
  }

  // Combine historical logs with real-time logs from context
  const allLogs = task.logs.length > 0 ? task.logs : historicalLogs

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate({ to: '/' })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        {/* Task Header */}
        <div className="mb-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-muted p-3">
              <FileVideo className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="mb-2 text-2xl font-bold">{task.fileName}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className={getStatusColor()}>
                  <span className="mr-2">{getStatusIcon()}</span>
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </Badge>
                {getDuration() && (
                  <span className="text-sm text-muted-foreground">
                    Duration: {getDuration()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-semibold">Task Details</h2>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-muted-foreground">Input File:</span>
              <span className="font-mono break-all">{task.filePath}</span>
            </div>
            {task.outputPath && (
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-muted-foreground">Output File:</span>
                <span className="font-mono break-all">{task.outputPath}</span>
              </div>
            )}
            {task.error && (
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-muted-foreground">Error:</span>
                <span className="break-all text-red-500">{task.error}</span>
              </div>
            )}
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="text-muted-foreground">Task ID:</span>
              <span className="font-mono text-xs break-all">{task.id}</span>
            </div>
          </div>
        </Card>

        {/* Logs */}
        <div className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">Logs</h2>
          {isLoadingLogs ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">
                Loading logs...
              </p>
            </Card>
          ) : (
            <LogViewer logs={allLogs} />
          )}
        </div>
      </div>
    </div>
  )
}
