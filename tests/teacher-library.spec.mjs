import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const appPath = process.env.APP_BASE_PATH || "/";
const catalogue = JSON.parse(
  await fs.readFile("public/models/catalog.json", "utf8"),
);
const sample = catalogue.models.find((model) => model.id === "wonder-bot");
// The owner may rename categories in catalog.json (e.g. Animals -> Dinosaurs).
const dinoCategory =
  catalogue.models.find((model) => model.id === "Velociraptor-01")?.category ||
  "Animals";
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};
async function blank(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "wonderlab.projects.v1",
      JSON.stringify([
        {
          version: 2,
          id: "teacher-test",
          title: "Our dinosaur lesson",
          markerId: "space-explorer",
          objects: [],
        },
      ]),
    );
    localStorage.setItem("wonderlab.active.v1", "teacher-test");
  });
}

test("teacher library has no owner controls or Your models tab; the owner's uploaded dinosaur still places and publishes to a fresh viewer", async ({
  page,
  browser,
}) => {
  const errors = errorsFor(page);
  await blank(page);
  await page.goto(`${appPath}?studio=1`);
  const tabs = page.locator(".category-tabs");
  await expect(
    tabs.getByRole("button", { name: dinoCategory, exact: true }),
  ).toBeVisible();
  await expect(
    tabs.getByRole("button", { name: "Your models", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add your own models", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('a[href*="github.com"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "About this demo workspace", exact: true })
    .click();
  const about = page.getByRole("dialog");
  await expect(about).not.toContainText("GitHub");
  await expect(
    about.getByRole("button", { name: "Add your own models", exact: true }),
  ).toHaveCount(0);
  await about.getByRole("button", { name: "Close dialog" }).click();
  await tabs.getByRole("button", { name: "Science", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Add Wonder Bot to your scene",
      exact: true,
    }),
  ).toBeVisible();
  await tabs.getByRole("button", { name: dinoCategory, exact: true }).click();
  const dinosaur = page.getByRole("button", {
    name: "Add Velociraptor to your scene",
    exact: true,
  });
  await expect(dinosaur.locator("img")).toHaveAttribute(
    "data-model-status",
    "ready",
  );
  await dinosaur.click();
  await expect(page.getByLabel("Object name")).toHaveValue("Velociraptor");
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Publish & share", exact: true })
    .click();
  await expect(
    page.getByAltText("QR code to open your AR creation on a phone"),
  ).toBeVisible();
  const link = await page.locator("#share-link").inputValue();
  const fresh = await browser.newContext({
      viewport: { width: 430, height: 900 },
    }),
    viewer = await fresh.newPage();
  const viewerErrors = errorsFor(viewer),
    requested = [];
  viewer.on("request", (request) => {
    if (request.url().endsWith("jw_alive_blue.glb"))
      requested.push(request.url());
  });
  await viewer.goto(link);
  await expect(
    viewer.getByRole("heading", { name: "Our dinosaur lesson", exact: true }),
  ).toBeVisible();
  await expect.poll(() => requested.length).toBe(1);
  await expect(viewer.locator(".model-load-note")).toHaveCount(0);
  expect(
    await viewer.evaluate(() => localStorage.getItem("wonderlab.projects.v1")),
  ).toBeNull();
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await fresh.close();
});

test("a new catalogue category appears alongside Space, Nature, Science and Animals without JavaScript edits", async ({
  page,
}) => {
  const errors = errorsFor(page);
  // Test-only entry uses the existing original GLB. No fake car is shipped in the real catalogue.
  await page.route("**/models/catalog.json", (route) =>
    route.fulfill({
      json: {
        ...catalogue,
        models: [
          ...catalogue.models,
          {
            ...sample,
            id: "teacher-rover",
            name: "Teaching Rover",
            category: "Vehicles",
          },
        ],
      },
    }),
  );
  await blank(page);
  await page.goto(`${appPath}?studio=1`);
  const tabs = page.locator(".category-tabs");
  await expect(
    tabs.getByRole("button", { name: "All", exact: true }),
  ).toBeVisible();
  const labels = await tabs.getByRole("button").allTextContents();
  for (const category of [
    "All",
    "Space",
    "Nature",
    "Science",
    dinoCategory,
    "Vehicles",
  ])
    expect(labels).toContain(category);
  expect(labels).not.toContain("Your models");
  await tabs.getByRole("button", { name: "Vehicles", exact: true }).click();
  await expect(page.locator(".asset-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Add Teaching Rover to your scene",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Object name")).toHaveValue("Teaching Rover");
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("missing categories and legacy Your models labels become General instead of exposing an owner-specific tab", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.route("**/models/catalog.json", (route) =>
    route.fulfill({
      json: {
        ...catalogue,
        models: [
          {
            id: "uncategorised",
            name: "General Sample",
            file: "wonder-bot.glb",
          },
          {
            ...sample,
            id: "legacy-model",
            name: "Legacy Sample",
            category: "Your models",
          },
        ],
      },
    }),
  );
  await page.goto(`${appPath}?studio=1`);
  const tabs = page.locator(".category-tabs");
  await expect(
    tabs.getByRole("button", { name: "Your models", exact: true }),
  ).toHaveCount(0);
  await tabs.getByRole("button", { name: "General", exact: true }).click();
  await expect(page.locator(".asset-card")).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Add Legacy Sample to your scene",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Object name")).toHaveValue("Legacy Sample");
  await expect(page.locator(".selected-object-card")).toContainText(
    "GENERAL OBJECT",
  );
  await expect(page.locator(".model-load-note")).toHaveCount(0);
  expect(errors).toEqual([]);
});
