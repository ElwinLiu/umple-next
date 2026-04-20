import { expect, test } from "@playwright/test";

const bankingModel = {
  umpleClasses: [
    {
      name: "Account",
      attributes: [{ name: "balance", type: "" }],
      methods: [],
    },
  ],
  umpleAssociations: [],
};

test.beforeEach(async ({ page }) => {
  // Dismiss the welcome dialog for tests
  await page.addInitScript(() => {
    localStorage.setItem(
      "umple-preferences-v1",
      JSON.stringify({
        state: { hasSeenWelcome: true },
        version: 0,
      }),
    );
  });

  await page.route("**/api/examples", async (route) => {
    await route.fulfill({
      json: [
        {
          id: "example-set-1",
          label: "Samples",
          categoryId: "class",
          examples: [
            {
              id: "ex-banking",
              name: "Banking",
              label: "Banking",
              filename: "banking.ump",
            },
          ],
        },
        {
          id: "example-set-5",
          label: "Composite Structure",
          categoryId: "structure",
          examples: [
            {
              id: "ex-pingpong",
              name: "PingPong",
              label: "PingPong",
              filename: "PingPong.ump",
            },
          ],
        },
      ],
    });
  });

  await page.route("**/api/examples/*", async (route) => {
    const id = decodeURIComponent(route.request().url().split("/").pop() ?? "");
    const name = id === "ex-pingpong" ? "PingPong" : "Banking";

    await route.fulfill({
      json: {
        id,
        name,
        label: name,
        code:
          name === "PingPong"
            ? `class Component1 {\n  public in Integer pIn1;\n  public out Integer pOut1;\n}\n\nclass Atomic {\n  Component1 cmp1;\n}\n`
            : `class Account {\n  balance;\n}\n`,
        defaultCategoryId: name === "PingPong" ? "structure" : "class",
      },
    });
  });

  await page.route("**/api/compile", async (route) => {
    await route.fulfill({
      json: {
        modelId: "playwright-model",
        result: JSON.stringify(bankingModel),
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });
});

test("renders empty editor and compiles when an example is loaded", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("editor-panel")).toBeVisible();
  await expect(page.getByTestId("diagram-panel")).toBeVisible();
  await expect(page.getByTestId("compile-button")).toHaveCount(0);

  // Load an example from the first-layer command palette (sidebar collapsed by default, use Ctrl+K)
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-item-example-ex-banking").click();

  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });
});

test("loads an example from the URL into the editor automatically", async ({
  page,
}) => {
  let resolvedExample = "";

  await page.route("**/api/examples/resolve?*", async (route) => {
    resolvedExample =
      new URL(route.request().url()).searchParams.get("example") ?? "";
    await route.fulfill({
      json: {
        id: "ex-banking",
        name: "Banking",
        label: "Banking",
        code: `class Account {\n  balance;\n}\n`,
        defaultCategoryId: "class",
      },
    });
  });

  await page.goto("/?example=banking");

  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect
    .poll(() => resolvedExample)
    .toBe("banking");
  await expect(page.locator(".cm-content")).toContainText("class Account");
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/\?model=playwright-model$/);
});

test("manual compile button appears only when auto-compile is disabled in preferences", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("compile-button")).toHaveCount(0);

  await page.getByLabel("Toggle preferences sidebar").click();
  const autoCompileSwitch = page.getByRole("switch", { name: "Auto-compile" });
  await expect(autoCompileSwitch).toHaveAttribute("data-state", "checked");
  await autoCompileSwitch.click();

  await expect(autoCompileSwitch).toHaveAttribute("data-state", "unchecked");
  await expect(page.getByTestId("compile-button")).toBeVisible();
});

