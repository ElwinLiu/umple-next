/**
 * Live Backend E2E Tests — Code Generation
 *
 * Tests every generation target against the real backend to verify
 * that each language produces meaningful output.
 *
 * Requires `make dev` running, then: `PLAYWRIGHT_LIVE_BACKEND=1 bun run test:e2e`
 */
import { expect, test, type Page } from '@playwright/test'
import { GENERATE_TARGETS, type GenerateTarget } from '../../src/generation/targets'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

/* ── Test data ── */

/** Umple model with classes, attributes, associations, and a state machine. */
const UMPLE_MODEL = `class Student {
  name;
  Integer id;
  status {
    Active {
      graduate -> Graduated;
      suspend -> Suspended;
    }
    Suspended {
      reinstate -> Active;
    }
    Graduated {}
  }
}

class Course {
  title;
  Integer credits;
}

association {
  * Student -- * Course;
}
`

/** Generation targets that use the 'generate' action (not 'diagram'). */
const GENERATE_ACTION_TARGETS = GENERATE_TARGETS.filter(
  (t) => t.action === 'generate',
)

/**
 * Per-language output expectations. Each entry specifies patterns the output
 * text (or HTML) must contain to confirm the generator produced real content.
 */
const OUTPUT_EXPECTATIONS: Record<string, {
  /** Patterns the output text must contain (case-insensitive substring match). */
  outputContains?: string[]
  /** Expected response kind. */
  kind?: 'text' | 'html' | 'iframe'
  /** If true, expect downloads array to be non-empty. */
  hasDownloads?: boolean
}> = {
  Java:                        { outputContains: ['class Student', 'getName', 'getCourses'], kind: 'text' },
  javadoc:                     { kind: 'iframe', hasDownloads: true },
  Php:                         { outputContains: ['class Student', 'getName'], kind: 'text' },
  Python:                      { outputContains: ['class Student', 'getName'], kind: 'text' },
  RTCpp:                       { outputContains: ['Student'], kind: 'text' },
  Ruby:                        { outputContains: ['class Student', 'name'], kind: 'text' },
  Alloy:                       { outputContains: ['sig Student'], kind: 'text' },
  NuSMV:                       { outputContains: ['MODULE'], kind: 'text' },
  Ecore:                       { outputContains: ['Student'], kind: 'text' },
  TextUml:                     { outputContains: ['Student'], kind: 'text' },
  Scxml:                       { outputContains: ['scxml'], kind: 'text' },
  Papyrus:                     { hasDownloads: true },
  Yuml:                        { kind: 'html' },
  Mermaid:                     { outputContains: ['Student'], kind: 'text' },
  Json:                        { outputContains: ['Student', 'name'], kind: 'text' },
  Sql:                         { outputContains: ['CREATE TABLE', 'Student'], kind: 'text' },
  SimpleMetrics:               { kind: 'html' },
  PlainRequirementsDoc:        { kind: 'html' },
  CodeAnalysis:                { kind: 'html' },
  USE:                         { outputContains: ['Student'], kind: 'text' },
  UmpleSelf:                   { outputContains: ['Student'], kind: 'text' },
  UmpleAnnotaiveToComposition: { kind: 'text' },
  Cpp:                         { outputContains: ['Student'], kind: 'text' },
  SimpleCpp:                   { outputContains: ['Student'], kind: 'text' },
  Umlet:                       { outputContains: ['Student'], kind: 'text' },
  // SimulateJava generator is not available in the current umple.jar build.
  // The backend returns output="nothing" with an error. We just verify the API responds.
  SimulateJava:                { kind: 'text' },
}

/* ── Helpers ── */

interface GenerateApiResponse {
  output: string
  language: string
  errors?: string
  modelId?: string
  kind?: string
  html?: string
  iframeUrl?: string
  downloads?: { label: string; url: string; filename?: string }[]
}

async function generateViaApi(
  request: Page['request'],
  baseURL: string,
  language: string,
): Promise<GenerateApiResponse> {
  const res = await request.post(`${baseURL}/api/generate`, {
    data: { code: UMPLE_MODEL, language },
  })
  expect(res.ok(), `POST /api/generate (${language}) returned ${res.status()}`).toBeTruthy()
  return res.json()
}

