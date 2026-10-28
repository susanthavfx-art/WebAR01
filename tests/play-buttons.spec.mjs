import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import LZString from "lz-string";
import {
  CLOUD_URL,
  TEACHER_EMAIL,
  TEACHER_ID,
  createCloudStore,
  useFakeCloud,
} from "./helpers/fake-cloud.mjs";

const appPath = process.env.APP_BASE_PATH || "/";
const key = "wonderlab.projects.v1";
const catalogue = JSON.parse(
  await fs.readFile("public/models/catalog.json", "utf8"),
);
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};
// A short 440 Hz WAV used as an "animal sound".
function wav(seconds = 0.4) {
  const rate = 8000,
    n = Math.round(rate * seconds),
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(Math.sin((i / rate) * 440 * 2 * Math.PI) * 9000), 44 + i * 2);
  return b;
}
async function trackSounds(context) {
  await context.addInitScript(() => {
    window.__played = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.__played.push(this.currentSrc || this.src);
      return original.apply(this, args);
    };
  });
}
const played = (page) => page.evaluate(() => window.__played.slice());
const canvasImage = (page, scope = ".studio-canvas canvas") =>
  page.locator(scope).first().evaluate((c) => c.toDataURL());
async function useAnimatedModel(context) {
  await context.route("**/models/catalog.json", (route) =>
    route.fulfill({
      json: {
        ...catalogue,
        models: [
          {
            id: "animated-box",
            name: "Animated box",
            category: "Fixtures",
            file: "animated-box.glb",
            height: 1.4,
            animate: true,
          },
        ],
      },
    }),
  );
  await context.route("**/models/animated-box.glb", (route) =>
    route.fulfill({
      contentType: "model/gltf-binary",
      path: "tests/fixtures/animated-box.glb",
    }),
  );
}
async function seed(context, project) {
  await context.addInitScript(
    ({ key, project }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(key, JSON.stringify([project]));
      localStorage.setItem("wonderlab.active.v1", project.id);
    },
    { key, project },
  );
}
const saved = (page) =>
  expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

