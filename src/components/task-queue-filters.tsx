import { useMemo } from 'react'
import type { FilterStatus, TaskStatus } from '@/types/extraction'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useExtraction } from '@/context/extraction-context'

const isRunningStatus = (status: TaskStatus): boolean => {
  return ['processing', 'transcribing', 'translating'].includes(status)
}

export function TaskQueueFilters() {
  const { state, dispatch } = useExtraction()

  const counts = useMemo(() => {
    const all = state.tasks.length
    const running = state.tasks.filter((t) => isRunningStatus(t.status)).length
    const failed = state.tasks.filter((t) => t.status === 'failed').length

    return { all, running, failed }
  }, [state.tasks])

  const handleFilterChange = (value: string) => {
    dispatch({
      type: 'SET_FILTER_STATUS',
      filterStatus: value as FilterStatus,
    })
  }

  return (
    <Tabs
      value={state.filterStatus}
      onValueChange={handleFilterChange}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="all" className="gap-2">
          All
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {counts.all}
          </span>
        </TabsTrigger>
        <TabsTrigger value="running" className="gap-2">
          Running
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary-foreground">
            {counts.running}
          </span>
        </TabsTrigger>
        <TabsTrigger value="failed" className="gap-2">
          Failed
          <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs text-destructive-foreground">
            {counts.failed}
          </span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
