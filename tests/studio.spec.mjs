import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const catalogue = JSON.parse(
  await fs.readFile("public/models/catalog.json", "utf8"),
);
const libraryCount = 12 + catalogue.models.length;
const key = "wonderlab.projects.v1";
const appPath = process.env.APP_BASE_PATH || "/";
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};
const settle = async (page) => {
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
};

test("authoring: library, transforms, history, animations, markers and local persistence", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.goto(`${appPath}?studio=1`);
  await expect(page.locator(".asset-card")).toHaveCount(libraryCount);
  await expect(page.getByLabel("Object name")).toHaveValue("Earth");
  await page.getByLabel("Search objects").fill("robot");
  await expect(page.locator(".asset-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Add Robot to your scene" }).click();
  await expect(page.getByLabel("Object name")).toHaveValue("Robot");
  await page.getByLabel("Position X", { exact: true }).fill("1.2");
  await page.getByLabel("Rotation Y", { exact: true }).fill("45");
  await page.getByRole("button", { name: "Float", exact: true }).click();
  await page.getByRole("button", { name: "Play scene animation" }).click();
  await expect(
    page.getByRole("button", { name: "Stop scene animation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop scene animation" }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByLabel("Object name")).toHaveValue("Robot copy");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  // Use the inspector's exact tab; restored duplicate is selectable after undo.
  await page
    .locator(".inspector-tabs")
    .getByRole("button", { name: /Scene/ })
    .click();
  await expect(page.locator(".scene-object")).toHaveCount(7);
  await page
    .getByRole("button", { name: "Redo (Ctrl+Shift+Z)", exact: true })
    .click();
  await expect(page.locator(".scene-object")).toHaveCount(6);
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  await page
    .getByRole("button", { name: "Forest friends Let your ideas grow wild" })
    .click();
  await page.getByLabel("Project title").fill("Our curious classroom");
  await page.getByLabel("Project title").blur();
  // Observe this edit in storage, not the previous save indicator state.
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k))[0]?.markerId,
        key,
      ),
    )
    .toBe("forest-friends");
  await settle(page);
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)),
    key,
  );
  expect(state[0].objects).toHaveLength(6);
  expect(state[0].markerId).toBe("forest-friends");
  const robot = state[0].objects.find((o) => o.assetId === "robot");
  expect(robot.position[0]).toBe(1.2);
  expect(robot.rotation[1]).toBe(45);
  expect(robot.animation).toBe("float");
  await page.reload();
  await expect(page.getByLabel("Project title")).toHaveValue(
    "Our curious classroom",
  );
  await expect(page.locator(".project-subject")).toHaveText("Forest friends");
  expect(errors).toEqual([]);
});

