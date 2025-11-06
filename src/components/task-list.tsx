import { memo } from 'react'
import { TaskItem } from './task-item'
import { Card } from '@/components/ui/card'
import { useExtraction } from '@/context/extraction-context'

export const TaskList = memo(function TaskList() {
  const { state } = useExtraction()

  if (state.tasks.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <p>No files selected yet</p>
          <p className="mt-1 text-sm">
            Add video files to start extracting audio
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {state.tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  )
})
