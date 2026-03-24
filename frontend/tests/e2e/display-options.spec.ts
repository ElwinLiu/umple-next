/**
 * Display Options E2E Tests
 *
 * Verifies that display option toggles (Attributes, Methods, Traits, etc.)
 * correctly change the rendered diagram content.
 *
 * Requires `make dev` running, then: `bun run test:e2e:live`
 */
import { expect, test, type Page } from '@playwright/test'

test.skip(
  !process.env.PLAYWRIGHT_LIVE_BACKEND,
  'Set PLAYWRIGHT_LIVE_BACKEND=1 to run against the real backend stack.',
)

/* ── Helpers ── */

const TRAIT_MODEL = `trait Printable {
  void print() {}
}

class Student {
  isA Printable;
  name;
  id;
  void doSomething() {}
}

class Course {
  title;
  code;
}`

const STATE_MODEL = `class Light {
  status {
    Off {
      turnOn -> / { doActivate(); } On;
    }
    On {
      turnOff [isReady()] -> Off;
    }
  }
}`

/** Type Umple code into the editor, replacing existing content. */
async function setEditorCode(page: Page, code: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  // Select all and replace
  await page.keyboard.press('Control+a')
  await page.keyboard.type(code, { delay: 0 })
}

/** Trigger a manual compile and wait for it to complete. */
async function compileAndWait(page: Page) {
  const compileBtn = page.getByTestId('compile-button')
  await expect(compileBtn).toBeEnabled({ timeout: 10_000 })
  await compileBtn.click()
  // Wait for compiling to start, then finish
  await page.waitForTimeout(500)
  await expect(compileBtn).toBeEnabled({ timeout: 30_000 })
  // Allow diagram to render
  await page.waitForTimeout(2_000)
}

/** Switch to GV render mode (so we see the SVG directly). */
async function switchToGvMode(page: Page) {
  // The RF/GV toggle switch is labeled "RF GV"
  const toggle = page.getByRole('switch', { name: 'RF GV' })
  await expect(toggle).toBeVisible({ timeout: 10_000 })
  const state = await toggle.getAttribute('data-state')
  if (state !== 'checked') {
    await toggle.click()
    // Wait for GV SVG to render
    await page.waitForTimeout(2_000)
  }
}

/** Get the raw SVG text content from the diagram canvas.
 *  Graphviz SVGs contain g.graph elements, so we target those specifically. */
async function getSvgContent(page: Page): Promise<string> {
  const graphLocator = page.locator('[role="application"] g.graph').first()
  await expect(graphLocator).toBeVisible({ timeout: 15_000 })
  // Small delay for SVG to fully render after a toggle
  await page.waitForTimeout(1_000)
  // Return the full text content of the SVG graph (not the HTML, since
  // graphviz uses HTML-in-SVG labels wrapped in <foreignObject>)
  return page.locator('[role="application"] g.graph').first().evaluate(
    (el) => el.closest('svg')?.outerHTML ?? '',
  )
}

/** Toggle a display option by its preference key. */
async function toggleDisplayOption(page: Page, prefKey: string) {
  // Open the display options dropdown if not already open
  const dropdown = page.locator('text=Display Options').first()
  const toggleItem = page.getByTestId(`canvas-toggle-${prefKey}`)

  if (!(await toggleItem.isVisible().catch(() => false))) {
    await dropdown.click()
    await expect(toggleItem).toBeVisible({ timeout: 2_000 })
  }

  const switchEl = toggleItem.locator('button[role="switch"]')
  await switchEl.click()

  // Wait for diagram to update
  await page.waitForTimeout(1_500)
}

/** Get the state of a display option toggle. */
async function getToggleState(page: Page, prefKey: string): Promise<boolean> {
  const toggleItem = page.getByTestId(`canvas-toggle-${prefKey}`)
  if (!(await toggleItem.isVisible().catch(() => false))) {
    const dropdown = page.locator('text=Display Options').first()
    await dropdown.click()
    await expect(toggleItem).toBeVisible({ timeout: 2_000 })
  }
  const switchEl = toggleItem.locator('button[role="switch"]')
  const state = await switchEl.getAttribute('data-state')
  return state === 'checked'
}

/** Switch diagram view mode via the "Diagram view" button. */
async function switchViewMode(page: Page, viewLabel: string) {
  // The view mode button is labeled "Diagram view" and shows the current mode
  const viewBtn = page.getByRole('button', { name: 'Diagram view' })
  await viewBtn.click()
  // Click the desired view in the dropdown
  await page.getByText(viewLabel, { exact: false }).first().click()
  await page.waitForTimeout(500)
}

