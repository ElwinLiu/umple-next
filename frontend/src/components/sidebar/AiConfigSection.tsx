import { useState, useEffect, useCallback, useRef } from 'react'
import { useAiConfigStore, type AiProvider } from '@/stores/aiConfigStore'
import { fetchModels, type ModelInfo } from '@/ai/models'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Tip } from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight, Eye, EyeOff, Info, Loader2, RefreshCw } from 'lucide-react'

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
]

export function AiConfigSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const provider = useAiConfigStore((state) => state.activeProvider)
  const { model, apiKey } = useAiConfigStore((state) => state.configs[state.activeProvider])
  const setActiveProvider = useAiConfigStore((state) => state.setActiveProvider)
  const setModel = useAiConfigStore((state) => state.setModel)
  const setApiKey = useAiConfigStore((state) => state.setApiKey)
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)

  // Track what we last fetched for so we don't re-fetch unnecessarily
  const lastFetchRef = useRef<string>('')

  const loadModels = useCallback(async () => {
    if (!apiKey.trim()) return
    const key = `${provider}:${apiKey}`
    lastFetchRef.current = key
    setLoadingModels(true)
    setModelError(null)
    try {
      const result = await fetchModels(provider, apiKey)
      if (lastFetchRef.current === key) setModels(result)
    } catch {
      if (lastFetchRef.current === key) {
        setModelError('Failed to load models')
        setModels([])
      }
    } finally {
      if (lastFetchRef.current === key) setLoadingModels(false)
    }
  }, [provider, apiKey])

  // Fetch models when provider or apiKey changes (debounced for key typing)
  useEffect(() => {
    lastFetchRef.current = apiKey.trim() ? `${provider}:${apiKey}` : ''

    if (!apiKey.trim()) {
      setModels([])
      setModelError(null)
      return
    }

    const timer = setTimeout(loadModels, 600)
    return () => clearTimeout(timer)
  }, [loadModels])

  // Reset models when provider changes
  useEffect(() => {
    setModels([])
    setModelError(null)
  }, [provider])

  const modelOptions = models.map((m) => {
    let label = m.name || m.id
    if (m.pricing) {
      label += ` ($${m.pricing.prompt}/$${m.pricing.completion})`
    }
    return { value: m.id, label }
  })

  const selectedModel = models.find((m) => m.id === model)
  const modelDetail = selectedModel
    ? [
        selectedModel.contextLength && `${Math.round(selectedModel.contextLength / 1000)}k ctx`,
        selectedModel.maxOutput && `${Math.round(selectedModel.maxOutput / 1000)}k out`,
      ].filter(Boolean).join(' · ')
    : null

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 pt-2.5 pb-1.5 text-[13px] font-medium text-ink hover:bg-surface-2/60 transition-colors cursor-pointer text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-ink-faint shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-ink-faint shrink-0" />
        )}
        Umple AI
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 ml-5.5 space-y-2.5">
          {/* Provider pills */}
          <div className="grid grid-cols-2 gap-1">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setActiveProvider(p.value)}
                className={`px-2 py-1 rounded-md text-xxs font-medium transition-colors cursor-pointer text-center ${
                  provider === p.value
                    ? 'bg-brand-light text-brand'
                    : 'bg-surface-1 text-ink-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* API Key */}
          <div className="relative">
            <Input
              id="ai-api-key-input"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API key"
              className="pr-12 font-mono"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <Tip content="Your key is proxied through our server but is never stored or logged." side="top">
                <button
                  type="button"
                  className="p-0.5 text-ink-faint hover:text-ink transition-colors cursor-pointer"
                  aria-label="Key security info"
                  tabIndex={-1}
                >
                  <Info className="size-3" />
                </button>
              </Tip>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="p-0.5 text-ink-faint hover:text-ink transition-colors cursor-pointer"
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                {modelOptions.length > 0 ? (
                  <Combobox
                    options={modelOptions}
                    value={model}
                    onSelect={setModel}
                    placeholder="Select model..."
                    searchPlaceholder="Search models..."
                  />
                ) : (
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={loadingModels ? 'Loading models...' : 'Model ID'}
                    disabled={loadingModels}
                  />
                )}
              </div>
              {apiKey.trim() && (
                <button
                  type="button"
                  onClick={loadModels}
                  disabled={loadingModels}
                  className="shrink-0 p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-50"
                  aria-label="Refresh models"
                >
                  {loadingModels ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                </button>
              )}
            </div>
            {modelDetail && (
              <p className="mt-1 text-xxs text-ink-faint">{modelDetail}</p>
            )}
            {modelError && (
              <p className="mt-1 text-xxs text-status-error">{modelError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