test("templates, projects, backup export/import and deletion work", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.goto(`${appPath}?studio=1`);
  await page
    .getByRole("button", { name: "Templates", exact: false })
    .first()
    .click();
  await expect(page.locator(".template-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Use My little green world template" })
    .click();
  await expect(page.getByLabel("Project title")).toHaveValue(
    "My little green world",
  );
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Project options for My little green world" })
    .click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(3);
  await page
    .getByRole("button", {
      name: "Project options for My little green world copy",
    })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "my-little-green-world-copy.wonderlab.json",
  );
  const path = await download.path();
  await page.getByLabel("Import Wonderlab project JSON").setInputFiles(path);
  await expect(page.getByLabel("Project title")).toHaveValue(
    "My little green world copy",
  );
  await page.getByRole("button", { name: "My projects", exact: true }).click();
  await expect(page.locator(".project-card")).toHaveCount(4);
  await page.getByLabel("Search projects").fill("space");
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Project options for My space adventure" })
    .click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Delete project" })
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(0);
  await page.getByLabel("Search projects").fill("");
  await expect(page.locator(".project-card")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("share snapshot travels to a fresh browser; marker PDF, print route and camera denial work", async ({
  page,
  browser,
}) => {
  const errors = errorsFor(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByLabel("Project title").fill("Share me to a phone");
  await page.getByRole("button", { name: "Publish & share" }).click();
  await expect(
    page.getByAltText("QR code to open your AR creation on a phone"),
  ).toBeVisible();
  const link = await page.locator("#share-link").inputValue();
  expect(link).toContain(`${appPath}#page=view&scene=`);
  await page.getByRole("button", { name: "Get my printable marker" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download marker PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "share-me-to-a-phone-ar-marker.pdf",
  );
  const stream = await download.createReadStream();
  let bytes = 0;
  for await (const chunk of stream) bytes += chunk.length;
  expect(bytes).toBeGreaterThan(100000);
  const fresh = await browser.newContext({
      viewport: { width: 430, height: 900 },
    }),
    viewer = await fresh.newPage();
  const viewerErrors = errorsFor(viewer);
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
    viewer.getByRole("heading", { name: "Share me to a phone" }),
  ).toBeVisible();
  expect(await viewer.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await viewer.getByRole("button", { name: "Explore in 3D instead" }).click();
  await expect(viewer.getByText("Interactive 3D preview")).toBeVisible();
  await viewer.getByRole("button", { name: "Start AR camera" }).click();
  await expect(viewer.getByRole("alert")).toContainText(
    "Camera access was not allowed",
  );
  await expect(
    viewer.getByRole("button", { name: "Start AR camera" }),
  ).toBeVisible();
  await viewer.goto(link.replace("#page=view&", "#page=print&"));
  await expect(viewer.locator(".print-sheet h1")).toHaveText(
    "Share me to a phone",
  );
  await expect(
    viewer.getByRole("button", { name: "Print sheet", exact: true }),
  ).toBeEnabled();
  await viewer.emulateMedia({ media: "print" });
  await expect(viewer.locator(".print-controls")).toBeHidden();
  await viewer.screenshot({ path: "tests/marker-sheet.png", fullPage: true });
  expect(viewerErrors).toEqual([]);
  await fresh.close();
  expect(errors).toEqual([]);
});

test("mobile authoring drawers and invalid shared links fail gracefully", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appPath}?studio=1`);
  await expect(page.locator(".library-panel")).toBeHidden();
  await page
    .locator(".workspace-top")
    .getByRole("button", { name: "Objects", exact: true })
    .click();
  await expect(page.locator(".library-panel")).toBeVisible();
  await page.getByLabel("Search objects").fill("flower");
  await page.getByRole("button", { name: "Add Flower to your scene" }).click();
  await page.getByRole("button", { name: "Close object library" }).click();
  await page
    .locator(".workspace-top")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.getByLabel("Object name")).toHaveValue("Flower");
  await page.getByRole("button", { name: "Close object properties" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tests/studio-mobile.png" });
  await page.goto(`${appPath}#page=view&scene=not-a-real-scene`);
  await expect(
    page.getByRole("heading", { name: "This wonder needs a new link." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const marker of ["space-explorer", "forest-friends"]) {
  test(`real MindAR detection with synthetic camera for ${marker}; camera stops on exit`, async ({
    page,
  }) => {
    const errors = errorsFor(page);
    await page.goto(`${appPath}?studio=1`);
    if (marker === "forest-friends") {
      await page.getByRole("button", { name: "Markers", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Forest friends Let your ideas grow wild",
        })
        .click();
    }
    // Also exercise a downloaded, animated GLB in the actual tracking scene.
    if (marker === "space-explorer") {
      await page.getByLabel("Search objects").fill("Wonder Bot");
      await page
        .getByRole("button", { name: "Add Wonder Bot to your scene" })
        .click();
      await expect(page.locator(".model-load-note")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Publish & share" }).click();
    const link = await page.locator("#share-link").inputValue();
    await page.addInitScript(
      ({ marker, base }) => {
        window.__testStreams = [];
        Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
          configurable: true,
          value: async () => {
            const c = document.createElement("canvas");
            c.width = 720;
            c.height = 960;
            const ctx = c.getContext("2d");
            const image = new Image();
            image.src = `${base}markers/${marker}.jpg`;
            await image.decode();
            const draw = () => {
              ctx.fillStyle = "#eee";
              ctx.fillRect(0, 0, 720, 960);
              ctx.drawImage(image, 80, 200, 560, 560);
            };
            draw();
            const timer = setInterval(draw, 42),
              stream = c.captureStream(24);
            stream
              .getTracks()
              .forEach((t) =>
                t.addEventListener("ended", () => clearInterval(timer)),
              );
            window.__testStreams.push(stream);
            return stream;
          },
        });
      },
      { marker, base: appPath },
    );
    await page.setViewportSize({ width: 430, height: 900 });
    await page.goto(link);
    // A fragment-only navigation keeps the current document. Reload once so
    // the synthetic-camera init script applies, as on a freshly opened phone.
    await page.reload();
    await page.getByRole("button", { name: "Start AR camera" }).click();
    await expect(page.getByText("Marker found. Hello, wonder!")).toBeVisible({
      timeout: 40000,
    });
    await expect(page.locator(".ar-camera canvas")).toBeVisible();
    await page.screenshot({ path: `tests/ar-${marker}.png` });
    await page.getByRole("button", { name: "Stop camera and go back" }).click();
    await expect(
      page.getByRole("button", { name: "Start AR camera" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.__testStreams.flatMap((s) =>
          s.getTracks().map((t) => t.readyState),
        ),
      ),
    ).toEqual(["ended"]);
    expect(errors).toEqual([]);
  });
}