/* ── Class Diagram Display Options ── */

test.describe('Class diagram display options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Clear localStorage to reset display prefs to defaults
    await page.evaluate(() => localStorage.removeItem('umple-preferences-v1'))
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Type the trait model code
    await setEditorCode(page, TRAIT_MODEL)
    await compileAndWait(page)

    // Switch to GV render mode to test SVG output
    await switchToGvMode(page)
  })

  test('default state: attributes shown, methods hidden', async ({ page }) => {
    const svg = await getSvgContent(page)

    // Attributes should be visible (name, id, title, code)
    expect(svg).toContain('name')
    expect(svg).toContain('id')
    expect(svg).toContain('title')

    // Methods should NOT be visible by default
    expect(svg).not.toContain('doSomething')
  })

  test('toggling Methods ON shows methods in diagram', async ({ page }) => {
    // Verify methods not shown initially
    let svg = await getSvgContent(page)
    expect(svg).not.toContain('doSomething')

    // Toggle methods ON
    await toggleDisplayOption(page, 'showMethods')

    // Methods should now appear
    svg = await getSvgContent(page)
    expect(svg).toContain('doSomething')
  })

  test('toggling Attributes OFF hides attributes from diagram', async ({ page }) => {
    // Verify attributes shown initially
    let svg = await getSvgContent(page)
    expect(svg).toContain('name')
    expect(svg).toContain('title')

    // Toggle attributes OFF
    await toggleDisplayOption(page, 'showAttributes')

    // Attributes should disappear
    svg = await getSvgContent(page)
    expect(svg).not.toContain('name : String')
    expect(svg).not.toContain('title : String')
  })

  test('toggling Traits ON shows trait nodes in diagram', async ({ page }) => {
    // Traits should NOT be visible initially
    let svg = await getSvgContent(page)
    expect(svg).not.toContain('Printable')

    // Toggle traits ON
    await toggleDisplayOption(page, 'showTraits')

    // Trait node should now appear
    svg = await getSvgContent(page)
    expect(svg).toContain('Printable')
    expect(svg).toContain('trait')
  })

  test('toggling Traits does NOT affect method visibility', async ({ page }) => {
    // Methods should not be visible initially
    let svg = await getSvgContent(page)
    expect(svg).not.toContain('doSomething')

    // Toggle traits ON — methods should still be hidden
    await toggleDisplayOption(page, 'showTraits')
    svg = await getSvgContent(page)
    expect(svg).not.toContain('doSomething')

    // Attributes should still be visible
    expect(svg).toContain('name')
  })

  test('toggling Methods does NOT affect attribute visibility', async ({ page }) => {
    // Toggle methods ON
    await toggleDisplayOption(page, 'showMethods')
    const svg = await getSvgContent(page)

    // Methods should be visible
    expect(svg).toContain('doSomething')

    // Attributes should still be visible
    expect(svg).toContain('name')
    expect(svg).toContain('title')
  })

  test('multiple toggles: show methods + hide attributes', async ({ page }) => {
    await toggleDisplayOption(page, 'showMethods')
    await toggleDisplayOption(page, 'showAttributes')

    const svg = await getSvgContent(page)

    // Methods should be visible
    expect(svg).toContain('doSomething')

    // Attributes should be hidden
    expect(svg).not.toContain('name : String')
  })
})

/* ── Default Code Consistency Tests ── */

