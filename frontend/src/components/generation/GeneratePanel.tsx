import { useState, useCallback } from 'react'
import { CodeOutput } from './CodeOutput'
import { useEditorStore } from '../../stores/editorStore'
import { api } from '../../api/client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const UMPLE_TARGETS = [
  'Java', 'Php', 'Python', 'Ruby', 'Cpp', 'RTCpp', 'SimpleCpp',
  'Json', 'Sql', 'Alloy', 'NuSMV', 'USE', 'Ecore', 'TextUml', 'Umlet', 'SimulateJava',
] as const

export function GeneratePanel() {
  const code = useEditorStore((s) => s.code)
  const modelId = useEditorStore((s) => s.modelId)
  const [language, setLanguage] = useState('Java')
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!code.trim()) return
    setGenerating(true)
    setError(null)
    setOutput('')

    try {
      const res = await api.generate({
        code,
        language,
        modelId: modelId ?? undefined,
      })
      setOutput(res.output)
      if (res.errors) {
        setError(res.errors)
      }
    } catch (err: any) {
      setError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [code, language, modelId])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-1 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-ink-muted">Generate:</span>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-6 px-2 text-xs border-border" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UMPLE_TARGETS.map((target) => (
              <SelectItem key={target} value={target} className="text-xs">
                {target}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleGenerate}
          disabled={generating || !code.trim()}
          size="xs"
          className="font-semibold"
        >
          {generating ? 'Generating...' : 'Generate'}
        </Button>
        {error && (
          <span className="text-status-error text-[11px] ml-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {error}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {output ? (
          <CodeOutput code={output} language={language} />
        ) : (
          <div className="p-6 text-ink-faint text-[13px]">
            Select a target language and click Generate to see output.
          </div>
        )}
      </div>
    </div>
  )
}
