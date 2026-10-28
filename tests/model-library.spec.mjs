import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import LZString from "lz-string";
const appPath = process.env.APP_BASE_PATH || "/";
const key = "wonderlab.projects.v1";
const catalogue = JSON.parse(
  await fs.readFile("public/models/catalog.json", "utf8"),
);
const sample = catalogue.models[0];
const sampleBytes = await fs.readFile("public/models/wonder-bot.glb");
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};
const encoded = (data) =>
  LZString.compressToEncodedURIComponent(JSON.stringify(data));
const sceneLink = (data) => `${appPath}#page=view&scene=${encoded(data)}`;
const sceneRow = (id, name = "") => [id, 0, 0, 0, 0, 0, 0, 1, 0, 1, name, ""];
async function blank(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "wonderlab.projects.v1",
      JSON.stringify([
        {
          version: 1,
          id: "model-test",
          title: "My GLB classroom",
          markerId: "space-explorer",
          objects: [],
        },
      ]),
    );
    localStorage.setItem("wonderlab.active.v1", "model-test");
  });
}
async function replaceCatalogue(context, models) {
  await context.route("**/models/catalog.json", (route) =>
    route.fulfill({ json: { ...catalogue, models } }),
  );
}
async function saved(page) {
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
}
async function imageOfCanvas(page) {
  return page.locator(".studio-canvas canvas").evaluate((c) => c.toDataURL());
}

