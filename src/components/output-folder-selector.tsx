import { Folder, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'
import { useSettingsStore } from '@/hooks/use-settings-store'

export function OutputFolderSelector() {
  const { state, dispatch } = useExtraction()
  const { selectOutputFolder } = useExtractionCommands()
  const { setLastOutputPath } = useSettingsStore()

  const handleSelectFolder = async () => {
    try {
      const folder = await selectOutputFolder()
      if (folder) {
        dispatch({ type: 'SET_OUTPUT_FOLDER', folder })
        // Persist the selection for future sessions
        dispatch({ type: 'SET_LAST_OUTPUT_PATH', path: folder })
        await setLastOutputPath(folder)
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  return (
    <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-start gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-[var(--app-accent)]">
            <Folder className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow-label text-white/[0.42]">Destination</p>
            <h3 className="display-type mt-1 text-3xl text-white">
              Choose where exports land
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/[0.68]">
              The folder stays sticky for future sessions. If you do nothing,
              the app will keep using the last folder you selected.
            </p>
          </div>
        </div>

        <Button onClick={handleSelectFolder} size="lg" className="lg:min-w-44">
          <FolderOpen className="h-4 w-4" />
          Browse Folder
        </Button>
      </div>

      <div className="mt-5 grid gap-3">
        <div
          className="cursor-pointer rounded-3xl border border-white/10 bg-black/[0.18] p-4 transition-colors hover:border-white/[0.18]"
          onClick={handleSelectFolder}
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-white/[0.42] uppercase">
            Active Output Folder
          </p>
          <p className="mt-3 text-sm leading-6 break-all text-white/[0.78]">
            {state.outputFolder ||
              'Select a destination before starting the batch.'}
          </p>
        </div>

        {state.lastOutputPath &&
          state.lastOutputPath !== state.outputFolder && (
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-6 text-white/[0.62]">
              Last used folder: {state.lastOutputPath}
            </div>
          )}
      </div>
    </section>
  )
}
