import { useState, useEffect, useCallback, useRef } from 'react'
import { useAiConfigStore, type AiProvider } from '@/stores/aiConfigStore'
import { fetchModels, type ModelInfo } from '@/ai/models'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, ChevronRight, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
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
        <div className="px-4 pb-3 pt-0.5 ml-5.5">
          <div className="space-y-3">
            {/* Provider */}
            <div>
              <label className="block text-xxs font-medium text-ink-muted mb-1">Provider</label>
              <Select value={provider} onValueChange={(v) => setActiveProvider(v as AiProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xxs font-medium text-ink-muted mb-1" htmlFor="ai-api-key-input">
                API Key
              </label>
              <div className="relative">
                <Input
                  id="ai-api-key-input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-7 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-ink-faint hover:text-ink transition-colors cursor-pointer"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
              <p className="mt-1 text-xxs text-ink-faint">
                Your key is proxied through our server but is never stored or logged.
              </p>
            </div>

            {/* Model */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xxs font-medium text-ink-muted">Model</label>
                {apiKey.trim() && (
                  <button
                    type="button"
                    onClick={loadModels}
                    disabled={loadingModels}
                    className="text-ink-faint hover:text-ink transition-colors cursor-pointer disabled:opacity-50"
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
                  placeholder={loadingModels ? 'Loading models...' : 'Enter model ID...'}
                  disabled={loadingModels}
                />
              )}
              {modelDetail && (
                <p className="mt-1 text-xxs text-ink-faint">{modelDetail}</p>
              )}
              {modelError && (
                <p className="mt-1 text-xxs text-status-error">{modelError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