test("curated catalogue, GLB thumbnail, embedded animation, transforms, cloning, save and JSON backup", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.goto(`${appPath}?studio=1`);
  await expect(page.locator(".asset-card")).toHaveCount(
    12 + catalogue.models.length,
  );
  await expect(
    page.getByRole("button", { name: "Add your own models", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Templates", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Use My next big idea template" })
    .click();
  await page.getByLabel("Search objects").fill("Wonder Bot");
  await expect(page.locator(".asset-card")).toHaveCount(1);
  const card = page.getByRole("button", {
    name: "Add Wonder Bot to your scene",
  });
  await expect(card.locator("img")).toHaveAttribute(
    "data-model-status",
    "ready",
  );
  await expect(card.locator("img")).toHaveAttribute("src", /^data:image\/png/);
  await card.click();
  await expect(page.getByLabel("Object name")).toHaveValue("Wonder Bot");
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page.getByLabel("Object name").fill("Classroom Bot");
  await page.getByLabel("Position X", { exact: true }).fill("0.6");
  await page.getByLabel("Rotation Y", { exact: true }).fill("25");
  await page.getByLabel("Object size").focus();
  await page.keyboard.press("ArrowRight");
  await page
    .getByRole("button", { name: "Set object colour #edaa8f", exact: true })
    .click();
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page.getByLabel("Project title").fill("Our GLB classroom");
  await page.getByLabel("Project title").blur();
  const still = await imageOfCanvas(page);
  await page.getByRole("button", { name: "Play scene animation" }).click();
  await expect.poll(() => imageOfCanvas(page)).not.toBe(still);
  await page.getByRole("button", { name: "Stop scene animation" }).click();
  await page.waitForTimeout(200);
  const paused = await imageOfCanvas(page);
  await page.waitForTimeout(250);
  expect(await imageOfCanvas(page)).toBe(paused);
  await page.screenshot({ path: "tests/glb-studio-desktop.png" });
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByLabel("Object name")).toHaveValue(
    "Classroom Bot copy",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await saved(page);
  const projects = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)),
    key,
  );
  const current = projects.find((p) => p.title === "Our GLB classroom");
  expect(current.objects).toHaveLength(1);
  expect(current.objects[0]).toMatchObject({
    assetId: "model:wonder-bot",
    name: "Classroom Bot",
    position: [0.6, 0, -0.7],
    rotation: [0, 25, 0],
    scale: 0.85,
    model: { id: "wonder-bot", file: "wonder-bot.glb", height: 1.6 },
  });
  await page
    .getByRole("button", { name: "About this demo workspace", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Back up current project", exact: true })
    .click();
  const backup = await downloadEvent,
    backupPath = await backup.path();
  const json = JSON.parse(await fs.readFile(backupPath, "utf8"));
  expect(json.version).toBe(2);
  expect(json.objects[0].model.file).toBe("wonder-bot.glb");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByLabel("Import Wonderlab project JSON")
    .setInputFiles(backupPath);
  await expect(page.getByLabel("Object name")).toHaveValue("Classroom Bot");
  await page.reload();
  await expect(page.getByLabel("Object name")).toHaveValue("Classroom Bot");
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("stable GLB share descriptors survive catalogue reorder, changed filenames and a missing catalogue on a fresh phone", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const errors = errorsFor(page);
  const second = {
    ...sample,
    id: "another-bot",
    name: "Another Bot",
    file: "another-bot.glb",
  };
  await replaceCatalogue(page, [sample, second]);
  await page.route("**/models/another-bot.glb", (route) =>
    route.fulfill({ contentType: "model/gltf-binary", body: sampleBytes }),
  );
  await blank(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByLabel("Search objects").fill("Wonder Bot");
  await page
    .getByRole("button", { name: "Add Wonder Bot to your scene" })
    .click();
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Publish & share" }).click();
  await expect(
    page.getByAltText("QR code to open your AR creation on a phone"),
  ).toBeVisible();
  const link = await page.locator("#share-link").inputValue();
  const compact = JSON.parse(
    LZString.decompressFromEncodedURIComponent(
      new URLSearchParams(new URL(link).hash.slice(1)).get("scene"),
    ),
  );
  expect(compact.v).toBe(2);
  expect(compact.o[0][0]).toBe("model:wonder-bot");
  expect(compact.a[0]).toMatchObject({
    id: "wonder-bot",
    file: "wonder-bot.glb",
    height: 1.6,
  });
  for (const missing of [false, true]) {
    const fresh = await browser.newContext({
        viewport: { width: 430, height: 900 },
      }),
      viewer = await fresh.newPage();
    const viewerErrors = errorsFor(viewer),
      loaded = [];
    viewer.on("request", (request) => {
      if (request.url().endsWith(".glb"))
        loaded.push(new URL(request.url()).pathname);
    });
    if (missing)
      await fresh.route("**/models/catalog.json", (route) =>
        route.fulfill({ status: 404, body: "Not found" }),
      );
    else
      await replaceCatalogue(fresh, [
        second,
        {
          ...sample,
          file: "new-file-must-not-replace-the-snapshot.glb",
          height: 3,
        },
      ]);
    await fresh.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      });
    });
    await viewer.goto(link);
    await expect(
      viewer.getByRole("heading", { name: "My GLB classroom" }),
    ).toBeVisible();
    await expect
      .poll(() => loaded)
      .toEqual([`${appPath}models/wonder-bot.glb`]);
    await expect(viewer.locator(".model-load-note")).toHaveCount(0);
    expect(
      await viewer.evaluate((k) => localStorage.getItem(k), key),
    ).toBeNull();
    await viewer.getByRole("button", { name: "Start AR camera" }).click();
    await expect(viewer.getByRole("alert")).toContainText(
      "Camera access was not allowed",
    );
    await expect(viewer.locator(".model-load-note")).toHaveCount(0);
    expect(loaded).toEqual([`${appPath}models/wonder-bot.glb`]);
    await viewer.goto(link.replace("#page=view&", "#page=print&"));
    await expect(
      viewer.getByRole("button", { name: "Print sheet", exact: true }),
    ).toBeEnabled();
    expect(viewerErrors).toEqual([]);
    await fresh.close();
  }
  expect(errors).toEqual([]);
});

