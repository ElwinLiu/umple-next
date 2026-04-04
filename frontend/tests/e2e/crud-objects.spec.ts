import { test, expect } from '@playwright/test'

test('Objects tab loads schema after compiling an example', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', err => errors.push(`PAGE_CRASH: ${err.message}`))

  await page.goto('/')
  await page.waitForSelector('[data-testid="diagram-panel"]', { timeout: 10000 })

  // Dismiss welcome dialog if present
  const skipBtn = page.getByText("Skip, I'll explore on my own")
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click()
  }

  // Type Umple code
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('class Student { name; Integer age; }\nclass Course { title; }')

  // Compile and wait for response
  const compilePromise = page.waitForResponse(resp => resp.url().includes('/api/compile'))
  await page.click('[data-testid="compile-button"]')
  await compilePromise

  // Switch to Objects via the canvas dropdown
  const canvasDropdown = page.getByRole('button', { name: /Switch canvas view/i })
  await expect(canvasDropdown).toBeVisible()
  await canvasDropdown.click()
  const objectsItem = page.getByRole('menuitem', { name: /Objects/i })
  await expect(objectsItem).toBeVisible()

  // Set up schema response waiter before triggering navigation
  const schemaPromise = page.waitForResponse(
    resp => resp.url().includes('/api/crud/schema'),
    { timeout: 10000 },
  )
  await objectsItem.click()
  await schemaPromise

  // Verify classes appear in the Objects view
  await expect(page.getByText('Student')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Course')).toBeVisible({ timeout: 5000 })

  // Page should not be blank
  const body = await page.textContent('body')
  expect((body?.trim().length ?? 0) > 20, 'Page should not be blank').toBe(true)

  // No critical browser errors
  const criticalErrors = errors.filter(e => !e.includes('favicon'))
  expect(criticalErrors).toEqual([])
})
