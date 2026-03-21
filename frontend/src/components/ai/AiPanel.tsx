import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useUiStore } from '../../stores/uiStore'
import { api } from '../../api/client'
import { RequirementsInput } from './RequirementsInput'

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
    <div className="fixed top-[44px] right-0 w-[400px] bottom-0 bg-slate-900 border-l border-slate-700 flex flex-col z-[100] text-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
        <span className="font-semibold text-sm text-slate-200">AI Assistant</span>
        <button
          onClick={toggleAiPanel}
          className="bg-transparent border-none text-slate-500 cursor-pointer text-lg px-1 hover:text-slate-300 transition-colors"
        >
          x
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setMode('requirements')}
          className={`flex-1 px-3 py-2 text-xs border-none cursor-pointer transition-colors ${
            mode === 'requirements'
              ? 'font-semibold border-b-2 border-b-garnet-400 bg-transparent text-garnet-400'
              : 'font-normal border-b-2 border-b-transparent bg-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Generate from Requirements
        </button>
        <button
          onClick={() => setMode('explain')}
          className={`flex-1 px-3 py-2 text-xs border-none cursor-pointer transition-colors ${
            mode === 'explain'
              ? 'font-semibold border-b-2 border-b-garnet-400 bg-transparent text-garnet-400'
              : 'font-normal border-b-2 border-b-transparent bg-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Explain Model
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {error && (
          <div className="px-3 py-2 mb-3 bg-red-950 border border-red-900 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {mode === 'requirements' && (
          <RequirementsInput onGenerate={handleGenerate} loading={loading} />
        )}

        {mode === 'explain' && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-slate-500 m-0">
              Send the current editor code to AI for explanation.
            </p>
            <button
              onClick={handleExplain}
              disabled={loading || !code.trim()}
              className={`px-4 py-2 text-[13px] font-semibold border-none rounded self-start transition-colors ${
                loading || !code.trim()
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-garnet-600 text-white cursor-pointer hover:bg-garnet-500 active:bg-garnet-700'
              }`}
            >
              {loading ? 'Analyzing...' : 'Explain Current Model'}
            </button>

            {(loading && !explanation) && (
              <div className="text-[13px] text-slate-500">
                Analyzing your model...
              </div>
            )}

            {displayedText && (
              <div className="p-3 bg-slate-800 border border-slate-600 rounded text-[13px] leading-relaxed whitespace-pre-wrap">
                {displayedText}
                {displayedText.length < (explanation?.length ?? 0) && (
                  <span className="opacity-50">|</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
