import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { WorkflowType } from '@/types/extraction'
import { WorkflowToggle } from '@/components/workflow-toggle'
import { UnifiedDropZone } from '@/components/unified-drop-zone'
import { LanguageSelector } from '@/components/language-selector'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'
import { useSrtTranslationCommands } from '@/hooks/use-srt-translation-commands'
import { env } from '@/env'

export const Route = createFileRoute('/new-task')({
  component: NewTask,
})

function NewTask() {
  const { state, dispatch } = useExtraction()
  const { startExtraction } = useExtractionCommands()
  const { startTranslation } = useSrtTranslationCommands()

  const [selectedFiles, setSelectedFiles] = useState<Array<string>>([])
  const workflowType = state.workflowType

  const handleWorkflowChange = (type: WorkflowType) => {
    dispatch({ type: 'SET_WORKFLOW_TYPE', workflowType: type })
    setSelectedFiles([]) // Clear files when switching workflow
  }

  const handleFilesSelected = (files: Array<string>) => {
    setSelectedFiles((prev) => [...prev, ...files])
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStart = async () => {
    if (selectedFiles.length === 0 || !state.targetLanguage) {
      return
    }

    // Generate complete task objects with IDs upfront
    const tasks = selectedFiles.map((filePath) => ({
      id: crypto.randomUUID(),
      fileName: filePath.split(/[/\\]/).pop() || filePath,
      filePath,
      status: 'pending' as const,
      logs: [],
      targetLanguage: state.targetLanguage,
    }))

    dispatch({
      type: 'ADD_TASKS',
      tasks,
    })

    dispatch({ type: 'START_PROCESSING' })

    try {
      if (workflowType === 'video') {
        await startExtraction(tasks, env.VITE_BACKEND_URL, state.targetLanguage)
      } else {
        await startTranslation(
          tasks,
          state.targetLanguage,
          env.VITE_BACKEND_URL,
        )
      }

      // Backend now returns immediately - re-enable button so user can add more tasks
      dispatch({ type: 'STOP_PROCESSING' })
      setSelectedFiles([]) // Clear after starting
    } catch (error) {
      console.error('Failed to start:', error)
      alert(`Failed to start task: ${error}`)
      dispatch({ type: 'STOP_PROCESSING' })
    }
  }

  const canStart =
    selectedFiles.length > 0 && state.targetLanguage && !state.isProcessing

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="container mx-auto max-w-4xl p-6">
        <header className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">New Task</h1>
          <p className="text-muted-foreground">
            Select workflow type and configure your transcription or translation
            task
          </p>
        </header>

        <div className="space-y-6">
          {/* Workflow Toggle */}
          <section>
            <WorkflowToggle
              value={workflowType}
              onChange={handleWorkflowChange}
            />
          </section>

          {/* Drop Zone */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              {workflowType === 'video'
                ? 'Select Video Files'
                : 'Select Subtitle Files'}
            </h2>
            <UnifiedDropZone
              workflowType={workflowType}
              selectedFiles={selectedFiles}
              onFilesSelected={handleFilesSelected}
              onRemoveFile={handleRemoveFile}
            />
          </section>

          {/* Configuration Panel */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Configuration
            </h2>
            <div className="space-y-4">
              <LanguageSelector />
            </div>
          </section>

          {/* Start Button */}
          <section>
            <Button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full"
              size="lg"
            >
              {state.isProcessing
                ? 'Processing...'
                : workflowType === 'video'
                  ? 'Start Extraction, Transcription & Translation'
                  : 'Start Translation'}
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}
