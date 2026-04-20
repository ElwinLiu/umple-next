import { expect, test, type Page } from '@playwright/test'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

async function setEditorCode(page: Page, code: string) {
  const editor = page.locator('.cm-content').first()
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(code, { delay: 0 })
}

async function regenerateAndWait(page: Page) {
  const response = page.waitForResponse(
    (res) => res.url().includes('/api/generate') && res.status() === 200,
    { timeout: 30_000 },
  )
  const button = page.getByTestId('regenerate-button')
  await expect(button).toBeEnabled({ timeout: 10_000 })
  await button.click()
  await response
  await expect(button).toBeEnabled({ timeout: 30_000 })
}

async function renameLastTab(page: Page, nextName: string) {
  const lastTab = page.getByRole('tab').last()
  await lastTab.dblclick()
  const input = page.getByRole('textbox', { name: /Rename .*\.ump/ })
  await input.fill(nextName.replace(/\.ump$/, ''))
  await input.press('Enter')
}

test.describe('Live backend — LSP with merged generate flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'umple-preferences-v1',
        JSON.stringify({
          state: {
            hasSeenWelcome: true,
            dynamicGeneration: false,
          },
          version: 4,
        }),
      )
    })

    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()
  })

  test('class in a second tab can be referenced via use statement after regenerate', async ({
    page,
  }) => {
    await setEditorCode(
      page,
      'use Person.ump;\nclass Student {\n  isA Person;\n  studentId;\n}\n',
    )
    await regenerateAndWait(page)

    await page.getByRole('button', { name: 'New file' }).click()
    await renameLastTab(page, 'Person.ump')
    await setEditorCode(page, 'class Person {\n  name;\n  age;\n}\n')
    await regenerateAndWait(page)

    await page.getByRole('tab', { name: /^Model/ }).click()
    await regenerateAndWait(page)

    await expect(page.getByTestId('class-node-Person')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('class-node-Student')).toBeVisible({ timeout: 20_000 })
  })

  test('syntax errors surface editor diagnostics after a model has been generated', async ({
    page,
  }) => {
    await setEditorCode(page, 'class Foo {\n  name;\n}\n')
    await regenerateAndWait(page)

    await page.waitForTimeout(2000)
    await setEditorCode(page, 'class Foo {\n  name\n}\n')

    const diagnostic = page.locator('.cm-lintRange-error, .cm-lintRange-warning, .cm-diagnostic')
    await expect(diagnostic.first()).toBeVisible({ timeout: 10_000 })
  })
})