test("invalid catalogue entries are reported, and a missing GLB gives an actionable error without breaking demo objects", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await replaceCatalogue(page, [
    sample,
    sample,
    { ...sample, id: "escape", file: "../secret.glb" },
    {
      id: "missing",
      name: "Missing Model",
      category: "Your models",
      file: "missing.glb",
    },
  ]);
  await blank(page);
  await page.goto(`${appPath}?studio=1`);
  await expect(page.locator(".asset-card")).toHaveCount(14);
  await expect(page.locator(".catalogue-notice")).toContainText(
    "Some library items are unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Add your own models", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search objects").fill("Missing Model");
  await page
    .getByRole("button", { name: "Add Missing Model to your scene" })
    .click();
  await expect(page.locator(".model-load-note")).toContainText(
    /HTTP 404|server returned a web page/,
  );
  await expect(page.locator(".model-load-note")).toContainText(
    "capital letters",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page.getByLabel("Search objects").fill("Earth");
  await page.getByRole("button", { name: "Add Earth to your scene" }).click();
  await expect(page.getByLabel("Object name")).toHaveValue("Earth");
  expect(errors).toEqual([]);
});

test("missing or malformed catalogue leaves the twelve demo objects usable", async ({
  page,
}) => {
  const errors = errorsFor(page);
  let malformed = false;
  await page.route("**/models/catalog.json", (route) =>
    route.fulfill(
      malformed
        ? { contentType: "application/json", body: "{not JSON" }
        : { status: 404, body: "Not found" },
    ),
  );
  for (const badJSON of [false, true]) {
    malformed = badJSON;
    await page.goto(`${appPath}?studio=1`);
    if (badJSON) await page.reload();
    await expect(page.locator(".asset-card")).toHaveCount(12);
    await expect(page.locator(".catalogue-notice")).toContainText(
      "Some library items are unavailable",
    );
    await page
      .getByRole("button", { name: "Add Rocket to your scene" })
      .click();
    await expect(page.getByLabel("Object name")).toHaveValue("Rocket");
  }
  expect(errors).toEqual([]);
});

test("legacy v1 QR links still decode; unsafe model paths and duplicate definitions are rejected", async ({
  page,
}) => {
  const errors = errorsFor(page),
    externalRequests = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://evil.example"))
      externalRequests.push(request.url());
  });
  await page.goto(
    sceneLink({
      v: 1,
      n: "Legacy rocket link",
      m: 0,
      o: [sceneRow(0, "Old rocket")],
    }),
  );
  await expect(
    page.getByRole("heading", { name: "Legacy rocket link" }),
  ).toBeVisible();
  await expect(page.locator(".studio-canvas canvas")).toBeVisible();
  for (const file of [
    "../private.glb",
    "https://evil.example/model.glb",
    "/model.glb",
    "wrong-format.fbx",
  ]) {
    await page.goto(
      sceneLink({
        v: 2,
        n: "Unsafe",
        m: 0,
        a: [{ id: "bad", file }],
        o: [sceneRow("model:bad")],
      }),
    );
    await expect(
      page.getByRole("heading", { name: "This wonder needs a new link." }),
    ).toBeVisible();
  }
  await page.goto(
    sceneLink({
      v: 2,
      n: "Duplicates",
      m: 0,
      a: [sample, sample],
      o: [sceneRow("model:wonder-bot")],
    }),
  );
  await expect(
    page.getByRole("heading", { name: "This wonder needs a new link." }),
  ).toBeVisible();
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("removing a GLB before loading finishes is safe; subsequent clones reuse one file request", async ({
  page,
}) => {
  const errors = errorsFor(page);
  let release,
    requests = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/models/wonder-bot.glb", async (route) => {
    requests++;
    await gate;
    await route.fulfill({
      contentType: "model/gltf-binary",
      body: sampleBytes,
    });
  });
  await blank(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByLabel("Search objects").fill("Wonder Bot");
  await expect.poll(() => requests).toBe(1);
  await page
    .getByRole("button", { name: "Add Wonder Bot to your scene" })
    .click();
  await expect(page.locator(".model-load-note")).toContainText(
    "Loading your model",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  release();
  const card = page.getByRole("button", {
    name: "Add Wonder Bot to your scene",
  });
  await expect(card.locator("img")).toHaveAttribute(
    "data-model-status",
    "ready",
  );
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await card.click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByLabel("Object name")).toHaveValue("Wonder Bot copy");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Play scene animation" }).click();
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
});

