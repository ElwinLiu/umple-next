import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useUiStore } from '../../stores/uiStore'
import { api } from '../../api/client'
import { RequirementsInput } from './RequirementsInput'
import { SidePanel } from '@/components/ui/side-panel'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { lineTabClasses } from '@/components/ui/line-tab'
import { cn } from '@/lib/utils'

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

  return (
    <SidePanel title="AI Assistant" open={showAiPanel} onClose={toggleAiPanel}>
      {/* Mode tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setMode('requirements')}
          className={cn(lineTabClasses({ active: mode === 'requirements' }), 'flex-1 px-3 py-2')}
        >
          Generate from Requirements
        </button>
        <button
          onClick={() => setMode('explain')}
          className={cn(lineTabClasses({ active: mode === 'explain' }), 'flex-1 px-3 py-2')}
        >
          Explain Model
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {error && (
          <ErrorBanner className="mb-3">{error}</ErrorBanner>
        )}

        {mode === 'requirements' && (
          <RequirementsInput onGenerate={handleGenerate} loading={loading} />
        )}

        {mode === 'explain' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted m-0">
              Send the current editor code to AI for explanation.
            </p>
            <Button
              onClick={handleExplain}
              disabled={loading || !code.trim()}
              size="sm"
              className="self-start text-sm"
            >
              {loading ? 'Analyzing...' : 'Explain Current Model'}
            </Button>

            {(loading && !explanation) && (
              <div className="text-sm text-ink-muted">
                Analyzing your model...
              </div>
            )}

            {displayedText && (
              <div className="p-3 bg-surface-1 border border-border rounded text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {displayedText}
                {displayedText.length < (explanation?.length ?? 0) && (
                  <span className="text-ink-faint">|</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </SidePanel>
  )
}
