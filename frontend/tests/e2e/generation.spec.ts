import { expect, test, type Page } from '@playwright/test'
import type { GenerationRequest } from '../../src/api/types'

const CLASS_MODEL = {
  umpleClasses: [
    {
      name: 'Invoice',
      attributes: [{ name: 'number', type: '' }],
      methods: [],
    },
  ],
  umpleAssociations: [],
}

function getLastRequest(requests: GenerationRequest[]) {
  return requests[requests.length - 1]
}

function addPreferencesInitScript(
  page: Page,
  { dynamicGeneration = true }: { dynamicGeneration?: boolean } = {},
) {
  return page.addInitScript((prefs) => {
    localStorage.setItem(
      'umple-preferences-v1',
      JSON.stringify({
        state: {
          hasSeenWelcome: true,
          dynamicGeneration: prefs.dynamicGeneration,
        },
        version: 4,
      }),
    )
  }, { dynamicGeneration })
}

async function setEditorCode(page: Page, code: string) {
  await page.locator('.cm-content').first().click()
  await page.keyboard.press('Control+a')
  await page.keyboard.type(code, { delay: 0 })
}

async function chooseGenerateTarget(page: Page, targetId: string) {
  await page.getByRole('button', { name: 'Open command palette' }).click()
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.getByTestId('command-palette-input').fill(targetId)
  await page.getByTestId(`command-item-gen-${targetId}`).click()
}

async function chooseToolbarGenerateTarget(page: Page, query: string, label: string) {
  await page.getByRole('button', { name: 'Generate' }).click()
  await page.getByPlaceholder('Search targets...').fill(query)
  await page.getByText(label, { exact: true }).click()
}

async function installGenerationRoutes(page: Page, requests: GenerationRequest[]) {
  await page.route('**/api/examples', async (route) => {
    await route.fulfill({ json: [] })
  })

  await page.route('**/api/generate', async (route) => {
    const body = route.request().postDataJSON() as GenerationRequest
    requests.push(body)

    if (body.language === 'Java') {
      const className = body.code.includes('UpdatedInvoice')
        ? 'UpdatedInvoiceGenerated'
        : 'InvoiceGenerated'

      await route.fulfill({
        json: {
          modelId: 'playwright-model',
          result: JSON.stringify(CLASS_MODEL),
          generatedOutput: `public class ${className} {\n  public String getNumber() { return number; }\n}`,
          generatedLanguage: 'Java',
          generatedKind: 'text',
        },
      })
      return
    }

    if (body.language === 'SimpleMetrics') {
      await route.fulfill({
        json: {
          modelId: 'playwright-model',
          result: JSON.stringify(CLASS_MODEL),
          generatedHtml: '<html><body><h1>Simple Metrics Report</h1><p>Total classes: 1</p></body></html>',
          generatedLanguage: 'SimpleMetrics',
          generatedKind: 'html',
        },
      })
      return
    }

    if (body.language === 'javadoc') {
      await route.fulfill({
        json: {
          modelId: 'playwright-model',
          result: JSON.stringify(CLASS_MODEL),
          generatedLanguage: 'javadoc',
          generatedKind: 'iframe',
          generatedIframeUrl: 'https://example.test/generated/javadoc/index.html',
          generatedDownloads: [
            {
              label: 'Download API Docs',
              url: '/api/generated/playwright-model/javadoc.zip',
              filename: 'javadoc.zip',
            },
          ],
        },
      })
      return
    }

    if (body.diagramType === 'StructureDiagram') {
      await route.fulfill({
        json: {
          modelId: 'playwright-model',
          result: JSON.stringify(CLASS_MODEL),
          html: '<html><body><div>Structure Diagram Output</div></body></html>',
        },
      })
      return
    }

    await route.fulfill({
      json: {
        modelId: 'playwright-model',
        result: JSON.stringify(CLASS_MODEL),
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    })
  })
}

test.describe('Generation UI', () => {
  test('uses class diagram generation as the default output target', async ({ page }) => {
    const requests: GenerationRequest[] = []
    await addPreferencesInitScript(page)
    await installGenerationRoutes(page, requests)

    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, 'class Invoice { number; }')

    await expect(page.getByTestId('class-node-Invoice')).toBeVisible({
      timeout: 10_000,
    })
    await expect
      .poll(() => getLastRequest(requests)?.diagramType)
      .toBe('GvClassDiagram')
    await expect
      .poll(() => getLastRequest(requests)?.language ?? null)
      .toBe(null)
  })

  test('preserves stale generated code until manual regenerate when dynamic generation is off', async ({
    page,
  }) => {
    const requests: GenerationRequest[] = []
    await addPreferencesInitScript(page, { dynamicGeneration: false })
    await installGenerationRoutes(page, requests)

    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, 'class Invoice { number; }')
    await chooseGenerateTarget(page, 'Java')

    await expect(page.getByText('InvoiceGenerated')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('regenerate-button')).toBeVisible()
    expect(getLastRequest(requests)?.language).toBe('Java')

    await setEditorCode(page, 'class UpdatedInvoice { number; }')
    await page.waitForTimeout(900)

    expect(requests).toHaveLength(1)
    await expect(page.getByText('InvoiceGenerated')).toBeVisible()

    const regenerateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/generate') && response.request().method() === 'POST',
    )
    await page.getByTestId('regenerate-button').click()
    await regenerateResponse

    expect(requests).toHaveLength(2)
    expect(getLastRequest(requests)?.language).toBe('Java')
    await expect(page.getByText('UpdatedInvoiceGenerated')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('renders HTML diagrams in the canvas when the selected target is a diagram with HTML output', async ({
    page,
  }) => {
    const requests: GenerationRequest[] = []
    await addPreferencesInitScript(page)
    await installGenerationRoutes(page, requests)

    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, 'class Component1 { public in Integer pIn1; }\nclass Atomic { Component1 cmp1; }')
    await chooseToolbarGenerateTarget(page, 'Structure', 'Structure Diagram')

    await expect(page.getByTestId('html-diagram-iframe')).toBeVisible({
      timeout: 10_000,
    })
    await expect
      .poll(() => getLastRequest(requests)?.diagramType)
      .toBe('StructureDiagram')
  })

  test('renders generated HTML and iframe outputs for non-diagram targets', async ({
    page,
  }) => {
    const requests: GenerationRequest[] = []
    await addPreferencesInitScript(page)
    await installGenerationRoutes(page, requests)

    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, 'class Invoice { number; }')

    await chooseGenerateTarget(page, 'SimpleMetrics')
    await expect(page.getByTitle('Generated HTML output')).toBeVisible({
      timeout: 10_000,
    })
    expect(getLastRequest(requests)?.language).toBe('SimpleMetrics')

    await chooseGenerateTarget(page, 'javadoc')
    await expect(page.getByTitle('Generated output')).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('link', { name: 'Download API Docs' })).toBeVisible()
    expect(getLastRequest(requests)?.language).toBe('javadoc')
  })
})
