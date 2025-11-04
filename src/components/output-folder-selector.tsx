import { Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useExtraction } from '@/context/extraction-context'
import { useExtractionCommands } from '@/hooks/use-extraction-commands'

export function OutputFolderSelector() {
  const { state, dispatch } = useExtraction()
  const { selectOutputFolder } = useExtractionCommands()

  const handleSelectFolder = async () => {
    try {
      const folder = await selectOutputFolder()
      if (folder) {
        dispatch({ type: 'SET_OUTPUT_FOLDER', folder })
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-muted p-2">
          <Folder className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium">Output Folder</label>
          <Input
            value={state.outputFolder || ''}
            placeholder="Select a folder to save extracted audio files"
            readOnly
            className="mt-1 cursor-pointer"
            onClick={handleSelectFolder}
          />
        </div>
        <Button onClick={handleSelectFolder} variant="outline">
          Browse
        </Button>
      </div>
    </Card>
  )
}
