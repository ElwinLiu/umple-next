/**
 * Live LSP E2E Tests
 *
 * Verifies LSP features work end-to-end against the real backend stack:
 *  1. Cross-tab `use` statement compilation
 *  2. LSP connection (diagnostics appear for syntax errors)
 *
 * Requires the full stack running: `make dev`, then `bun run test:e2e:live`
 */
import { expect, test, type Page } from '@playwright/test'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

/** Trigger a manual compile and wait for it to complete. */
async function compileAndWait(page: Page) {
  const compileBtn = page.getByTestId('compile-button')
  const compilePromise = page.waitForResponse(
    (res) => res.url().includes('/api/compile') && res.status() === 200,
    { timeout: 30_000 },
  )
  await expect(compileBtn).toBeEnabled({ timeout: 10_000 })
  await compileBtn.click()
  await compilePromise
  await expect(compileBtn).toBeEnabled({ timeout: 30_000 })
}

/** Type code into the editor (replaces all content). */
async function setEditorCode(page: Page, code: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(code, { delay: 10 })
}

test.describe('Live backend — cross-tab use statements', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome dialog
    await page.addInitScript(() => {
      localStorage.setItem('umple-preferences-v1', JSON.stringify({
        state: { hasSeenWelcome: true, autoCompile: false },
        version: 0,
      }))
    })
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()
  })

  test('class in a second tab can be referenced via use statement', async ({ page }) => {
    // Type the main model with a use statement
    await setEditorCode(page, 'use Person.ump;\nclass Student {\n  isA Person;\n  studentId;\n}\n')
    await compileAndWait(page)

    // Create a new tab
    await page.getByTestId('add-tab-button').click()

    // Rename the new tab to Person.ump
    const newTab = page.getByTestId('tab-bar').locator('[data-testid^="tab-"]').last()
    await newTab.dblclick()
    const input = page.locator('input[data-testid="tab-rename-input"]')
    await input.fill('Person.ump')
    await input.press('Enter')

    // Type Person class in the new tab
    await setEditorCode(page, 'class Person {\n  name;\n  age;\n}\n')
    await compileAndWait(page)

    // Switch back to first tab
    await page.getByTestId('tab-bar').locator('[data-testid^="tab-"]').first().click()
    await compileAndWait(page)

    // The compilation should succeed — Student class should appear in the diagram
    // (if it failed, use statement couldn't resolve Person.ump)
    const outputPanel = page.getByTestId('output-panel')
    const hasError = await outputPanel.locator('text=/Error/i').count() > 0
    expect(hasError).toBe(false)
  })
})

test.describe('Live backend — LSP diagnostics', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('umple-preferences-v1', JSON.stringify({
        state: { hasSeenWelcome: true, autoCompile: false },
        version: 0,
      }))
    })
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()
  })

  test('syntax error shows diagnostic underline in editor', async ({ page }) => {
    // Type valid code first to establish a model (triggers LSP connection)
    await setEditorCode(page, 'class Foo {\n  name;\n}\n')
    await compileAndWait(page)

    // Wait for LSP to connect (it needs modelId from first compile)
    await page.waitForTimeout(2000)

    // Now introduce a syntax error
    await setEditorCode(page, 'class Foo {\n  name\n}\n')

    // Wait for LSP diagnostics to appear (shown as cm-lintRange markers)
    // The exact timing depends on the LSP server, give it generous timeout
    const diagnostic = page.locator('.cm-lintRange-error, .cm-lintRange-warning, .cm-diagnostic')
    await expect(diagnostic.first()).toBeVisible({ timeout: 10_000 })
  })
})
