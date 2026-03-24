/**
 * Live Backend E2E Tests
 *
 * Traverses every example through the UI, verifying:
 *  1. The example loads and compiles successfully
 *  2. A diagram renders (ReactFlow nodes, SVG elements, or HTML iframe)
 *  3. SVG diagrams contain no hardcoded inline colors that bypass theming
 *
 * Requires `make dev` running, then: `bun run test:e2e:live`
 */
import { expect, test, type Page } from '@playwright/test'
import type { ExampleCategory } from '../../src/api/types'
import { EXAMPLE_CATEGORY_TO_VIEW } from '../../src/constants/diagram'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

/* ── Helpers ── */

/** Load an example via the command palette. */
async function loadExample(page: Page, category: string, name: string) {
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId(`command-item-category-${category}`).click()
  await page.getByTestId(`command-item-example-${name}`).click()
}

/** Wait for compilation to finish (compile button becomes enabled again). */
async function waitForCompile(page: Page) {
  const compileBtn = page.getByTestId('compile-button')
  // Wait for compiling to start (button becomes disabled)
  await expect(compileBtn).toBeDisabled({ timeout: 5_000 })
  // Then wait for it to finish — the button re-enables
  await expect(compileBtn).toBeEnabled({ timeout: 30_000 })
}

/**
 * Wait for a diagram to render based on the expected view type.
 * Returns 'class' | 'svg' | 'html' indicating which renderer was used.
 */
async function waitForDiagram(page: Page, view: string): Promise<'class' | 'svg' | 'html'> {
  if (view === 'class') {
    await expect(page.locator('[data-testid^="class-node-"]').first()).toBeVisible({ timeout: 15_000 })
    return 'class'
  }
  if (view === 'structure') {
    await expect(page.getByTestId('html-diagram-iframe')).toBeVisible({ timeout: 15_000 })
    return 'html'
  }
  // SVG-based views: state, feature, erd, instance
  await expect(page.locator('[data-testid="diagram-canvas"] svg g.node').first()).toBeVisible({ timeout: 15_000 })
  return 'svg'
}

/**
 * Check the rendered SVG for hardcoded inline colors that survive
 * SmartSvgView's sanitizer (i.e. colors in inline `style` attributes).
 * Presentation attributes (fill/stroke) are stripped by processSvg,
 * but inline styles are not.
 */
async function checkSvgThemeCompat(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const SAFE = new Set(['none', 'transparent', 'currentcolor'])
    const issues: string[] = []
    const canvas = document.querySelector('[data-testid="diagram-canvas"]')
    if (!canvas) return issues

    // Dark mode compatibility check: scan EVERY shape and text element in
    // the SVG, not just the ones the sanitizer targets. Any hardcoded
    // inline color that survives processSvg will render with that fixed
    // color in both themes — typically invisible (e.g. black-on-black)
    // in dark mode. By using a broader selector than the sanitizer, this
    // test catches gaps in its selector coverage. (This approach was
    // adopted after .cluster > text missed deeply nested cluster labels
    // that Graphviz wraps in extra <g> elements.)
    canvas
      .querySelectorAll('svg text, svg polygon, svg ellipse, svg path, svg polyline, svg rect, svg circle, svg line')
      .forEach((el) => {
        // Check presentation attributes — these should have been stripped
        for (const attr of ['fill', 'stroke', 'color']) {
          const val = el.getAttribute(attr)
          if (!val) continue
          const v = val.trim().toLowerCase()
          if (SAFE.has(v) || v.startsWith('var(') || v.startsWith('url(')) continue
          issues.push(`<${el.tagName}> has ${attr}="${val}"`)
        }

        // Check inline style for hardcoded color values
        const style = el.getAttribute('style')
        if (style) {
          const matches = style.match(/(?:fill|stroke|color)\s*:\s*([^;]+)/gi)
          if (matches) {
            for (const m of matches) {
              const val = m.split(':')[1]?.trim().toLowerCase()
              if (!val || SAFE.has(val) || val.startsWith('var(') || val.startsWith('url(')) continue
              issues.push(`<${el.tagName}> has style with ${m.trim()}`)
            }
          }
        }
      })
    return issues
  })
}

/* ── Tests ── */

test.describe('Live backend — all examples', () => {
  test.setTimeout(600_000) // 10 min budget for ~85 examples

  let categories: ExampleCategory[] = []

  test.beforeAll(async ({ request, baseURL }) => {
    const health = await request.get(`${baseURL}/api/health`)
    expect(health.ok()).toBeTruthy()

    const res = await request.get(`${baseURL}/api/examples`)
    expect(res.ok()).toBeTruthy()
    categories = (await res.json()) as ExampleCategory[]
    expect(categories.length).toBeGreaterThan(0)
  })

  test('every example compiles and renders a themed diagram', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    const compileFailures: string[] = []
    const diagramFailures: string[] = []
    const themeFailures: { example: string; issues: string[] }[] = []
    let passed = 0

    for (const cat of categories) {
      const view = EXAMPLE_CATEGORY_TO_VIEW[cat.name]
      if (!view) continue // skip categories we don't map (e.g. "Other")

      for (const ex of cat.examples) {
        const label = `${cat.name} / ${ex.name}`

        // Load via command palette
        try {
          await loadExample(page, cat.name, ex.name)
        } catch {
          compileFailures.push(`${label} — failed to load via command palette`)
          continue
        }

        // Wait for compilation
        try {
          await waitForCompile(page)
        } catch {
          compileFailures.push(`${label} — compilation timed out`)
          continue
        }

        // Wait for diagram to render
        let renderer: 'class' | 'svg' | 'html'
        try {
          renderer = await waitForDiagram(page, view)
        } catch {
          diagramFailures.push(`${label} — diagram did not render (expected ${view} view)`)
          continue
        }

        // For SVG-rendered diagrams, check theme compatibility
        if (renderer === 'svg') {
          const issues = await checkSvgThemeCompat(page)
          if (issues.length > 0) {
            // Deduplicate
            const unique = [...new Set(issues)]
            themeFailures.push({ example: label, issues: unique })
          }
        }

        passed++
      }
    }

    // Report results
    const total = passed + compileFailures.length + diagramFailures.length
    const lines: string[] = []

    if (compileFailures.length > 0) {
      lines.push(
        `\n⚠ ${compileFailures.length} compile/load failure(s):`,
        ...compileFailures.map((f) => `  • ${f}`),
      )
    }

    if (diagramFailures.length > 0) {
      lines.push(
        `\n⚠ ${diagramFailures.length} diagram render failure(s):`,
        ...diagramFailures.map((f) => `  • ${f}`),
      )
    }

    if (themeFailures.length > 0) {
      const allColors = new Set(themeFailures.flatMap((f) => f.issues))
      lines.push(
        `\n⚠ ${themeFailures.length} SVG theme issue(s) (colors: ${[...allColors].join(', ')}):`,
        ...themeFailures.map(
          (f) => `  • ${f.example}: ${f.issues.join('; ')}`,
        ),
      )
    }

    const failCount = compileFailures.length + diagramFailures.length + themeFailures.length
    if (failCount > 0) {
      expect
        .soft(failCount, `${passed}/${total} passed, ${failCount} failed:${lines.join('\n')}`)
        .toBe(0)
    }
  })
})
