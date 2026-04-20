import { expect, test, type Page } from '@playwright/test'
import type { ExampleSet } from '../../src/api/types'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

type ExamplePick = {
  setLabel: string
  exampleLabel: string
  categoryId: string
}

function addPreferencesInitScript(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem(
      'umple-preferences-v1',
      JSON.stringify({
        state: {
          hasSeenWelcome: true,
          dynamicGeneration: true,
        },
        version: 4,
      }),
    )
  })
}

async function openExamples(page: Page) {
  await page.getByTestId('app-toolbar').getByRole('button', { name: 'Examples' }).click()
}

async function loadExample(page: Page, pick: ExamplePick) {
  await openExamples(page)
  await page.getByRole('button', { name: pick.setLabel, exact: true }).click()
  await page.getByRole('button', { name: pick.exampleLabel, exact: true }).click()
}

async function expectExampleOutput(page: Page, categoryId: string) {
  if (categoryId === 'structure') {
    await expect(page.getByTestId('html-diagram-iframe')).toBeVisible({
      timeout: 20_000,
    })
    return
  }

  if (categoryId === 'class') {
    await expect(page.locator('[data-testid^="class-node-"]').first()).toBeVisible({
      timeout: 20_000,
    })
    return
  }

  await expect(page.locator('[data-testid="diagram-canvas"] svg').first()).toBeVisible({
    timeout: 20_000,
  })
}

async function chooseGenerateTarget(page: Page, query: string, label: string) {
  await page.getByRole('button', { name: 'Generate' }).click()
  await page.getByPlaceholder('Search targets...').fill(query)
  await page.getByText(label, { exact: true }).click()
}

test.describe('Live backend — examples and merged generate flow', () => {
  let picks: ExamplePick[] = []

  test.beforeAll(async ({ request, baseURL }) => {
    const health = await request.get(`${baseURL}/api/health`)
    expect(health.ok()).toBeTruthy()

    const response = await request.get(`${baseURL}/api/examples`)
    expect(response.ok()).toBeTruthy()

    const sets = (await response.json()) as ExampleSet[]
    const byCategory = new Map<string, ExamplePick>()

    for (const set of sets) {
      if (byCategory.has(set.categoryId)) continue
      const example = set.examples[0]
      if (!example) continue
      byCategory.set(set.categoryId, {
        setLabel: set.label,
        exampleLabel: example.label || example.name,
        categoryId: set.categoryId,
      })
    }

    picks = Array.from(byCategory.values())
    expect(picks.length).toBeGreaterThan(0)
  })

  test.beforeEach(async ({ page }) => {
    await addPreferencesInitScript(page)
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()
  })

  test('one example from each category loads and renders via the default output target', async ({
    page,
  }) => {
    for (const pick of picks) {
      await loadExample(page, pick)
      await expectExampleOutput(page, pick.categoryId)
    }
  })

  test('switching the Generate target updates the right panel output type', async ({
    page,
  }) => {
    const classPick = picks.find((pick) => pick.categoryId === 'class') ?? picks[0]

    await loadExample(page, classPick)
    await expectExampleOutput(page, classPick.categoryId)

    await chooseGenerateTarget(page, 'Java', 'Java Code')
    await expect(page.locator('.cm-editor').last()).toContainText('class', {
      timeout: 30_000,
    })

    await chooseGenerateTarget(page, 'Simple Metrics', 'Simple Metrics')
    await expect(page.getByTitle('Generated HTML output')).toBeVisible({
      timeout: 30_000,
    })
  })
})
