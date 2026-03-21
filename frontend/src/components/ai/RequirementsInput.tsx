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
      <textarea
        value={requirements}
        onChange={(e) => setRequirements(e.target.value)}
        placeholder="Describe your system in natural language..."
        className="w-full min-h-[120px] p-2.5 text-[13px] font-[inherit] border border-slate-600 rounded bg-slate-800 text-slate-300 resize-y box-border placeholder:text-slate-600 focus:border-garnet-400 transition-colors"
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => setRequirements(prompt)}
            className="px-2.5 py-1 text-[11px] border border-slate-600 rounded-full bg-transparent text-slate-500 cursor-pointer whitespace-nowrap hover:border-slate-400 hover:text-slate-300 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      <button
        onClick={() => onGenerate(requirements)}
        disabled={loading || !requirements.trim()}
        className={`px-4 py-2 text-[13px] font-semibold border-none rounded self-start transition-colors ${
          loading || !requirements.trim()
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-garnet-600 text-white cursor-pointer hover:bg-garnet-500 active:bg-garnet-700'
        }`}
      >
        {loading ? 'Generating...' : 'Generate Umple Code'}
      </button>
    </div>
  )
}
