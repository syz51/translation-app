import { createFileRoute } from '@tanstack/react-router'
import { WorkflowStudio } from '@/components/workflow-studio'

export const Route = createFileRoute('/srt')({ component: SrtTranslation })

function SrtTranslation() {
  return <WorkflowStudio mode="srt" />
}
