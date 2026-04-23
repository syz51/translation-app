import { Languages } from 'lucide-react'
import { useExtraction } from '@/context/extraction-context'

const LANGUAGES = [
  {
    code: 'English',
    label: 'English',
    detail: 'Best for international review and editing passes.',
  },
  {
    code: 'Chinese Simplified',
    label: 'Chinese Simplified',
    detail: 'Optimized for simplified Chinese subtitle delivery.',
  },
] as const

export function LanguageSelector() {
  const { state, dispatch } = useExtraction()

  const handleLanguageChange = (value: string) => {
    dispatch({ type: 'SET_TARGET_LANGUAGE', language: value })
  }

  return (
    <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-[var(--app-highlight)]">
          <Languages className="h-6 w-6" />
        </div>
        <div>
          <p className="eyebrow-label text-white/[0.42]">Target Language</p>
          <h3 className="display-type mt-1 text-3xl text-white">
            Pick the delivery language
          </h3>
          <p className="mt-3 text-sm leading-6 text-white/[0.68]">
            The selection is treated as a core workflow decision, so it is now
            exposed as a direct choice instead of a buried dropdown.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {LANGUAGES.map((lang) => {
          const isActive = state.targetLanguage === lang.code

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleLanguageChange(lang.code)}
              className={`rounded-3xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-[#48bbad]/50 bg-[linear-gradient(135deg,rgba(72,187,174,0.16),rgba(72,187,174,0.05))] shadow-[0_16px_30px_rgba(72,187,174,0.12)]'
                  : 'border-white/10 bg-black/[0.18] hover:border-white/[0.18]'
              }`}
            >
              <p className="text-lg font-semibold text-white">{lang.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/[0.62]">
                {lang.detail}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
