import { useEffect, useRef, useCallback, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { getEditorTheme } from '../../codemirror/theme'
import { useIsDark } from '../../hooks/useIsDark'

interface CodeOutputProps {
  code: string
  language: string
}

function getLanguageExtension(language: string) {
  switch (language.toLowerCase()) {
    case 'java':
      return java()
    case 'python':
      return python()
    case 'php':
    case 'ruby':
    case 'cpp':
    case 'rtcpp':
    case 'simplecpp':
      // Use Java as a reasonable fallback for C-like / curly-brace languages
      return java()
    default:
      // No language extension for JSON, SQL, Alloy, NuSMV, USE, Ecore, etc.
      return null
  }
}

export function CodeOutput({ code, language }: CodeOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [copied, setCopied] = useState(false)
  const isDark = useIsDark()

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [code])

  useEffect(() => {
    if (!containerRef.current) return

    const langExt = getLanguageExtension(language)
    const extensions = [
      basicSetup,
      EditorState.readOnly.of(true),
      ...getEditorTheme(isDark),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ]
    if (langExt) extensions.push(langExt)

    const state = EditorState.create({
      doc: code,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [code, language, isDark])

  return (
    <div className="h-full relative">
      <button
        onClick={handleCopy}
        className={`absolute top-2 right-3 z-10 px-2.5 py-1 text-[11px] border rounded cursor-pointer transition-colors ${
          copied
            ? 'bg-surface-1 text-status-success border-status-success'
            : 'bg-surface-0 text-ink-muted border-border hover:bg-surface-1 hover:border-border-strong'
        }`}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
      />
    </div>
  )
}
