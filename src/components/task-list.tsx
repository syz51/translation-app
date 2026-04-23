import { Search } from 'lucide-react'
import { memo, useDeferredValue, useMemo, useState } from 'react'
import { TaskItem } from './task-item'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useExtraction } from '@/context/extraction-context'

type TaskFilter = 'all' | 'active' | 'pending' | 'completed' | 'failed'

interface TaskListProps {
  mode?: 'video' | 'srt'
}

const FILTERS: Array<{ id: TaskFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]

export const TaskList = memo(function TaskList({
  mode = 'video',
}: TaskListProps) {
  const { state } = useExtraction()
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const activeCount = state.tasks.filter(
    (task) =>
      task.status === 'processing' ||
      task.status === 'transcribing' ||
      task.status === 'translating',
  ).length

  const filteredTasks = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()

    return state.tasks.filter((task) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.fileName.toLowerCase().includes(normalizedQuery) ||
        task.filePath.toLowerCase().includes(normalizedQuery)

      if (!matchesQuery) {
        return false
      }

      switch (filter) {
        case 'active':
          return (
            task.status === 'processing' ||
            task.status === 'transcribing' ||
            task.status === 'translating'
          )
        case 'pending':
          return task.status === 'pending'
        case 'completed':
          return task.status === 'completed'
        case 'failed':
          return task.status === 'failed'
        default:
          return true
      }
    })
  }, [deferredQuery, filter, state.tasks])

  const emptyTitle =
    mode === 'video'
      ? 'No video files in the queue yet.'
      : 'No subtitle files in the queue yet.'
  const emptyDescription =
    mode === 'video'
      ? 'Add footage to start building a transcription batch.'
      : 'Add .srt files to start a subtitle translation batch.'

  return (
    <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
      <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="eyebrow-label text-white/[0.42]">Queue Board</p>
            <h3 className="display-type mt-1 text-3xl text-white">
              Track the batch in one place
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/[0.68]">
              Search by filename, isolate failures, and keep context on every
              task without leaving the workspace.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/[0.08] bg-black/[0.18] px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {state.tasks.length}
              </p>
            </div>
            <div className="rounded-3xl border border-white/[0.08] bg-black/[0.18] px-4 py-3">
              <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
                Active
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {activeCount}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-white/[0.42]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by file name or path"
              className="h-12 rounded-2xl border-white/[0.08] bg-black/[0.2] pl-11 text-white placeholder:text-white/[0.38] dark:bg-black/[0.2]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={filter === option.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(option.id)}
                className={
                  filter === option.id
                    ? 'rounded-full'
                    : 'rounded-full border-white/[0.08] bg-white/[0.03] text-white/[0.74] hover:bg-white/[0.08] hover:text-white'
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {state.tasks.length === 0 ? (
          <div className="rounded-[1.6rem] border border-white/[0.08] bg-black/[0.18] px-6 py-12 text-center">
            <p className="display-type text-3xl text-white">{emptyTitle}</p>
            <p className="mt-3 text-sm leading-6 text-white/[0.62]">
              {emptyDescription}
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="rounded-[1.6rem] border border-white/[0.08] bg-black/[0.18] px-6 py-12 text-center">
            <p className="display-type text-3xl text-white">
              Nothing matches this view.
            </p>
            <p className="mt-3 text-sm leading-6 text-white/[0.62]">
              Clear the search or switch filters to reveal the rest of the
              batch.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
})