test("uses the selected diagram type for the first diagram request", async ({
  page,
}) => {
  const diagramTypes: string[] = [];

  await page.route("**/api/diagram", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };
    if (body.diagramType) {
      diagramTypes.push(body.diagramType);
    }

    await route.fulfill({
      json: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  // Load an example via the first-layer command palette (sidebar collapsed by default, use Ctrl+K)
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-item-example-ex-banking").click();
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });

  // Switch diagram view — should trigger a diagram request with the new type
  await page.getByLabel("Diagram view").click();
  await page.getByTestId("diagram-view-state").click();

  await expect
    .poll(() => diagramTypes[diagramTypes.length - 1])
    .toBe("GvStateDiagram");
});

test("grouped dropdown renders legacy diagram view groups", async ({
  page,
}) => {
  await page.route("**/api/diagram", async (route) => {
    await route.fulfill({
      json: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  // Open the diagram view dropdown
  await page.getByLabel("Diagram view").click();

  // Verify grouped headings exist in the combobox.
  await expect(
    page.locator("[cmdk-group-heading]").filter({ hasText: "Class Views" }),
  ).toBeVisible();
  await expect(
    page.locator("[cmdk-group-heading]").filter({ hasText: "State Views" }),
  ).toBeVisible();
  await expect(
    page.locator("[cmdk-group-heading]").filter({ hasText: "Special Views" }),
  ).toBeVisible();
  await expect(
    page.locator("[cmdk-group-heading]").filter({ hasText: "Instance Views" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Search views...")).toBeVisible();

  // Verify all exposed diagram types are present
  for (const id of [
    "diagram-view-class",
    "diagram-view-erd",
    "diagram-view-feature",
    "diagram-view-structure",
    "diagram-view-state",
    "diagram-view-eventSequence",
    "diagram-view-stateTables",
    "diagram-view-instance",
    "diagram-view-crud",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test("command palette lists all supported diagram commands and diagram commands work", async ({
  page,
}) => {
  const diagramTypes: string[] = [];

  await page.route("**/api/diagram", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };
    if (body.diagramType) diagramTypes.push(body.diagramType);
    await route.fulfill({
      json: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByTestId("command-item-example-ex-banking").click();
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });

  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();

  for (const id of [
    "command-item-diagram-class",
    "command-item-diagram-erd",
    "command-item-diagram-crud",
    "command-item-diagram-state",
    "command-item-diagram-stateTables",
    "command-item-diagram-structure",
    "command-item-diagram-feature",
    "command-item-diagram-instance",
    "command-item-diagram-eventSequence",
  ]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  await expect(page.getByTestId("command-item-gen-Java")).toBeVisible();

  await page.getByTestId("command-item-diagram-erd").click();
  await expect
    .poll(() => diagramTypes[diagramTypes.length - 1])
    .toBe("GvEntityRelationshipDiagram");
});

test("command palette view commands toggle renderer, output panel, and diagram-only mode", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByTestId("command-item-example-ex-banking").click();
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });

  await page.keyboard.press("Control+k");
  const initialRendererLabel = await page
    .getByTestId("command-item-view-renderer")
    .textContent();
  await page.getByTestId("command-item-view-renderer").click();

  await page.keyboard.press("Control+k");
  if (initialRendererLabel?.includes("Editable")) {
    await expect(page.getByTestId("command-item-view-renderer")).toContainText(
      "Graphviz",
    );
  } else {
    await expect(page.getByTestId("command-item-view-renderer")).toContainText(
      "Editable",
    );
  }
  await page.getByTestId("command-item-view-output-panel").click();
  await expect(page.getByTestId("output-panel")).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByTestId("command-item-view-diagram-only").click();
  await expect(page.getByTestId("editor-panel")).toHaveCount(0);
});

test("ERD selection sends GvEntityRelationshipDiagram to backend", async ({
  page,
}) => {
  const diagramTypes: string[] = [];

  await page.route("**/api/diagram", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };
    if (body.diagramType) diagramTypes.push(body.diagramType);
    await route.fulfill({
      json: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  // Load example to trigger compile + diagram
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-item-example-ex-banking").click();
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });

  // Switch to ERD
  await page.getByLabel("Diagram view").click();
  await page.getByTestId("diagram-view-erd").click();

  await expect
    .poll(() => diagramTypes[diagramTypes.length - 1])
    .toBe("GvEntityRelationshipDiagram");
});

test("Event Sequence renders iframe with mocked HTML response", async ({
  page,
}) => {
  await page.route("**/api/diagram", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };
    if (body.diagramType === "EventSequence") {
      await route.fulfill({ json: { html: "<h1>Event Sequence Output</h1>" } });
    } else {
      await route.fulfill({
        json: {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
        },
      });
    }
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();

  // Load example
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-item-example-ex-banking").click();
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });

  // Switch to Event Sequence
  await page.getByLabel("Diagram view").click();
  await page.getByTestId("diagram-view-eventSequence").click();

  // Verify iframe is rendered
  await expect(page.getByTestId("html-diagram-iframe")).toBeVisible({
    timeout: 5_000,
  });
});

test("Feature view renders SVG diagram from backend", async ({ page }) => {
  const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
    <g id="graph0" class="graph"><polygon fill="white" stroke="none" points="0,0 400,0 400,-200 0,-200"/>
    <g id="node1" class="node"><title>Root</title><polygon fill="none" stroke="black" points="60,-80 140,-80 140,-40 60,-40"/><text x="100" y="-55">Root</text></g>
    <g id="node2" class="node"><title>Child</title><polygon fill="none" stroke="black" points="220,-80 300,-80 300,-40 220,-40"/><text x="260" y="-55">Child</text></g>
    </g></svg>`;

  await page.route("**/api/diagram", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };

    if (body.diagramType === "GvFeatureDiagram") {
      await route.fulfill({ json: { svg: featureSvg } });
      return;
    }

    await route.fulfill({
      json: {
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-item-example-ex-banking").click();
  await expect(page.getByTestId("class-node-Account")).toBeVisible({
    timeout: 10_000,
  });

  await page.getByLabel("Diagram view").click();
  await page.getByTestId("diagram-view-feature").click();

  // SmartSvgView renders SVG with node data attributes
  await expect(page.locator('[data-node-id="Root"]')).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator('[data-node-id="Child"]')).toBeVisible();
});

test("loading a composite structure example switches to structure view and renders its SVG", async ({
  page,
}) => {
  const diagramTypes: string[] = [];
  const structureHtml = `
    <svg id="svgCanvas" xmlns="http://www.w3.org/2000/svg" width="400" height="200">
      <text x="115" y="85">Atomic</text>
    </svg>
  `;

  // Track diagram types from both compile and diagram endpoints — when the
  // editor starts empty the first compile carries the diagram request inline.
  await page.route("**/api/compile", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };
    if (body.diagramType) diagramTypes.push(body.diagramType);
    const isStructure = body.diagramType === "StructureDiagram";
    await route.fulfill({
      json: {
        modelId: "playwright-model",
        result: JSON.stringify(bankingModel),
        svg: isStructure
          ? ""
          : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
        html: isStructure ? structureHtml : undefined,
      },
    });
  });

  await page.route("**/api/diagram", async (route) => {
    const body = route.request().postDataJSON() as { diagramType?: string };
    if (body.diagramType) diagramTypes.push(body.diagramType);
    await route.fulfill({
      json: {
        html:
          body.diagramType === "StructureDiagram" ? structureHtml : undefined,
        svg:
          body.diagramType === "StructureDiagram"
            ? ""
            : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByTestId("command-item-example-ex-pingpong").click();

  await expect
    .poll(() => diagramTypes[diagramTypes.length - 1])
    .toBe("StructureDiagram");
  await expect(page.getByLabel("Diagram view")).toContainText("Structure");
  await expect(page.getByTestId("html-diagram-iframe")).toBeVisible({
    timeout: 5_000,
  });
});
