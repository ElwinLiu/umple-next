import type { GeneratedArtifact } from '../../api/types'
import { CodeOutput } from './CodeOutput'

interface GeneratedOutputViewProps {
  kind: 'text' | 'html' | 'iframe'
  code: string
  html: string
  iframeUrl: string | null
  language: string
  downloads: GeneratedArtifact[]
}

function DownloadLinks({ downloads }: { downloads: GeneratedArtifact[] }) {
  if (downloads.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-1/60 shrink-0">
      {downloads.map((download) => (
        <a
          key={`${download.url}-${download.label}`}
          href={download.url}
          download={download.filename}
          className="inline-flex items-center rounded-md border border-border bg-surface-0 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:border-border-strong transition-colors"
        >
          {download.label}
        </a>
      ))}
    </div>
  )
}

export function GeneratedOutputView({
  kind,
  code,
  html,
  iframeUrl,
  language,
  downloads,
}: GeneratedOutputViewProps) {
  if (kind === 'iframe' && iframeUrl) {
    return (
      <div className="h-full flex flex-col">
        <DownloadLinks downloads={downloads} />
        <iframe
          src={iframeUrl}
          title="Generated output"
          sandbox="" /* all restrictions enabled */
          className="flex-1 w-full border-0 bg-surface-0"
        />
      </div>
    )
  }

  if (kind === 'html') {
    return (
      <div className="h-full flex flex-col">
        <DownloadLinks downloads={downloads} />
        <iframe
          srcDoc={html}
          title="Generated HTML output"
          sandbox="" /* all restrictions enabled */
          className="flex-1 w-full border-0 bg-surface-0"
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <DownloadLinks downloads={downloads} />
      <div className="flex-1 min-h-0">
        <CodeOutput code={code} language={language} />
      </div>
    </div>
  )
}
