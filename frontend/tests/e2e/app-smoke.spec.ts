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
  // Dismiss the welcome dialog for tests
  await page.addInitScript(() => {
    localStorage.setItem('umple-preferences-v1', JSON.stringify({
      state: { hasSeenWelcome: true },
      version: 0,
    }))
  })

  await page.route('**/api/examples', async (route) => {
    await route.fulfill({
      json: [
        {
          name: 'Samples',
          examples: [
            { name: 'Banking', filename: 'banking.ump' },
          ],
        },
        {
          name: 'Composite Structure',
          examples: [
            { name: 'PingPong', filename: 'PingPong.ump' },
          ],
        },
      ],
    })
  })

  await page.route('**/api/examples/*', async (route) => {
    const name = decodeURIComponent(route.request().url().split('/').pop() ?? '')

    await route.fulfill({
      json: {
        name,
        code: name === 'PingPong'
          ? `class Component1 {\n  public in Integer pIn1;\n  public out Integer pOut1;\n}\n\nclass Atomic {\n  Component1 cmp1;\n}\n`
          : `class Account {\n  balance;\n}\n`,
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
  await expect(page.getByTestId('editor-panel')).toBeVisible()
  await expect(page.getByTestId('diagram-panel')).toBeVisible()

  // Navigate through hierarchical example palette (sidebar collapsed by default, use Ctrl+K)
  await page.keyboard.press('Control+k')
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
  await expect(page.getByTestId('app-shell')).toBeVisible()

  // Load an example via hierarchical navigation (sidebar collapsed by default, use Ctrl+K)
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Samples').click()
  await page.getByTestId('command-item-example-Banking').click()
  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })

  // Switch diagram view — should trigger a diagram request with the new type
  await page.getByLabel('Diagram view').click()
  await page.getByTestId('diagram-view-state').click()

  await expect.poll(() => diagramTypes[diagramTypes.length - 1]).toBe('GvStateDiagram')
})

test('grouped dropdown renders all 8 diagram types with group labels', async ({ page }) => {
  await page.route('**/api/diagram', async (route) => {
    await route.fulfill({ json: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>' } })
  })

  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()

  // Open the diagram view dropdown
  await page.getByLabel('Diagram view').click()

  // Verify group labels exist (scoped to label slots to avoid matching radio items)
  const labels = page.locator('[data-slot="dropdown-menu-label"]')
  await expect(labels.filter({ hasText: 'Structure' })).toBeVisible()
  await expect(labels.filter({ hasText: 'Behavior' })).toBeVisible()
  await expect(labels.filter({ hasText: 'Other' })).toBeVisible()

  // Verify all 8 diagram types are present
  for (const id of [
    'diagram-view-class', 'diagram-view-erd', 'diagram-view-feature', 'diagram-view-structure',
    'diagram-view-state', 'diagram-view-eventSequence', 'diagram-view-stateTables',
    'diagram-view-instance',
  ]) {
    await expect(page.getByTestId(id)).toBeVisible()
  }
})

test('ERD selection sends GvEntityRelationshipDiagram to backend', async ({ page }) => {
  const diagramTypes: string[] = []

  await page.route('**/api/diagram', async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string }
    if (body.diagramType) diagramTypes.push(body.diagramType)
    await route.fulfill({ json: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>' } })
  })

  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()

  // Load example to trigger compile + diagram
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Samples').click()
  await page.getByTestId('command-item-example-Banking').click()
  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })

  // Switch to ERD
  await page.getByLabel('Diagram view').click()
  await page.getByTestId('diagram-view-erd').click()

  await expect.poll(() => diagramTypes[diagramTypes.length - 1]).toBe('GvEntityRelationshipDiagram')
})

test('Event Sequence renders iframe with mocked HTML response', async ({ page }) => {
  await page.route('**/api/diagram', async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string }
    if (body.diagramType === 'EventSequence') {
      await route.fulfill({ json: { html: '<h1>Event Sequence Output</h1>' } })
    } else {
      await route.fulfill({ json: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>' } })
    }
  })

  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()

  // Load example
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Samples').click()
  await page.getByTestId('command-item-example-Banking').click()
  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })

  // Switch to Event Sequence
  await page.getByLabel('Diagram view').click()
  await page.getByTestId('diagram-view-eventSequence').click()

  // Verify iframe is rendered
  await expect(page.getByTestId('html-diagram-iframe')).toBeVisible({ timeout: 5_000 })
})

test('Feature view renders SVG diagram from backend', async ({ page }) => {
  const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
    <g id="graph0" class="graph"><polygon fill="white" stroke="none" points="0,0 400,0 400,-200 0,-200"/>
    <g id="node1" class="node"><title>Root</title><polygon fill="none" stroke="black" points="60,-80 140,-80 140,-40 60,-40"/><text x="100" y="-55">Root</text></g>
    <g id="node2" class="node"><title>Child</title><polygon fill="none" stroke="black" points="220,-80 300,-80 300,-40 220,-40"/><text x="260" y="-55">Child</text></g>
    </g></svg>`

  await page.route('**/api/diagram', async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string }

    if (body.diagramType === 'GvFeatureDiagram') {
      await route.fulfill({ json: { svg: featureSvg } })
      return
    }

    await route.fulfill({
      json: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>' },
    })
  })

  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Samples').click()
  await page.getByTestId('command-item-example-Banking').click()
  await expect(page.getByTestId('class-node-Account')).toBeVisible({ timeout: 10_000 })

  await page.getByLabel('Diagram view').click()
  await page.getByTestId('diagram-view-feature').click()

  // SmartSvgView renders SVG with node data attributes
  await expect(page.locator('[data-node-id="Root"]')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('[data-node-id="Child"]')).toBeVisible()
})

test('loading a composite structure example switches to structure view and renders its SVG', async ({ page }) => {
  const diagramTypes: string[] = []
  const structureHtml = `
    <svg id="svgCanvas" xmlns="http://www.w3.org/2000/svg" width="400" height="200">
      <text x="115" y="85">Atomic</text>
    </svg>
  `

  await page.route('**/api/diagram', async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string }
    if (body.diagramType) {
      diagramTypes.push(body.diagramType)
    }

    await route.fulfill({
      json: {
        html: body.diagramType === 'StructureDiagram' ? structureHtml : undefined,
        svg: body.diagramType === 'StructureDiagram'
          ? ''
          : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    })
  })

  await page.goto('/')
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-item-examples-browse').click()
  await page.getByTestId('command-item-category-Composite Structure').click()
  await page.getByTestId('command-item-example-PingPong').click()

  await expect.poll(() => diagramTypes[diagramTypes.length - 1]).toBe('StructureDiagram')
  await expect(page.getByLabel('Diagram view')).toContainText('Structure')
  await expect(page.getByTestId('html-diagram-iframe')).toBeVisible({ timeout: 5_000 })
})
