import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const catalogue = JSON.parse(
  await fs.readFile("public/models/catalog.json", "utf8"),
);
const libraryCount = 12 + catalogue.models.length;
const appPath = process.env.APP_BASE_PATH || "/";
test("GitHub project subfolder: assets, fresh share loads and in-tab hash routing without SPA fallback", async ({
  page,
  request,
}) => {
  test.skip(
    appPath === "/",
    "Set APP_BASE_PATH and use the strict Pages preview.",
  );
  const errors = [],
    failedResponses = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`${appPath}?studio=1`);
  await expect(page.getByLabel("Project title")).toHaveValue(
    "My space adventure",
  );
  await expect(page.locator(".asset-card")).toHaveCount(libraryCount);
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check("700 20px Jakarta");
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Publish & share" }).click();
  const link = await page.locator("#share-link").inputValue();
  const url = new URL(link);
  expect(url.pathname).toBe(appPath);
  expect(new URLSearchParams(url.hash.slice(1)).get("page")).toBe("view");
  expect(url.hash).toContain("scene=");
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "My space adventure" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start AR camera" }),
  ).toBeVisible();
  const print = link.replace("#page=view&", "#page=print&");
  await page.goto(print);
  await expect(page.locator(".print-sheet h1")).toHaveText(
    "My space adventure",
  );
  await expect(
    page.getByRole("button", { name: "Print sheet", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Back to viewer" }).click();
  await expect(
    page.getByRole("button", { name: "Start AR camera" }),
  ).toBeVisible();
  const home = page.getByRole("link", { name: "Make your own" });
  await expect(home).toHaveAttribute("href", appPath);
  await home.click();
  await expect(
    page.getByRole("heading", { name: "Create your first card" }),
  ).toBeVisible();
  await expect(page.getByLabel("Flashcard set name")).toBeVisible();
  // The original single-scene editor is still available to existing users.
  await page.goto(`${appPath}?studio=1`);
  await expect(page.getByLabel("Project title")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(appPath);
  expect((await request.get(`${appPath}view`)).status()).toBe(404);
  expect(
    (await request.get(`${appPath}markers/space-explorer.mind`)).status(),
  ).toBe(200);
  expect((await request.get(`${appPath}fonts/dm-sans.woff2`)).status()).toBe(
    200,
  );
  expect(failedResponses).toEqual([]);
  expect(errors).toEqual([]);
});
