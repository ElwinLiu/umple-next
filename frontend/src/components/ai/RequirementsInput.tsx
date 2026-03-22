import { useState } from 'react'
import { Button } from '@/components/ui/button'

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
        className="w-full min-h-[120px] p-2.5 text-sm border border-border rounded bg-surface-1 text-ink resize-y box-border placeholder:text-ink-faint focus:border-brand outline-none transition-colors"
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setRequirements(prompt)}
            className="px-2.5 py-1 text-xs border border-border rounded-full bg-transparent text-ink-muted cursor-pointer whitespace-nowrap hover:border-border-strong hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          >
            {prompt}
          </button>
        ))}
      </div>

      <Button
        onClick={() => onGenerate(requirements)}
        disabled={loading || !requirements.trim()}
        size="sm"
        className="self-start text-sm"
      >
        {loading ? 'Generating...' : 'Generate Umple Code'}
      </Button>
    </div>
  )
}
