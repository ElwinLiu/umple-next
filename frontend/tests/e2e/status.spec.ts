import { expect, test } from '@playwright/test'

test.describe('Status dashboard', () => {
  test('renders the compact grouped status layout without dropping status payload groups', async ({ page }) => {
    await page.route('**/api/status', async (route) => {
      await route.fulfill({
        json: {
          status: 'ok',
          generatedAt: '2026-04-23T20:13:17Z',
          uptimeSeconds: 7384,
          build: {
            sourceCommit: 'e3cdcad2cf7de3b9e510efc58856086406004718',
            sourceRefName: 'master',
          },
          release: {
            releaseTag: 'v0.0.8',
            sourceCommit: 'e3cdcad2cf7de3b9e510efc58856086406004718',
          },
          process: {
            pid: 42,
          },
          config: {
            executionUrl: 'http://code-exec:3000',
          },
          dependencies: [
            { name: 'txlBinary', status: 'ok', path: '/usr/local/bin/txl' },
            { name: 'modelStore', status: 'ok', path: '/app/data/models' },
          ],
          checks: {
            umplesyncJar: { status: 'ok' },
            executionService: { status: 'ok' },
          },
          umplesync: {
            status: 'ok',
            alive: true,
            port: 3002,
            log: 'Umple compiler listener ready',
          },
          services: {
            codeExecution: { status: 'ok', url: 'http://code-exec:3000/status' },
            collaboration: { status: 'ok', url: 'http://collab:3003/status' },
            lsp: { status: 'ok', url: 'http://lsp:3004/status' },
          },
          counters: {
            sessionsStarted: 3,
          },
          legacy: {
            software: [{ name: 'java', status: 'ok', path: '/usr/bin/java' }],
            listener: { status: 'ok', port: 3002 },
            docker: {
              status: 'ok',
              stats: [{ name: 'umpleonline-backend', status: 'ok', cpu: '0.2%' }],
            },
            execution: { status: 'ok' },
            visits: { status: 'not_tracked' },
          },
        },
      })
    })

    await page.goto('/status')

    await expect(page.getByRole('heading', { name: 'UmpleOnline Status' })).toBeVisible()
    await expect(page.getByTestId('status-dashboard')).toBeVisible()
    await expect(page.getByText('Backend uptime')).toBeVisible()
    await expect(page.getByText('Service health')).toBeVisible()
    await expect(page.getByTestId('status-service-health')).toContainText('Code Execution')
    await expect(page.getByTestId('status-service-health')).toContainText('txlBinary')
    await expect(page.getByTestId('status-release-runtime')).toContainText('e3cdcad2cf7de3b9e510efc58856086406004718')
    await expect(page.getByTestId('status-release-runtime')).toContainText('http://code-exec:3000')
    await expect(page.getByTestId('status-umplesync')).toContainText('Umple compiler listener ready')
    await expect(page.getByTestId('status-diagnostics')).toContainText('Legacy software')
    await expect(page.getByTestId('status-diagnostics')).toContainText('umpleonline-backend')
    await expect(page.locator('.react-resizable-handle')).toHaveCount(0)
    await expect(page.locator('.status-widget-drag-handle')).toHaveCount(0)
  })
})
