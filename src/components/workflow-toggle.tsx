import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type WorkflowType = 'video' | 'srt'

interface WorkflowToggleProps {
  value: WorkflowType
  onChange: (value: WorkflowType) => void
}

export function WorkflowToggle({ value, onChange }: WorkflowToggleProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as WorkflowType)}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="video">Video Transcription</TabsTrigger>
        <TabsTrigger value="srt">Subtitle Translation</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
