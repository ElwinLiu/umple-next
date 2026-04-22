// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GeneratedOutputView } from '../GeneratedOutputView'

vi.mock('../CodeOutput', () => ({
  CodeOutput: ({ code, testId = 'code-output' }: { code: string; testId?: string }) => <div data-testid={testId}>{code}</div>,
}))

afterEach(() => {
  cleanup()
})

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
        files={[]}
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
        files={[]}
      />
    )

    expect(screen.getByTitle('Generated HTML output').getAttribute('sandbox')).toBe('')
  })

  it('renders text output in a searchable pre block by default', () => {
    render(
      <GeneratedOutputView
        kind="text"
        code={'public class Invoice {}\npublic class Customer {}'}
        html=""
        iframeUrl={null}
        language="Java"
        downloads={[]}
        files={[]}
      />
    )

    const allCode = screen.getByTestId('generated-output-all-code')
    expect(allCode.tagName).toBe('PRE')
    expect(allCode.textContent).toContain('public class Invoice {}')
    expect(screen.getByTestId('generated-output-highlighted-all-code').textContent).toContain('public class Customer {}')
    expect(screen.queryByTestId('code-output')).toBeNull()
  })

  it('shows an all-code tab first and lets users switch to generated files', async () => {
    const user = userEvent.setup()

    render(
      <GeneratedOutputView
        kind="text"
        code={'public class Invoice {}\npublic class Customer {}'}
        html=""
        iframeUrl={null}
        language="Java"
        downloads={[]}
        files={[
          {
            name: 'Invoice.java',
            path: 'billing/Invoice.java',
            content: 'public class Invoice {}',
          },
          {
            name: 'Customer.java',
            path: 'billing/Customer.java',
            content: 'public class Customer {}',
          },
        ]}
      />
    )

    expect(screen.getByRole('tab', { name: 'All code' }).getAttribute('data-state')).toBe('active')
    expect(screen.getAllByTestId('generated-output-all-code').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Customer.java' }))

    expect(screen.getByRole('tab', { name: 'Customer.java' }).getAttribute('data-state')).toBe('active')
    expect(screen.getByTestId('code-output').textContent).toContain('public class Customer {}')
  })
})