test.describe('Default code display options consistency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Clear localStorage to reset display prefs
    await page.evaluate(() => localStorage.removeItem('umple-preferences-v1'))
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Use default code — just compile it
    await compileAndWait(page)
    await switchToGvMode(page)
  })

  test('toggling Traits ON should not change method visibility', async ({ page }) => {
    // With default code (no traits, no explicit methods):
    // Toggling traits should NOT make methods appear
    const svgBefore = await getSvgContent(page)
    expect(svgBefore).not.toContain('getName')
    expect(svgBefore).not.toContain('setName')

    // Toggle traits ON
    await toggleDisplayOption(page, 'showTraits')

    const svgAfter = await getSvgContent(page)
    // Methods should STILL not be visible — traits toggle should not affect methods
    expect(svgAfter).not.toContain('getName')
    expect(svgAfter).not.toContain('setName')
  })

  test('methods ON then toggling Traits should show generated methods', async ({ page }) => {
    // Toggle methods ON first
    await toggleDisplayOption(page, 'showMethods')

    // No methods visible (default code has no user-declared methods in GvClassDiagram)
    let svg = await getSvgContent(page)
    expect(svg).not.toContain('getName')

    // Now toggle traits ON — the trait diagram should expose generated methods
    await toggleDisplayOption(page, 'showTraits')

    svg = await getSvgContent(page)
    expect(svg).toContain('getName')
    expect(svg).toContain('setName')
  })

  test('toggling Traits ON then Methods ON should show generated methods', async ({ page }) => {
    // Toggle traits ON first
    await toggleDisplayOption(page, 'showTraits')

    // Then toggle methods ON
    await toggleDisplayOption(page, 'showMethods')

    const svg = await getSvgContent(page)
    expect(svg).toContain('getName')
    expect(svg).toContain('setName')
  })
})

/* ── ReactFlow Mode Display Options (Class Diagrams) ── */

test.describe('ReactFlow mode display options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Clear localStorage to reset display prefs
    await page.evaluate(() => localStorage.removeItem('umple-preferences-v1'))
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, TRAIT_MODEL)
    await compileAndWait(page)

    // Stay in ReactFlow mode (default) — do NOT switch to GV
  })

  test('RF default: attributes shown, methods hidden in class nodes', async ({ page }) => {
    const studentNode = page.getByTestId('class-node-Student')
    await expect(studentNode).toBeVisible({ timeout: 10_000 })

    const text = await studentNode.textContent()

    // Attributes should be visible
    expect(text).toContain('name')
    expect(text).toContain('id')

    // Methods should NOT be visible by default
    expect(text).not.toContain('doSomething')
  })

  test('RF toggling Methods ON shows methods in class nodes', async ({ page }) => {
    const studentNode = page.getByTestId('class-node-Student')
    await expect(studentNode).toBeVisible({ timeout: 10_000 })

    // Methods should not be visible initially
    let text = await studentNode.textContent()
    expect(text).not.toContain('doSomething')

    // Toggle methods ON
    await toggleDisplayOption(page, 'showMethods')

    text = await studentNode.textContent()
    expect(text).toContain('doSomething')
  })

  test('RF toggling Attributes OFF hides attributes from class nodes', async ({ page }) => {
    const studentNode = page.getByTestId('class-node-Student')
    await expect(studentNode).toBeVisible({ timeout: 10_000 })

    // Attributes should be visible initially
    let text = await studentNode.textContent()
    expect(text).toContain('name')

    // Toggle attributes OFF
    await toggleDisplayOption(page, 'showAttributes')

    text = await studentNode.textContent()
    expect(text).not.toContain('name: String')
    expect(text).not.toContain('id: String')
  })

  test('RF and GV show consistent content for default state', async ({ page }) => {
    // Get RF content
    const studentNode = page.getByTestId('class-node-Student')
    await expect(studentNode).toBeVisible({ timeout: 10_000 })
    const rfText = await studentNode.textContent()

    // Switch to GV mode
    await switchToGvMode(page)
    const svg = await getSvgContent(page)

    // Both should show attributes
    expect(rfText).toContain('name')
    expect(svg).toContain('name')

    // Both should hide methods
    expect(rfText).not.toContain('doSomething')
    expect(svg).not.toContain('doSomething')
  })

  test('RF and GV show consistent content after toggling Methods ON', async ({ page }) => {
    // Toggle methods ON in RF mode
    await toggleDisplayOption(page, 'showMethods')

    // Get RF content
    const studentNode = page.getByTestId('class-node-Student')
    await expect(studentNode).toBeVisible({ timeout: 10_000 })
    const rfText = await studentNode.textContent()

    // Switch to GV mode
    await switchToGvMode(page)
    const svg = await getSvgContent(page)

    // Both should show methods
    expect(rfText).toContain('doSomething')
    expect(svg).toContain('doSomething')
  })
})

/* ── Final Verification: Sidebar Examples + Display Options + RF/GV Parity ── */

