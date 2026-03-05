import { createFileRoute } from '@tanstack/react-router'
import { WorkflowStudio } from '@/components/workflow-studio'

export const Route = createFileRoute('/video')({
  component: VideoTranscription,
})

function VideoTranscription() {
  return <WorkflowStudio mode="video" />
}
