import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_LIVE_BACKEND, 'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.')

test('default model compiles against the live backend', async ({ page, request, baseURL }) => {
  const health = await request.get(`${baseURL}/api/health`)
  expect(health.ok()).toBeTruthy()

  await page.goto('/')

  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('editor-panel')).toBeVisible()
  await expect(page.getByTestId('diagram-panel')).toBeVisible()
  await expect(page.getByTestId('class-node-Student')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('class-node-Course')).toBeVisible({ timeout: 15_000 })
})