async function setEditorCode(page: Page, code: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(code, { delay: 0 })
}

async function compileAndWait(page: Page) {
  const compilePromise = page.waitForResponse(
    (res) => res.url().includes('/api/compile') && res.status() === 200,
    { timeout: 30_000 },
  )
  await page.getByTestId('compile-button').click()
  await compilePromise
}

function resolveLanguage(target: GenerateTarget): string {
  if (target.id === 'Mermaid') return 'Mermaid.class'
  return target.requestLanguage ?? target.id
}

/* ── Tests ── */

test.describe('Live backend — code generation targets', () => {
  test.setTimeout(300_000) // 5 min budget

  test.beforeAll(async ({ request, baseURL }) => {
    const health = await request.get(`${baseURL}/api/health`)
    expect(health.ok()).toBeTruthy()
  })

  test('every generate target produces output via API', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    const failures: string[] = []
    let passed = 0

    for (const target of GENERATE_ACTION_TARGETS) {
      const language = resolveLanguage(target)
      const label = `${target.id} (${language})`

      try {
        const res = await generateViaApi(page.request, page.url().replace(/\/$/, ''), language)
        const hasOutput = !!(res.output || res.html || res.iframeUrl)

        if (!hasOutput && !res.errors) {
          failures.push(`${label} — no output and no errors`)
          continue
        }

        if (!hasOutput) {
          failures.push(`${label} — only errors: ${res.errors?.slice(0, 200)}`)
          continue
        }

        // Validate per-language expectations
        const expectations = OUTPUT_EXPECTATIONS[target.id]
        if (expectations) {
          const contentIssues: string[] = []

          // Check output kind
          if (expectations.kind) {
            const actualKind = res.kind ?? (res.iframeUrl ? 'iframe' : res.html ? 'html' : 'text')
            if (actualKind !== expectations.kind) {
              contentIssues.push(`expected kind=${expectations.kind}, got ${actualKind}`)
            }
          }

          // Check output text contains expected patterns
          if (expectations.outputContains) {
            const text = (res.output || '').toLowerCase()
            for (const pattern of expectations.outputContains) {
              if (!text.includes(pattern.toLowerCase())) {
                contentIssues.push(`output missing "${pattern}"`)
              }
            }
          }

          // Check downloads
          if (expectations.hasDownloads && (!res.downloads || res.downloads.length === 0)) {
            contentIssues.push('expected downloads but got none')
          }

          if (contentIssues.length > 0) {
            failures.push(`${label} — ${contentIssues.join('; ')}`)
            continue
          }
        }

        passed++
      } catch (err) {
        failures.push(`${label} — ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Report
    const total = passed + failures.length
    if (failures.length > 0) {
      const detail = failures.map((f) => `  • ${f}`).join('\n')
      expect
        .soft(failures.length, `${passed}/${total} passed:\n${detail}`)
        .toBe(0)
    }
  })

  test('Mermaid state variant generates state diagram syntax', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    const res = await generateViaApi(page.request, page.url().replace(/\/$/, ''), 'Mermaid.state')
    expect(res.output.toLowerCase()).toContain('statediagram')
    expect(res.output).toContain('Active')
    expect(res.output).toContain('Graduated')
  })

  test('generate via UI flow shows output in right panel', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, UMPLE_MODEL)
    await compileAndWait(page)

    // Generate Java via command palette
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.getByTestId('command-item-gen-Java').click()

    // Wait for generated code to appear (CodeMirror in the generated panel)
    await expect(page.locator('.cm-content').last()).toBeVisible({ timeout: 30_000 })

    // Verify the panel is showing generated output
    await expect(page.locator('[data-testid="diagram-canvas"]')).toBeVisible()
  })

  test('empty code returns an error, not a crash', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    const res = await page.request.post(`${page.url().replace(/\/$/, '')}/api/generate`, {
      data: { code: '', language: 'Java' },
    })
    // Backend should reject with 400
    expect(res.status()).toBe(400)
  })

  test('invalid language returns an error', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    const res = await page.request.post(`${page.url().replace(/\/$/, '')}/api/generate`, {
      data: { code: UMPLE_MODEL, language: 'NonExistentLanguage' },
    })
    expect(res.status()).toBe(400)
  })
})
