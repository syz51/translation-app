import { ArrowDown, Terminal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '@/types/extraction'
import { Button } from '@/components/ui/button'

interface LogViewerProps {
  logs: Array<LogEntry>
}

export function LogViewer({ logs }: LogViewerProps) {
  const logEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  const checkIfAtBottom = () => {
    const container = scrollContainerRef.current
    if (!container) return true

    const threshold = 50

    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    )
  }

  const handleScroll = () => {
    const isAtBottom = checkIfAtBottom()
    setIsAutoScrollEnabled(isAtBottom)
    setShowScrollToBottom(!isAtBottom)
  }

  useEffect(() => {
    if (isAutoScrollEnabled) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isAutoScrollEnabled])

  const scrollToBottom = () => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAutoScrollEnabled(true)
    setShowScrollToBottom(false)
  }

  const errorCount = logs.filter((log) => log.type === 'error').length

  const getLogColor = (type: string) => {
    switch (type) {
      case 'metadata':
        return 'text-sky-300'
      case 'ffprobe':
        return 'text-violet-300'
      case 'ffmpeg':
        return 'text-emerald-300'
      case 'assemblyai':
        return 'text-amber-200'
      case 'translation':
        return 'text-cyan-200'
      case 'error':
        return 'text-rose-300'
      default:
        return 'text-white/[0.58]'
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
      case 'assemblyai':
        return 'ASSEMBLYAI'
      case 'translation':
        return 'TRANSLATION'
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
      <div className="rounded-[1.6rem] border border-white/[0.08] bg-black/[0.24] px-6 py-12 text-center">
        <p className="display-type text-3xl text-white">No logs yet</p>
        <p className="mt-3 text-sm leading-6 text-white/[0.6]">
          Logs will appear here as soon as the task starts emitting events.
        </p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-black/[0.3]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2 text-[var(--app-accent)]">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Live Task Logs</p>
            <p className="text-xs text-white/[0.52]">
              {logs.length} entries
              {errorCount > 0 ? ` • ${errorCount} errors` : ' • no errors'}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="max-h-[560px] space-y-2 overflow-y-auto px-5 py-4 font-mono text-xs"
      >
        {logs.map((log, index) => (
          <div
            key={`${log.timestamp}-${index}`}
            className="grid gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 md:grid-cols-[100px_120px_minmax(0,1fr)]"
          >
            <span className="text-white/[0.4]">
              {formatTimestamp(log.timestamp)}
            </span>
            <span className={`font-semibold ${getLogColor(log.type)}`}>
              {getLogLabel(log.type)}
            </span>
            <span className="break-words text-white/[0.72]">{log.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {showScrollToBottom && (
        <Button
          onClick={scrollToBottom}
          size="sm"
          className="absolute right-6 bottom-6 rounded-full shadow-[0_12px_24px_rgba(0,0,0,0.25)]"
          title="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
