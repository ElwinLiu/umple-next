import { useState } from 'react'

const EXAMPLE_PROMPTS = [
  'University system with students, courses, and professors',
  'Library management with books, members, and loans',
  'Hospital system with patients, doctors, and appointments',
  'E-commerce with products, orders, and customers',
]

interface RequirementsInputProps {
  onGenerate: (requirements: string) => void
  loading: boolean
}

export function RequirementsInput({ onGenerate, loading }: RequirementsInputProps) {
  const [requirements, setRequirements] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="ai-requirements">Describe your system</label>
      <textarea
        id="ai-requirements"
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
        placeholder="Describe your system in natural language..."
        className="w-full min-h-[120px] p-2.5 text-[13px] font-[inherit] border border-border rounded bg-surface-1 text-ink resize-y box-border placeholder:text-ink-faint focus:border-brand outline-none transition-colors"
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setRequirements(prompt)}
            className="px-2.5 py-1 text-[11px] border border-border rounded-full bg-transparent text-ink-muted cursor-pointer whitespace-nowrap hover:border-border-strong hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          >
            {prompt}
          </button>
        ))}
      </div>

      <button
        onClick={() => onGenerate(requirements)}
        disabled={loading || !requirements.trim()}
        className="px-4 py-2 text-[13px] font-semibold border-none rounded self-start transition-colors bg-brand text-ink-inverse cursor-pointer hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
      >
        {loading ? 'Generating...' : 'Generate Umple Code'}
      </button>
    </div>
  )
}
