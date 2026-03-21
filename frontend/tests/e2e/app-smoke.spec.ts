import { expect, test } from '@playwright/test'

const defaultModel = {
  umpleClasses: [
    {
      name: 'Student',
      attributes: [
        { name: 'name', type: '' },
        { name: 'id', type: '' },
      ],
      methods: [],
    },
    {
      name: 'Course',
      attributes: [
        { name: 'title', type: '' },
        { name: 'code', type: '' },
      ],
      methods: [],
    },
  ],
  umpleAssociations: [
    {
      end1: { className: 'Student', multiplicity: '*', roleName: '' },
      end2: { className: 'Course', multiplicity: '*', roleName: '' },
    },
  ],
}

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
          name: 'Banking',
          filename: 'banking.ump',
          category: 'Samples',
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
    const body = route.request().postDataJSON() as { code?: string }
    const model = body.code?.includes('Account') ? bankingModel : defaultModel

    await route.fulfill({
      json: {
        modelId: 'playwright-model',
        result: JSON.stringify(model),
      },
    })
  })
})

test('renders the default model and recompiles when an example is loaded', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('app-header')).toBeVisible()
  await expect(page.getByTestId('editor-panel')).toBeVisible()
  await expect(page.getByTestId('diagram-panel')).toBeVisible()

  await expect(page.getByTestId('class-node-Student')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('class-node-Course')).toBeVisible()
  await expect(page.getByTestId('edge-label-assoc-0-source-multiplicity')).toHaveText('*')
  await expect(page.getByTestId('edge-label-assoc-0-target-multiplicity')).toHaveText('*')

  await page.locator('button[title="Command palette"]').click()
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-palette-input').fill('Banking')
  await page.getByTestId('command-item-example-Banking').click()

  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('class-node-Student')).toHaveCount(0)
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

  await page.locator('button[title="Diagram view"]').click()
  await page.getByTestId('diagram-view-state').click()

  await expect.poll(() => diagramTypes.at(-1)).toBe('GvStateDiagram')
})