for (const fixture of [
  "draco-box",
  "meshopt-box",
  "textured-box",
  "skinned-stem",
]) {
  test(`GLB compatibility: ${fixture}, automatic thumbnail, placement and independently cloned instances`, async ({
    page,
  }) => {
    const errors = errorsFor(page),
      decoderRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("/vendor/draco/"))
        decoderRequests.push(new URL(request.url()).pathname);
    });
    await replaceCatalogue(page, [
      {
        id: fixture,
        name: "Fixture model",
        category: "Fixtures",
        file: `${fixture}.glb`,
        height: 1.5,
      },
    ]);
    await page.route(`**/models/${fixture}.glb`, (route) =>
      route.fulfill({
        contentType: "model/gltf-binary",
        path: `tests/fixtures/${fixture}.glb`,
      }),
    );
    await blank(page);
    await page.goto(`${appPath}?studio=1`);
    await page.getByRole("button", { name: "Fixtures", exact: true }).click();
    const card = page.getByRole("button", {
      name: "Add Fixture model to your scene",
    });
    await expect(card.locator("img")).toHaveAttribute(
      "data-model-status",
      "ready",
    );
    await expect(card.locator("img")).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    await card.click();
    await expect(page.locator(".model-load-note")).toHaveCount(0);
    await page.getByLabel("Position X", { exact: true }).fill("0.8");
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.getByLabel("Object name")).toHaveValue(
      "Fixture model copy",
    );
    await expect(page.locator(".model-load-note")).toHaveCount(0);
    if (fixture === "skinned-stem") {
      const before = await imageOfCanvas(page);
      await page.getByRole("button", { name: "Play scene animation" }).click();
      await expect.poll(() => imageOfCanvas(page)).not.toBe(before);
      await page.getByRole("button", { name: "Stop scene animation" }).click();
    }
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.locator(".model-load-note")).toHaveCount(0);
    if (fixture === "draco-box") {
      expect(decoderRequests).toContain(
        `${appPath}vendor/draco/draco_wasm_wrapper.js`,
      );
      expect(decoderRequests).toContain(
        `${appPath}vendor/draco/draco_decoder.wasm`,
      );
    }
    expect(errors).toEqual([]);
  });
}

test("one scene retains separate model definitions after an owner changes a catalogue file or fit setting", async ({
  page,
  browser,
}) => {
  const errors = errorsFor(page);
  const old = { ...sample, file: "old-version.glb", height: 1.2 },
    newer = { ...sample, file: "new-version.glb", height: 2.2 };
  const project = {
    version: 2,
    id: "variants",
    title: "Two model versions",
    markerId: "space-explorer",
    objects: [old, newer].map((model, i) => ({
      id: `variant-${i}`,
      assetId: "model:wonder-bot",
      name: i === 0 ? "Old Bot" : "New Bot",
      model,
      position: [i ? 1 : -1, 0, 0],
      rotation: [0, 0, 0],
      scale: 0.8,
      animation: "none",
      visible: true,
    })),
  };
  await page.route("**/models/*-version.glb", (route) =>
    route.fulfill({ contentType: "model/gltf-binary", body: sampleBytes }),
  );
  await page.goto(`${appPath}?studio=1`);
  await page.getByLabel("Import Wonderlab project JSON").setInputFiles({
    name: "versions.wonderlab.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByLabel("Project title")).toHaveValue(
    "Two model versions",
  );
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Publish & share" }).click();
  const link = await page.locator("#share-link").inputValue();
  const data = JSON.parse(
    LZString.decompressFromEncodedURIComponent(
      new URLSearchParams(new URL(link).hash.slice(1)).get("scene"),
    ),
  );
  expect(data.a).toHaveLength(2);
  expect(data.o.map((row) => row[12])).toEqual([0, 1]);
  expect(data.a.map((model) => model.height)).toEqual([1.2, 2.2]);
  const fresh = await browser.newContext(),
    viewer = await fresh.newPage(),
    loaded = [];
  const viewerErrors = errorsFor(viewer);
  await replaceCatalogue(fresh, []);
  await fresh.route("**/models/*-version.glb", (route) => {
    loaded.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      contentType: "model/gltf-binary",
      body: sampleBytes,
    });
  });
  await viewer.goto(link);
  await expect(
    viewer.getByRole("heading", { name: "Two model versions" }),
  ).toBeVisible();
  await expect
    .poll(() => [...loaded].sort())
    .toEqual([
      `${appPath}models/new-version.glb`,
      `${appPath}models/old-version.glb`,
    ]);
  await expect(viewer.locator(".model-load-note")).toHaveCount(0);
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await fresh.close();
});
