import { useMemo } from 'react'
import { useIsDark } from '../../hooks/useIsDark'

interface HtmlDiagramViewProps {
  html: string
}

/** Renders jar HTML output (EventSequence, StateTables) in a sandboxed iframe */
export function HtmlDiagramView({ html }: HtmlDiagramViewProps) {
  const isDark = useIsDark()

  const srcDoc = useMemo(() => {
    const bgColor = isDark ? '#1a1a1a' : '#ffffff'
    const textColor = isDark ? '#e5e5e5' : '#1a1a1a'
    const borderColor = isDark ? '#333' : '#ddd'

    // Umple's HTML output includes its own <style> blocks with hardcoded light-mode
    // colors (black borders, white/light-gray backgrounds). We inject overrides AFTER
    // the content so they win by source order at equal specificity.
    const darkOverrides = isDark ? `
  /* Override Umple's hardcoded light-mode colors */
  .statetable td,
  .statetable .state-header,
  .statetable .event-header,
  .event-sequence-grid .content-cell,
  .event-sequence-grid .column-header span,
  .event-sequence-grid .floating-col,
  .event-sequence-grid .floating-col td,
  .event-sequence-list td {
    border-color: ${borderColor} !important;
  }
  .statetable .state-header,
  .statetable .event-header {
    background-color: #252525 !important;
  }
  .event-sequence-grid .floating-col td {
    background-color: #1a1a1a !important;
  }
  h1, h2, h3, h4, h5, h6 {
    color: ${textColor};
  }
` : ''

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body>${html}
<style>
  body {
    margin: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    background: ${bgColor};
    color: ${textColor};
  }
  table {
    border-collapse: collapse;
    margin: 8px 0;
  }
  th, td {
    border: 1px solid ${borderColor};
    padding: 4px 8px;
    text-align: left;
  }
  th {
    font-weight: 600;
    background: ${isDark ? '#252525' : '#f5f5f5'};
  }
  img { max-width: 100%; }
  ${darkOverrides}
</style>
</body>
</html>`
  }, [html, isDark])

  if (!html) {
    return (
      <div className="p-6 text-ink-faint text-sm font-mono">
        No HTML diagram available. Compile a model to generate one.
      </div>
    )
  }

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      title="Diagram output"
      className="w-full h-full border-0 bg-surface-0"
      data-testid="html-diagram-iframe"
    />
  )
}