test("teacher gives each GLB animation its own play button, adds an animal sound and students play them", async ({
  browser,
}) => {
  const store = createCloudStore();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  await useFakeCloud(context, store);
  await useAnimatedModel(context);
  await seed(context, {
    version: 2,
    id: "actions-project",
    title: "Animal sounds",
    markerId: "space-explorer",
    objects: [],
  });
  const page = await context.newPage();
  const errors = errorsFor(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Fixtures", exact: true }).click();
  const card = page.getByRole("button", {
    name: "Add Animated box to your scene",
  });
  await expect(card.locator("img")).toHaveAttribute("data-model-status", "ready");
  await card.click();

  const section = page.locator(".actions-section");
  await expect(section.getByText("This model has 3 animations.")).toBeVisible();
  const idle = page.getByLabel("MAIN ANIMATION (PLAYS ALL THE TIME)");
  await expect(idle.locator("option")).toHaveText([
    "Automatic (Hop)",
    "Hop",
    "Turn",
    "Pulse",
    "Stand still",
  ]);
  for (let i = 0; i < 3; i++)
    await section.getByRole("button", { name: "Add play button" }).click();
  await expect(page.getByLabel("Play button 1 name")).toHaveValue("Hop");
  await expect(page.getByLabel("Play button 2 name")).toHaveValue("Turn");
  await expect(page.getByLabel("Play button 3 name")).toHaveValue("Pulse");
  await page.getByLabel("Play button 3 movement").selectOption("@jump");
  await expect(page.getByLabel("Play button 3 name")).toHaveValue("Jump");
  await page.getByLabel("Play button 2 keeps playing").check();
  await page.getByLabel("Play button 1 name").fill("Roar");
  await idle.selectOption("-1");

  // Teachers sign in, then upload the sound into button 1.
  const first = page.locator(".action-card").first();
  await first.getByRole("button", { name: "Sign in to record or upload" }).click();
  const dialog = page.getByRole("dialog", { name: "Teacher sign-in" });
  await dialog.getByLabel("TEACHER EMAIL").fill(TEACHER_EMAIL);
  await dialog.getByRole("button", { name: "Email me a code" }).click();
  await dialog.getByLabel("SIGN-IN CODE").fill("123456");
  await dialog.getByRole("button", { name: "Sign in" }).click();
  await expect(dialog).toHaveCount(0);
  await first.locator('input[aria-label="Choose audio file"]').setInputFiles({
    name: "lion-roar.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(page.getByLabel("Play button 1 sound preview")).toBeVisible();
  await section.screenshot({ path: "tests/play-buttons-inspector.png" });
  const audioPath = [...store.files.keys()].find((p) =>
    p.startsWith(`${TEACHER_ID}/audio/`),
  );
  expect(audioPath).toBeTruthy();
  await expect(
    page.getByLabel("Play button 1 movement").locator("option", {
      hasText: "No movement – sound only",
    }),
  ).toHaveCount(1);

  // The test button moves the model even while the scene is paused.
  await saved(page);
  const still = await canvasImage(page);
  await page.getByRole("button", { name: "Test play button 3" }).click();
  await expect.poll(() => canvasImage(page)).not.toBe(still);

  await page.reload();
  await expect(page.locator(".action-card")).toHaveCount(3);
  const projectData = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key))[0],
    key,
  );
  const object = projectData.objects[0];
  expect(object.idleClip).toBe(-1);
  expect(object.actions.map((a) => [a.label, a.clip, !!a.loop])).toEqual([
    ["Roar", 0, false],
    ["Turn", 1, true],
    ["Jump", "@jump", false],
  ]);
  expect(object.actions[0].sound.url).toBe(
    `${CLOUD_URL}/storage/v1/object/public/lesson-media/${audioPath}`,
  );

  // Play mode in the editor shows the same buttons students get.
  await page.getByRole("button", { name: "Play scene animation" }).click();
  const bar = page.getByRole("toolbar", { name: "Play buttons" });
  await expect(bar.getByRole("button")).toHaveText(["Roar", "Turn", "Jump"]);
  await page.screenshot({ path: "tests/play-buttons-studio.png" });
  await page.getByRole("button", { name: "Stop scene animation" }).click();
  await expect(bar).toHaveCount(0);

  await page.getByRole("button", { name: "Publish & share" }).click();
  await expect(page.locator("#share-link")).toHaveValue(/lesson=/);
  const link = await page.locator("#share-link").inputValue();
  const published = [...store.files.keys()].find((p) =>
    p.startsWith(`${TEACHER_ID}/lessons/`),
  );
  const lesson = JSON.parse(store.files.get(published).body.toString());
  expect(lesson.project.objects[0].actions).toHaveLength(3);
  expect(lesson.project.objects[0].idleClip).toBe(-1);

  const student = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await useFakeCloud(student, store);
  await useAnimatedModel(student);
  await trackSounds(student);
  const viewer = await student.newPage();
  const viewerErrors = errorsFor(viewer);
  await viewer.goto(link);
  const studentBar = viewer.getByRole("toolbar", { name: "Play buttons" });
  await expect(studentBar.getByRole("button")).toHaveText(["Roar", "Turn", "Jump"]);
  await expect(viewer.getByText("Tap the play buttons")).toBeVisible();
  await expect(viewer.locator(".model-load-note")).toHaveCount(0);
  await viewer.waitForTimeout(400);
  const before = await canvasImage(viewer);
  await studentBar.getByRole("button", { name: "Roar" }).click();
  await expect.poll(() => played(viewer)).toEqual([
    `${CLOUD_URL}/storage/v1/object/public/lesson-media/${audioPath}`,
  ]);
  await expect.poll(() => canvasImage(viewer)).not.toBe(before);
  const turn = studentBar.getByRole("button", { name: "Turn" });
  await turn.click();
  await expect(turn).toHaveAttribute("aria-pressed", "true");
  await viewer.screenshot({ path: "tests/play-buttons-mobile.png" });
  await turn.click();
  await expect(turn).toHaveAttribute("aria-pressed", "false");
  await viewer.waitForTimeout(1300);
  // Tapping the model plays button 1 (with its sound) again.
  const box = await viewer.locator(".viewer-scene canvas").boundingBox();
  await viewer.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
  await expect.poll(async () => (await played(viewer)).length).toBe(2);
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await student.close();
  await context.close();
});

