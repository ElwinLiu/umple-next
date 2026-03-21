import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useUiStore } from '../../stores/uiStore'
import { api } from '../../api/client'
import { RequirementsInput } from './RequirementsInput'
import { X } from 'lucide-react'

type AiMode = 'requirements' | 'explain'

export function AiPanel() {
  const showAiPanel = useUiStore((s) => s.showAiPanel)
  const toggleAiPanel = useUiStore((s) => s.toggleAiPanel)
  const code = useEditorStore((s) => s.code)
  const setCode = useEditorStore((s) => s.setCode)

  const [mode, setMode] = useState<AiMode>('requirements')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Progressive display effect for explanation text
  useEffect(() => {
    if (!explanation) {
      setDisplayedText('')
      return
    }

    let index = 0
    setDisplayedText('')
    intervalRef.current = setInterval(() => {
      index += 3
      if (index >= explanation.length) {
        setDisplayedText(explanation)
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setDisplayedText(explanation.slice(0, index))
      }
    }, 15)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [explanation])

  const handleGenerate = useCallback(async (requirements: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.aiRequirements(requirements)
      setCode(res.code)
    } catch (err: any) {
      setError(err.message || 'Failed to generate code')
    } finally {
      setLoading(false)
    }
  }, [setCode])

  const handleExplain = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExplanation(null)
    try {
      const res = await api.aiExplain(code)
      setExplanation(res.explanation)
    } catch (err: any) {
      setError(err.message || 'Failed to explain model')
    } finally {
      setLoading(false)
    }
  }, [code])

  if (!showAiPanel) return null

  return (
    <div className="fixed top-14 right-0 w-full sm:w-[400px] bottom-0 bg-surface-0 border-l border-border flex flex-col z-[100] text-ink">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1">
        <span className="font-semibold text-sm">AI Assistant</span>
        <button
          onClick={toggleAiPanel}
          className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
          aria-label="Close AI panel"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setMode('requirements')}
          className={`flex-1 px-3 py-2 text-xs border-none cursor-pointer transition-colors ${
            mode === 'requirements'
              ? 'font-semibold border-b-2 border-b-brand bg-surface-0 text-brand'
              : 'font-normal border-b-2 border-b-transparent bg-transparent text-ink-muted hover:text-ink'
          }`}
        >
          Generate from Requirements
        </button>
        <button
          onClick={() => setMode('explain')}
          className={`flex-1 px-3 py-2 text-xs border-none cursor-pointer transition-colors ${
            mode === 'explain'
              ? 'font-semibold border-b-2 border-b-brand bg-surface-0 text-brand'
              : 'font-normal border-b-2 border-b-transparent bg-transparent text-ink-muted hover:text-ink'
          }`}
        >
          Explain Model
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {error && (
          <div className="px-3 py-2 mb-3 bg-brand-light border border-status-error rounded text-status-error text-xs">
            {error}
          </div>
        )}

        {mode === 'requirements' && (
          <RequirementsInput onGenerate={handleGenerate} loading={loading} />
        )}

        {mode === 'explain' && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-muted m-0">
              Send the current editor code to AI for explanation.
            </p>
            <button
              onClick={handleExplain}
              disabled={loading || !code.trim()}
              className="px-4 py-2 text-[13px] font-semibold border-none rounded self-start transition-colors bg-brand text-ink-inverse cursor-pointer hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1"
            >
              {loading ? 'Analyzing...' : 'Explain Current Model'}
            </button>

            {(loading && !explanation) && (
              <div className="text-[13px] text-ink-muted">
                Analyzing your model...
              </div>
            )}

            {displayedText && (
              <div className="p-3 bg-surface-1 border border-border rounded text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
                {displayedText}
                {displayedText.length < (explanation?.length ?? 0) && (
                  <span className="text-ink-faint">|</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
