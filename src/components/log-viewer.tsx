import { useEffect, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import type { LogEntry } from '@/types/extraction'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LogViewerProps {
  logs: Array<LogEntry>
}

export function LogViewer({ logs }: LogViewerProps) {
  const logEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  // Check if user is at the bottom of the scroll container
  const checkIfAtBottom = () => {
    const container = scrollContainerRef.current
    if (!container) return true

    const threshold = 50 // pixels from bottom to consider "at bottom"
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold

    return isAtBottom
  }

  // Handle scroll events to detect if user scrolled up
  const handleScroll = () => {
    const isAtBottom = checkIfAtBottom()
    setIsAutoScrollEnabled(isAtBottom)
    setShowScrollToBottom(!isAtBottom)
  }

  // Auto-scroll to bottom when new logs are added, but only if auto-scroll is enabled
  useEffect(() => {
    if (isAutoScrollEnabled) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isAutoScrollEnabled])

  // Scroll to bottom manually when button is clicked
  const scrollToBottom = () => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAutoScrollEnabled(true)
    setShowScrollToBottom(false)
  }

  const getLogColor = (type: string) => {
    switch (type) {
      case 'metadata':
        return 'text-blue-400'
      case 'ffprobe':
        return 'text-purple-400'
      case 'ffmpeg':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const getLogLabel = (type: string) => {
    switch (type) {
      case 'metadata':
        return 'INFO'
      case 'ffprobe':
        return 'PROBE'
      case 'ffmpeg':
        return 'FFMPEG'
      case 'error':
        return 'ERROR'
      default:
        return 'LOG'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      })
    } catch {
      return timestamp
    }
  }

  if (logs.length === 0) {
    return (
      <Card className="bg-slate-900 p-4">
        <p className="text-center text-muted-foreground">No logs available</p>
      </Card>
    )
  }

  return (
    <Card className="relative bg-slate-900 p-4">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="max-h-[600px] space-y-1 overflow-y-auto font-mono text-xs"
      >
        {logs.map((log, index) => (
          <div
            key={index}
            className="flex gap-2 border-b border-slate-800 pb-1 last:border-0"
          >
            <span className="text-slate-500">
              {formatTimestamp(log.timestamp)}
            </span>
            <span className={`font-semibold ${getLogColor(log.type)}`}>
              [{getLogLabel(log.type)}]
            </span>
            <span className="flex-1 text-slate-300">{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
      {showScrollToBottom && (
        <Button
          onClick={scrollToBottom}
          size="sm"
          className="absolute right-6 bottom-6 rounded-full shadow-lg"
          title="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </Card>
  )
}