test("built-in objects get simple movement buttons that survive an inline link, and bad actions are dropped", async ({
  page,
  browser,
}) => {
  const errors = errorsFor(page);
  await seed(page, {
    version: 2,
    id: "inline-actions",
    title: "Robot moves",
    markerId: "space-explorer",
    objects: [
      {
        id: "robot-1",
        assetId: "robot",
        name: "Robot",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1.2,
        animation: "none",
        visible: true,
        idleClip: 7000,
        actions: [
          {
            id: "beep",
            label: "Beep beep",
            clip: "@spin",
            sound: {
              url: "https://sounds.example/beep.wav",
              name: "beep.wav",
              mime: "audio/wav",
            },
          },
          { id: "bad-1", label: "Hack", clip: null, sound: { url: "javascript:alert(1)" } },
          { id: "bad-2", label: "Huge", clip: 500 },
          { id: "bad-3", label: "Effect", clip: "@explode" },
        ],
      },
    ],
  });
  await page.goto(`${appPath}?studio=1`);
  await page.locator(".actions-section").waitFor({ timeout: 4000 }).catch(async () => {
    await page.getByRole("button", { name: "See scene objects" }).click();
    await page.locator(".scene-object-select", { hasText: "Robot" }).click();
  });
  const section = page.locator(".actions-section");
  await expect(section.getByText(/jump, spin or play a sound/)).toBeVisible();
  await expect(page.getByLabel("MAIN ANIMATION (PLAYS ALL THE TIME)")).toHaveCount(0);
  await expect(page.locator(".action-card")).toHaveCount(1);
  await section.getByRole("button", { name: "Add play button" }).click();
  await expect(page.getByLabel("Play button 2 name")).toHaveValue("Jump");
  await page.getByLabel("Play button 2 movement").selectOption("@wiggle");
  await expect(page.getByLabel("Play button 2 name")).toHaveValue("Wiggle");
  await expect(page.getByLabel("Play button 2 keeps playing")).toHaveCount(0);
  await saved(page);

  await page.getByRole("button", { name: "Publish & share" }).click();
  const link = await page.locator("#share-link").inputValue();
  expect(link).toContain("scene=");
  const data = JSON.parse(
    LZString.decompressFromEncodedURIComponent(
      new URLSearchParams(new URL(link).hash.slice(1)).get("scene"),
    ),
  );
  expect(data.o[0]).toHaveLength(12);
  expect(data.x).toEqual([
    [
      0,
      null,
      [
        ["Beep beep", "@spin", 0, "https://sounds.example/beep.wav", "beep.wav", "audio/wav", null, 0],
        ["Wiggle", "@wiggle", 0],
      ],
    ],
  ]);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  await trackSounds(context);
  await context.route("https://sounds.example/**", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav() }),
  );
  const viewer = await context.newPage();
  const viewerErrors = errorsFor(viewer);
  await viewer.goto(link);
  const bar = viewer.getByRole("toolbar", { name: "Play buttons" });
  await expect(bar.getByRole("button")).toHaveText(["Beep beep", "Wiggle"]);
  await viewer.waitForTimeout(400);
  const before = await canvasImage(viewer);
  await bar.getByRole("button", { name: "Beep beep" }).click();
  await expect.poll(() => played(viewer)).toEqual([
    "https://sounds.example/beep.wav",
  ]);
  await expect.poll(() => canvasImage(viewer)).not.toBe(before);

  // An old link without play buttons still opens with no toolbar.
  const old = { ...data };
  delete old.x;
  await viewer.goto(
    `${appPath}#page=view&scene=${LZString.compressToEncodedURIComponent(JSON.stringify(old))}`,
  );
  await viewer.reload();
  await expect(viewer.getByRole("heading", { name: "Robot moves" })).toBeVisible();
  await expect(viewer.getByRole("toolbar", { name: "Play buttons" })).toHaveCount(0);
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
