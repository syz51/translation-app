import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { useExtraction } from '@/context/extraction-context'

const LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Chinese Simplified', label: 'Chinese Simplified' },
] as const

export function LanguageSelector() {
  const { state, dispatch } = useExtraction()

  const handleLanguageChange = (value: string) => {
    dispatch({ type: 'SET_TARGET_LANGUAGE', language: value })
  }

  return (
    <Card className="p-6">
      <div className="space-y-3">
        <label className="text-sm font-medium">Target Language</label>
        <Select
          value={state.targetLanguage || undefined}
          onValueChange={handleLanguageChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select target language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  )
}
