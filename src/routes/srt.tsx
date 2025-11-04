import { createFileRoute } from '@tanstack/react-router'
import { FileText } from 'lucide-react'
import { SrtFileSelector } from '@/components/srt-file-selector'
import { LanguageSelector } from '@/components/language-selector'
import { OutputFolderSelector } from '@/components/output-folder-selector'
import { TaskList } from '@/components/task-list'
import { ProgressSummary } from '@/components/progress-summary'

export const Route = createFileRoute('/srt')({ component: SrtTranslation })

function SrtTranslation() {
  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">SRT Translation</h1>
              <p className="text-muted-foreground">
                Translate existing SRT subtitle files
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Select SRT Files</h2>
            <SrtFileSelector />
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">
              2. Choose Target Language
            </h2>
            <LanguageSelector />
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">
              3. Choose Output Folder
            </h2>
            <OutputFolderSelector />
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">4. Start Translation</h2>
            <ProgressSummary />
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Files</h2>
            <TaskList />
          </section>
        </div>
      </div>
    </div>
  )
}
