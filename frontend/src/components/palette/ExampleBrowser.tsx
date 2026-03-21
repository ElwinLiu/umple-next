import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../stores/editorStore'
import type { ExampleEntry } from '../../api/types'

function toTestId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function ExampleBrowser() {
  const setCode = useEditorStore((s) => s.setCode)
  const [examples, setExamples] = useState<ExampleEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingExample, setLoadingExample] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.listExamples()
      .then((list) => {
        setExamples(list)
        setError(null)
      })
      .catch((err) => setError(err.message || 'Failed to load examples'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return examples
    const term = search.toLowerCase()
    return examples.filter((ex) =>
      ex.name.toLowerCase().includes(term) ||
      (ex.category && ex.category.toLowerCase().includes(term))
    )
  }, [examples, search])

  const handleSelect = useCallback((name: string) => {
    setLoadingExample(name)
    api.getExample(name)
      .then((res) => {
        setCode(res.code)
      })
      .catch((err) => setError(err.message || 'Failed to load example'))
      .finally(() => setLoadingExample(null))
  }, [setCode])

  return (
    <div className="flex flex-col h-full" data-testid="example-browser">
      <div className="px-2.5 py-2 border-b border-border shrink-0">
        <input
          type="text"
          placeholder="Search examples..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="example-search"
          className="w-full px-2 py-1.5 text-xs border border-border rounded box-border outline-none focus:border-brand transition-colors"
        />
      </div>
      <div className="flex-1 overflow-auto py-1">
        {loading && (
          <div className="p-3 text-ink-faint text-xs">Loading examples...</div>
        )}
        {error && (
          <div className="p-3 text-red-400 text-xs">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="p-3 text-ink-faint text-xs">No examples found.</div>
        )}
        {filtered.map((ex) => (
          <div
            key={ex.name}
            onClick={() => handleSelect(ex.name)}
            data-testid={`example-item-${toTestId(ex.name)}`}
            className={`px-3 py-1.5 text-xs border-b border-border transition-colors ${
              loadingExample === ex.name
                ? 'cursor-default text-ink-faint bg-brand-light'
                : 'cursor-pointer text-ink hover:bg-brand-light'
            }`}
          >
            <div className="font-medium">{ex.name}</div>
            {ex.category && (
              <div className="text-[10px] text-ink-muted mt-px">{ex.category}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