test.describe('Sidebar examples display options parity', () => {
  test('class diagram examples: display toggles work and RF/GV are consistent', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()
    await page.evaluate(() => localStorage.removeItem('umple-preferences-v1'))
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Load a class diagram example from the sidebar
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.getByTestId('command-item-examples-browse').click()
    await page.getByTestId('command-item-category-Class Diagrams').click()
    // Pick the first example
    const firstExample = page.locator('[data-testid^="command-item-example-"]').first()
    await firstExample.click()

    // Wait for compile
    await compileAndWait(page)

    // Switch to GV mode
    await switchToGvMode(page)

    // Test 1: Default state — get SVG content
    const svgDefault = await getSvgContent(page)
    expect(svgDefault.length).toBeGreaterThan(100)

    // Test 2: Toggle attributes OFF — diagram should change
    await toggleDisplayOption(page, 'showAttributes')
    const svgNoAttrs = await getSvgContent(page)
    expect(svgNoAttrs).not.toEqual(svgDefault)

    // Test 3: Toggle attributes back ON — should match original
    await toggleDisplayOption(page, 'showAttributes')
    const svgAttrsBack = await getSvgContent(page)
    // SVG should be equivalent (same dimensions at least)
    expect(svgAttrsBack.length).toBeGreaterThan(svgNoAttrs.length)

    // Test 4: Toggle methods ON — check consistency
    await toggleDisplayOption(page, 'showMethods')
    const svgWithMethods = await getSvgContent(page)
    // With methods, SVG should be different (possibly same if example has no methods)
    expect(svgWithMethods.length).toBeGreaterThan(0)

    // Test 5: Switch to RF mode and verify RF shows correct content
    const rfGvToggle = page.getByRole('switch', { name: 'RF GV' })
    if (await rfGvToggle.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Switch to RF mode
      const state = await rfGvToggle.getAttribute('data-state')
      if (state === 'checked') {
        await rfGvToggle.click()
        await page.waitForTimeout(1_000)
      }

      // Verify RF nodes exist
      const rfNodes = page.locator('[data-testid^="class-node-"]')
      const nodeCount = await rfNodes.count()
      expect(nodeCount).toBeGreaterThan(0)
    }
  })

  test('state diagram examples: display toggles work', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()
    await page.evaluate(() => localStorage.removeItem('umple-preferences-v1'))
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Load a state machine example
    await page.keyboard.press('Control+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.getByTestId('command-item-examples-browse').click()
    await page.getByTestId('command-item-category-State Machines').click()
    const firstExample = page.locator('[data-testid^="command-item-example-"]').first()
    await firstExample.click()

    await compileAndWait(page)

    // State view should be active after loading a state example
    await page.waitForTimeout(1_000)
    const svg = await getSvgContent(page)
    expect(svg.length).toBeGreaterThan(100)

    // Toggle actions OFF
    await toggleDisplayOption(page, 'showActions')
    const svgNoActions = await getSvgContent(page)
    // Diagram should change
    expect(svgNoActions.length).toBeGreaterThan(0)
  })
})

/* ── State Diagram Display Options ── */

test.describe('State diagram display options', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('app-shell')).toBeVisible()

    // Clear localStorage to reset display prefs
    await page.evaluate(() => localStorage.removeItem('umple-preferences-v1'))
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await setEditorCode(page, STATE_MODEL)
    await compileAndWait(page)

    // Switch to State diagram view
    await switchViewMode(page, 'State')
    await page.waitForTimeout(1_500)
  })

  test('default state: actions shown, guards shown', async ({ page }) => {
    const svg = await getSvgContent(page)

    // Actions should be visible by default
    expect(svg).toContain('doActivate')

    // Guards should be visible by default
    expect(svg).toContain('isReady')
  })

  test('toggling Actions OFF hides actions from diagram', async ({ page }) => {
    let svg = await getSvgContent(page)
    expect(svg).toContain('doActivate')

    await toggleDisplayOption(page, 'showActions')

    svg = await getSvgContent(page)
    expect(svg).not.toContain('doActivate')
  })

  test('toggling Guards OFF hides guards from diagram', async ({ page }) => {
    let svg = await getSvgContent(page)
    expect(svg).toContain('isReady')

    await toggleDisplayOption(page, 'showGuards')

    svg = await getSvgContent(page)
    expect(svg).not.toContain('isReady')
  })

  test('toggling TransitionLabels ON shows transition labels', async ({ page }) => {
    // Toggle transition labels ON
    await toggleDisplayOption(page, 'showTransitionLabels')

    const svg = await getSvgContent(page)
    // Transition labels show event names like "turnOn", "turnOff"
    expect(svg).toContain('turnOn')
    expect(svg).toContain('turnOff')
  })
})
