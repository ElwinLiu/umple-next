import { expect, test, type Page } from '@playwright/test'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

const STATE_MODEL = `class Light {
  status {
    Off {
      turnOn -> On;
    }
    On {
      turnOff -> Off;
    }
  }
}
`

async function setEditorCode(page: Page, code: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(code, { delay: 0 })
}

async function compileAndWait(page: Page) {
  const compileButton = page.getByTestId('compile-button')
  await expect(compileButton).toBeEnabled({ timeout: 10_000 })
  await compileButton.click()
  await page.waitForTimeout(500)
  await expect(compileButton).toBeEnabled({ timeout: 30_000 })
  await page.waitForTimeout(2_000)
}

test.describe('Live backend — diagram selection', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('umple-preferences-v1', JSON.stringify({
        state: { hasSeenWelcome: true },
        version: 0,
      }))
    })
  })

  test.beforeAll(async ({ request, baseURL }) => {
    const health = await request.get(`${baseURL}/api/health`)
    expect(health.ok()).toBeTruthy()
  })

  test('clicking a state diagram node highlights the corresponding source', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, STATE_MODEL)
    await page.getByLabel('Diagram view').click()
    await page.getByTestId('diagram-view-state').click()
    await compileAndWait(page)

    await expect(page.locator('[data-testid="diagram-canvas"] [data-node-id]').first()).toBeVisible({ timeout: 15_000 })

    const nodeIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-node-id]'))
        .map((el) => el.getAttribute('data-node-id') ?? '')
        .filter(Boolean),
    )

    const targetId = nodeIds.find((id) => id === 'Off')
      ?? nodeIds.find((id) => id === 'On')
      ?? nodeIds.find((id) => id === 'status')
      ?? nodeIds.find((id) => /Off/i.test(id))
      ?? nodeIds.find((id) => /On/i.test(id))
      ?? nodeIds.find((id) => /status/i.test(id))

    expect(targetId, `No clickable state node found. SVG node ids: ${nodeIds.join(', ')}`).toBeTruthy()

    await page.locator(`[data-node-id="${targetId}"]`).click()

    await expect(page.getByTestId('smart-svg-selected-id')).toContainText(targetId as string)
    await expect.poll(async () => page.locator('.cm-selectionBackground').count(), {
      message: `Expected editor highlight after clicking "${targetId}"`,
      timeout: 5_000,
    }).toBeGreaterThan(0)
  })
})
