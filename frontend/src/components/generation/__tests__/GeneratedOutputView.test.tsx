// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GeneratedOutputView } from '../GeneratedOutputView'

vi.mock('../CodeOutput', () => ({
  CodeOutput: () => <div data-testid="code-output" />,
}))

describe('GeneratedOutputView', () => {
  it('allows scripts for iframe output', () => {
    render(
      <GeneratedOutputView
        kind="iframe"
        code=""
        html=""
        iframeUrl="/api/generated/tmp123/javadoc/index.html"
        language="Java"
        downloads={[]}
      />
    )

    expect(screen.getByTitle('Generated output').getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('keeps html srcDoc output fully sandboxed', () => {
    render(
      <GeneratedOutputView
        kind="html"
        code=""
        html="<p>hello</p>"
        iframeUrl={null}
        language="Yuml"
        downloads={[]}
      />
    )

    expect(screen.getByTitle('Generated HTML output').getAttribute('sandbox')).toBe('')
  })
})
