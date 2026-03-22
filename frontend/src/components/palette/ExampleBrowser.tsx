import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../api/client'
import { useEditorStore } from '../../stores/editorStore'
import type { ExampleCategory } from '../../api/types'

function toTestId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function ExampleBrowser() {
  const loadExample = useEditorStore((s) => s.loadExample)
  const [categories, setCategories] = useState<ExampleCategory[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingExample, setLoadingExample] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.listExamples()
      .then((cats) => {
        setCategories(cats)
        setError(null)
      })
      .catch((err) => setError(err.message || 'Failed to load examples'))
      .finally(() => setLoading(false))
  }, [])

  const allExamples = useMemo(
    () => categories.flatMap((cat) =>
      cat.examples.map((ex) => ({ ...ex, category: cat.name }))
    ),
    [categories]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return allExamples
    const term = search.toLowerCase()
    return allExamples.filter((ex) =>
      ex.name.toLowerCase().includes(term) ||
      ex.category.toLowerCase().includes(term)
    )
  }, [allExamples, search])

  const handleSelect = useCallback((name: string) => {
    setLoadingExample(name)
    api.getExample(name)
      .then((res) => {
        loadExample(res.name, res.code)
      })
      .catch((err) => setError(err.message || 'Failed to load example'))
      .finally(() => setLoadingExample(null))
  }, [loadExample])

  return (
    <div className="flex flex-col h-full" data-testid="example-browser">
      <div className="px-2.5 py-2 border-b border-border shrink-0">
        <input
          type="text"
          placeholder="Search examples..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="example-search"
          aria-label="Search examples"
          className="w-full px-2 py-1.5 text-xs border border-border rounded box-border outline-none focus:border-brand transition-colors"
        />
      </div>
      <div className="flex-1 overflow-auto py-1">
        {loading && (
          <div className="p-3 text-ink-faint text-xs">Loading examples...</div>
        )}
        {error && (
          <div className="p-3 text-status-error text-xs">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="p-3 text-ink-faint text-xs">No examples found.</div>
        )}
        {filtered.map((ex) => (
          <button
            key={`${ex.category}-${ex.name}`}
            onClick={() => handleSelect(ex.name)}
            data-testid={`example-item-${toTestId(ex.name)}`}
            className={`w-full text-left px-3 py-1.5 text-xs border-x-0 border-t-0 border-b border-border bg-transparent transition-colors focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px] ${
              loadingExample === ex.name
                ? 'cursor-default text-ink-faint bg-brand-light'
                : 'cursor-pointer text-ink hover:bg-brand-light'
            }`}
          >
            <div className="font-medium">{ex.name}</div>
            <div className="text-2xs text-ink-muted mt-px">{ex.category}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
