import { expect, test } from '@playwright/test'

const bankingModel = {
  umpleClasses: [
    {
      name: 'Account',
      attributes: [{ name: 'balance', type: '' }],
      methods: [],
    },
  ],
  umpleAssociations: [],
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/examples', async (route) => {
    await route.fulfill({
      json: [
        {
          name: 'Samples',
          examples: [
            { name: 'Banking', filename: 'banking.ump' },
          ],
        },
      ],
    })
  })

  await page.route('**/api/examples/*', async (route) => {
    await route.fulfill({
      json: {
        name: 'Banking',
        code: `class Account {\n  balance;\n}\n`,
      },
    })
  })

  await page.route('**/api/compile', async (route) => {
    await route.fulfill({
      json: {
        modelId: 'playwright-model',
        result: JSON.stringify(bankingModel),
      },
    })
  })
})

test('renders empty editor and compiles when an example is loaded', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('sidebar')).toBeVisible()
  await expect(page.getByTestId('editor-panel')).toBeVisible()
  await expect(page.getByTestId('diagram-panel')).toBeVisible()

  // Navigate through hierarchical example palette
  await page.getByLabel('Command palette').click()
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Samples').click()
  await page.getByTestId('command-item-example-Banking').click()

  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })
})

test('uses the selected diagram type for the first diagram request', async ({ page }) => {
  const diagramTypes: string[] = []

  await page.route('**/api/diagram', async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string }
    if (body.diagramType) {
      diagramTypes.push(body.diagramType)
    }

    await route.fulfill({
      json: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    })
  })

  await page.goto('/')

  // Load an example via hierarchical navigation
  await page.getByLabel('Command palette').click()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Samples').click()
  await page.getByTestId('command-item-example-Banking').click()
  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })

  // Switch diagram view — should trigger a diagram request with the new type
  await page.getByLabel('Diagram view').click()
  await page.getByTestId('diagram-view-state').click()

  await expect.poll(() => diagramTypes.at(-1)).toBe('GvStateDiagram')
})
