import { test, expect } from '@playwright/test'

const compileResult = {
  umpleClasses: [
    { name: 'Student', attributes: [{ name: 'name', type: '' }, { name: 'age', type: 'Integer' }], methods: [] },
    { name: 'Course', attributes: [{ name: 'title', type: '' }], methods: [] },
  ],
  umpleAssociations: [],
}

const schemaResponse = {
  modelId: 'playwright-model',
  schema: {
    classes: [
      {
        name: 'Student',
        isAbstract: false,
        attributes: [
          { name: 'name', type: 'String', typeKind: 'primitive', isInherited: false },
          { name: 'age', type: 'Integer', typeKind: 'primitive', isInherited: false },
        ],
        associations: [],
      },
      {
        name: 'Course',
        isAbstract: false,
        attributes: [
          { name: 'title', type: 'String', typeKind: 'primitive', isInherited: false },
        ],
        associations: [],
      },
    ],
    enums: [],
  },
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('umple-preferences-v1', JSON.stringify({
      state: { hasSeenWelcome: true },
      version: 0,
    }))
  })

  await page.route('**/api/examples', async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route('**/api/compile', async (route) => {
    await route.fulfill({
      json: {
        modelId: 'playwright-model',
        result: JSON.stringify(compileResult),
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    })
  })

  await page.route('**/api/crud/schema', async (route) => {
    await route.fulfill({ json: schemaResponse })
  })

  await page.route('**/api/crud/diagram', async (route) => {
    await route.fulfill({
      json: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>' },
    })
  })
})

test('Objects tab loads schema after compiling an example', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(`PAGE_CRASH: ${err.message}`))

  await page.goto('/')
  await page.waitForSelector('[data-testid="diagram-panel"]', { timeout: 10000 })

  // Type Umple code
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('class Student { name; Integer age; }\nclass Course { title; }')

  // Compile and wait for response
  const compilePromise = page.waitForResponse(resp => resp.url().includes('/api/compile'))
  await page.click('[data-testid="compile-button"]')
  await compilePromise

  // Switch to Objects via the diagram view dropdown
  const canvasDropdown = page.getByRole('button', { name: /Diagram view/i })
  await expect(canvasDropdown).toBeVisible()
  await canvasDropdown.click()
  const crudItem = page.getByTestId('diagram-view-crud')
  await expect(crudItem).toBeVisible()

  // Set up schema response waiter before triggering navigation
  const schemaPromise = page.waitForResponse(
    resp => resp.url().includes('/api/crud/schema'),
    { timeout: 10000 },
  )
  await crudItem.click()
  await schemaPromise

  // Verify classes appear in the Objects class list
  await expect(page.getByRole('button', { name: 'Student 0' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Course 0' })).toBeVisible({ timeout: 5000 })

  // Page should not be blank
  const body = await page.textContent('body')
  expect((body?.trim().length ?? 0) > 20, 'Page should not be blank').toBe(true)

  // No critical browser errors
  const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('/ws/lsp') && !e.includes('[lsp]'))
  expect(criticalErrors).toEqual([])
})
