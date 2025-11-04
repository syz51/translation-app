import { createFileRoute } from '@tanstack/react-router'
import { Music } from 'lucide-react'
import { FileSelector } from '@/components/file-selector'
import { OutputFolderSelector } from '@/components/output-folder-selector'
import { TaskList } from '@/components/task-list'
import { ProgressSummary } from '@/components/progress-summary'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <Music className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Audio Extractor</h1>
              <p className="text-muted-foreground">
                Extract audio from video files to WAV format
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {/* File Selection */}
          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Select Videos</h2>
            <FileSelector />
          </section>

          {/* Output Folder Selection */}
          <section>
            <h2 className="mb-3 text-xl font-semibold">
              2. Choose Output Folder
            </h2>
            <OutputFolderSelector />
          </section>

          {/* Progress Summary */}
          <section>
            <h2 className="mb-3 text-xl font-semibold">3. Start Extraction</h2>
            <ProgressSummary />
          </section>

          {/* Task List */}
          <section>
            <h2 className="mb-3 text-xl font-semibold">Files</h2>
            <TaskList />
          </section>
        </div>
      </div>
    </div>
  )
}
