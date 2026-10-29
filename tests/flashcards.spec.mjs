import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { decode, encode } from "@msgpack/msgpack";
import { unzipSync } from "fflate";

const base = process.env.APP_BASE_PATH || "/";
const image = (name) => `public/markers/${name}.jpg`;
const mind = (name) => `public/markers/${name}.mind`;
const model = "tests/fixtures/animated-box.glb";
async function named(path, name, mimeType = "application/octet-stream") {
  return { name, mimeType, buffer: await fs.readFile(path) };
}
function sampleWav() {
  const rate = 8000,
    samples = 3200,
    bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + samples * 2, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  return bytes;
}
async function uploadTwo(page) {
  // Deliberately start with targets in the opposite order from the other files.
  await page
    .getByLabel("Upload mind files")
    .setInputFiles([
      await named(mind("forest-friends"), "forest-friends.mind"),
      await named(mind("space-explorer"), "space-explorer.mind"),
    ]);
  await expect(page.locator(".flash-card-item")).toHaveCount(2);
  await page.getByLabel("Card title").fill("Forest facts");
  await page
    .getByLabel("Upload marker images")
    .setInputFiles([
      await named(image("space-explorer"), "SPACE-EXPLORER.JPG", "image/jpeg"),
      await named(image("forest-friends"), "forest-friends.jpg", "image/jpeg"),
    ]);
  await expect(page.locator(".flash-file-badges .done")).toHaveCount(4);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles([
      await named(model, "SPACE-EXPLORER.GLB", "model/gltf-binary"),
      await named(model, "FOREST-FRIENDS.GLB", "model/gltf-binary"),
    ]);
  await expect(page.locator(".flash-file-badges .done")).toHaveCount(6);
  await expect(page.getByLabel("Object name")).toBeVisible();
}
async function archive(page) {
  await page.getByRole("button", { name: "Publish one QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish flashcard set" });
  const download = page.waitForEvent("download", { timeout: 90000 });
  await dialog
    .getByRole("button", { name: "Generate one QR & download ZIP" })
    .click();
  const item = await download;
  const files = unzipSync(new Uint8Array(await fs.readFile(await item.path())));
  const manifestPath = Object.keys(files).find((name) =>
    name.endsWith("/manifest.json"),
  );
  const manifest = JSON.parse(new TextDecoder().decode(files[manifestPath]));
  const link = await dialog.getByLabel("Shared QR link").inputValue();
  return { files, manifest, link };
}
async function servePublication(context, files) {
  await context.route("**/published/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const path = pathname.slice(pathname.indexOf("/published/") + 1);
    const bytes = files[`public/${path}`];
    if (!bytes) return route.fulfill({ status: 404, body: "Not found" });
    const type = path.endsWith(".json")
      ? "application/json"
      : path.endsWith(".jpg")
        ? "image/jpeg"
        : path.endsWith(".png")
          ? "image/png"
          : path.endsWith(".webm")
            ? "video/webm"
            : "application/octet-stream";
    return route.fulfill({
      status: 200,
      contentType: type,
      body: Buffer.from(bytes),
    });
  });
}
async function fakeCamera(context) {
  await context.addInitScript(
    ({ base }) => {
      window.__streams = [];
      window.__markerName = "space-explorer";
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = 720;
          canvas.height = 960;
          const ctx = canvas.getContext("2d"),
            images = {};
          for (const name of ["space-explorer", "forest-friends"]) {
            const image = new Image();
            image.src = `${base}markers/${name}.jpg`;
            await image.decode();
            images[name] = image;
          }
          const draw = () => {
            ctx.fillStyle = "#eee";
            ctx.fillRect(0, 0, 720, 960);
            ctx.drawImage(images[window.__markerName], 80, 200, 560, 560);
          };
          draw();
          const timer = setInterval(draw, 42),
            stream = canvas.captureStream(24);
          stream
            .getTracks()
            .forEach((track) =>
              track.addEventListener("ended", () => clearInterval(timer)),
            );
          window.__streams.push(stream);
          return stream;
        },
      });
    },
    { base },
  );
}

test("batch matching, independent scene edits, local persistence and one direct-camera publication", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Model library" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).not.toContainText(/Mini projects|My projects|Templates/);
  await page.getByLabel("Flashcard set name").fill("Learning cards");
  await uploadTwo(page);
  await expect(page.getByLabel("Card title")).toHaveValue("Forest facts");
  await page.getByLabel("Position X").fill("1.2");
  await page
    .locator(".actions-section")
    .getByRole("button", { name: "Add play button" })
    .click();
  await page.getByLabel("Play button 1 movement").selectOption("@jump");
  await page.getByLabel("Play button 1 name").fill("Forest jump");
  await page.getByRole("tab", { name: /Lesson boxes/ }).click();
  await page.getByRole("button", { name: "Add text box" }).click();
  await page.getByLabel("Box title").fill("Forest notes");
  await page.getByLabel("Box text").fill("Leaves and trees");
  await page.getByRole("tab", { name: /Models/ }).click();
  await page.getByRole("button", { name: "Edit card space explorer" }).click();
  await page.getByLabel("Position X").fill("-0.8");
  await page.getByRole("tab", { name: /Lesson boxes/ }).click();
  await page.getByRole("button", { name: "Add image box" }).click();
  await page.getByLabel("Box title").fill("Space picture");
  await page
    .getByLabel("Choose image for box")
    .setInputFiles("tests/fixtures/plain-photo.png");
  await page.getByRole("button", { name: "Add video box" }).click();
  await page.getByLabel("Box title").fill("Space video");
  await page
    .getByLabel("Choose video file")
    .setInputFiles("tests/fixtures/short.webm");
  await page.getByRole("button", { name: "Add audio box" }).click();
  await page.getByLabel("Box title").fill("Space audio");
  await page.getByLabel("Choose audio file").setInputFiles({
    name: "space.wav",
    mimeType: "audio/wav",
    buffer: sampleWav(),
  });
  await expect(page.getByLabel("Box audio preview")).toBeVisible();
  await page.getByRole("tab", { name: /Models/ }).click();
  await page.getByRole("button", { name: "Edit card Forest facts" }).click();
  await expect(page.getByLabel("Position X")).toHaveValue("1.2");
  // Replacing a same-name GLB keeps the scene transform and lesson boxes.
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(
      await named(model, "FOREST-FRIENDS.GLB", "model/gltf-binary"),
    );
  await expect(page.getByLabel("Position X")).toHaveValue("1.2");
  await expect(page.getByLabel("Play button 1 name")).toHaveValue(
    "Forest jump",
  );
  await page.getByRole("tab", { name: /Lesson boxes/ }).click();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Forest notes" }),
  ).toBeVisible();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Space picture" }),
  ).toHaveCount(0);
  await expect(page.getByText("Saved locally")).toBeVisible();
  await page.reload();
  await expect(page.locator(".flash-card-item")).toHaveCount(2);
  await expect(page.getByLabel("Flashcard set name")).toHaveValue(
    "Learning cards",
  );
  await page.getByRole("button", { name: "Edit card Forest facts" }).click();
  await expect(page.getByLabel("Position X")).toHaveValue("1.2");
  await page.getByRole("tab", { name: /Lesson boxes/ }).click();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Forest notes" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Models/ }).click();
  await page.getByRole("button", { name: "Edit card space explorer" }).click();
  await expect(page.getByLabel("Position X")).toHaveValue("-0.8");
  await page.getByRole("tab", { name: /Lesson boxes/ }).click();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Space picture" }),
  ).toBeVisible();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Space video" }),
  ).toBeVisible();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Space audio" }),
  ).toBeVisible();
  await expect(page.getByText("Saved locally")).toBeVisible();

  const { files, manifest, link } = await archive(page);
  expect(manifest.mode).toBe("shared");
  expect(manifest.cards.map((card) => [card.title, card.targetIndex])).toEqual([
    ["Forest facts", 0],
    ["space explorer", 1],
  ]);
  const target = decode(files[`public/${manifest.target}`]);
  expect(target.dataList).toHaveLength(2);
  expect(Buffer.from(encode(target.dataList[0]))).toEqual(
    Buffer.from(
      encode(decode(await fs.readFile(mind("forest-friends"))).dataList[0]),
    ),
  );
  expect(Buffer.from(encode(target.dataList[1]))).toEqual(
    Buffer.from(
      encode(decode(await fs.readFile(mind("space-explorer"))).dataList[0]),
    ),
  );
  expect(manifest.cards[0].scene.cards.map((box) => box.title)).toEqual([
    "Forest notes",
  ]);
  expect(manifest.cards[1].scene.cards.map((box) => box.title)).toEqual([
    "Space picture",
    "Space video",
    "Space audio",
  ]);
  expect(manifest.cards[0].scene.objects[0].actions[0].label).toBe(
    "Forest jump",
  );
  const audioPath = manifest.cards[1].scene.cards.find(
    (card) => card.type === "audio",
  ).media.url;
  expect(files[`public/${audioPath}`].length).toBeGreaterThan(100);
  expect(Object.keys(files).filter((name) => name.startsWith("qr/"))).toEqual([
    "qr/one-qr-for-the-set.png",
  ]);
  expect(files["printable-marker-sheets.pdf"].length).toBeGreaterThan(10000);
  const params = new URLSearchParams(new URL(link).hash.slice(1));
  expect(params.get("page")).toBe("collection");
  expect(params.get("p")).toBe(manifest.id);
  expect(params.get("camera")).toBe("1");
  expect(params.has("c")).toBe(false);
  expect(new URL(link).pathname).toBe(base);

  // A fresh browser/device loads only the exported publication. A simulated
  // camera feeds two real compiled marker images to the shared tracker.
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
  });
  await servePublication(context, files);
  await fakeCamera(context);
  const viewer = await context.newPage();
  const viewerErrors = [];
  viewer.on("pageerror", (error) => viewerErrors.push(error.message));
  await viewer.goto(link);
  await expect(viewer.getByText("Marker found · space explorer")).toBeVisible({
    timeout: 70000,
  });
  await viewer.evaluate(() => {
    window.__markerName = "forest-friends";
  });
  await expect(viewer.getByText("Marker found · Forest facts")).toBeVisible({
    timeout: 70000,
  });
  await viewer.getByRole("button", { name: "Stop camera and go back" }).click();
  await expect
    .poll(() =>
      viewer.evaluate(() =>
        window.__streams.flatMap((stream) =>
          stream.getTracks().map((track) => track.readyState),
        ),
      ),
    )
    .toEqual(["ended"]);
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
  // If auto-start is denied, users get a clear error and a manual retry button.
  const denied = await browser.newContext({
    viewport: { width: 430, height: 900 },
  });
  await servePublication(denied, files);
  await denied.addInitScript(() =>
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  const deniedPage = await denied.newPage();
  await deniedPage.goto(link);
  await expect(
    deniedPage.getByText(/Camera access was not allowed/),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    deniedPage.getByRole("button", { name: "Start AR camera" }),
  ).toBeVisible();
  await denied.close();
});

test("a multi-target file requires a deliberate source index and exports only that target", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto(base);
  const targetData = [];
  for (const name of ["space-explorer", "forest-friends"])
    targetData.push(...decode(await fs.readFile(mind(name))).dataList);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(await named(model, "chosen.glb", "model/gltf-binary"));
  await page
    .getByLabel("Upload marker images")
    .setInputFiles(
      await named(image("forest-friends"), "CHOSEN.jpg", "image/jpeg"),
    );
  await page.getByLabel("Upload mind files").setInputFiles({
    name: "chosen.mind",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(encode({ v: 2, dataList: targetData })),
  });
  const index = page.getByLabel("Mind target in file for chosen");
  await expect(index).toHaveValue("");
  await page.getByRole("button", { name: "Publish one QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish flashcard set" });
  await expect(
    dialog.getByText(/choose the matching target inside/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Generate one QR & download ZIP" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await index.selectOption("1");
  const { files, manifest } = await archive(page);
  expect(manifest.cards[0].targetIndex).toBe(0);
  const combined = decode(files[`public/${manifest.target}`]);
  expect(combined.dataList).toHaveLength(1);
  expect(Buffer.from(encode(combined.dataList[0]))).toEqual(
    Buffer.from(encode(targetData[1])),
  );
});

test("identical tracking descriptors cannot silently map to different cards", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto(base);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles([
      await named(model, "one.glb"),
      await named(model, "two.glb"),
    ]);
  await page
    .getByLabel("Upload marker images")
    .setInputFiles([
      await named(image("space-explorer"), "one.jpg", "image/jpeg"),
      await named(image("forest-friends"), "two.jpg", "image/jpeg"),
    ]);
  await page
    .getByLabel("Upload mind files")
    .setInputFiles([
      await named(mind("space-explorer"), "one.mind"),
      await named(mind("space-explorer"), "two.mind"),
    ]);
  await expect(page.locator(".flash-file-badges .done")).toHaveCount(6);
  await page.getByRole("button", { name: "Publish one QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish flashcard set" });
  await dialog
    .getByRole("button", { name: "Generate one QR & download ZIP" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "use the same .mind target",
  );
  await expect(dialog.getByLabel("Shared QR link")).toHaveCount(0);
});

test("a full legacy individual-project list is not displaced by the new set", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    const projects = Array.from({ length: 40 }, (_, i) => ({
      id: crypto.randomUUID(),
      title: `Old event ${i + 1}`,
      mode: "individual",
      entries: [],
      updatedAt: new Date().toISOString(),
    }));
    localStorage.setItem(
      "wonderlab.mini-projects.v1",
      JSON.stringify(projects),
    );
    localStorage.setItem("wonderlab.projects.v1", "[]");
    sessionStorage.setItem("seeded", "1");
  });
  await page.goto(base);
  await expect(page.getByLabel("Flashcard set name")).toHaveValue(
    "My flashcard set",
  );
  await expect(page.getByText("Saved locally")).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wonderlab.mini-projects.v1")),
  );
  expect(stored).toHaveLength(41);
  expect(stored.filter((item) => item.mode === "individual")).toHaveLength(40);
  expect(stored.filter((item) => item.mode === "shared")).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel("Flashcard set name")).toHaveValue(
    "My flashcard set",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("wonderlab.mini-projects.v1")).length,
    ),
  ).toBe(41);
});

test("an existing shared set keeps its tracker, indices and scene edits", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto(`${base}?legacy=1`);
  await page.getByRole("button", { name: "New mini project" }).click();
  await page.getByLabel("Mini project name").fill("Earlier shared set");
  await page.getByRole("radio", { name: /One QR for a whole set/ }).click();
  await page
    .getByRole("button", { name: "Create mini project", exact: true })
    .click();
  const first = decode(await fs.readFile(mind("space-explorer"))).dataList[0];
  const second = decode(await fs.readFile(mind("forest-friends"))).dataList[0];
  const originalTracker = Buffer.from(
    encode({ v: 2, dataList: [first, second] }),
  );
  await page.getByLabel("Upload combined mind file").setInputFiles({
    name: "old-combined.mind",
    mimeType: "application/octet-stream",
    buffer: originalTracker,
  });
  await page
    .getByLabel("Upload multiple marker images")
    .setInputFiles([image("space-explorer"), image("forest-friends")]);
  await expect(page.locator(".mini-entry")).toHaveCount(2);
  await page.getByLabel("Upload model for card 1").setInputFiles(model);
  await page.getByRole("button", { name: /Expand forest friends/ }).click();
  await page.getByLabel("Upload model for card 2").setInputFiles(model);
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled();
  await page
    .locator(".mini-entry")
    .first()
    .getByRole("button", { name: "Edit scene & boxes" })
    .click();
  await page.getByLabel("Position X").fill("0.7");
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.getByRole("button", { name: "Add text box" }).click();
  await page.getByLabel("Box title").fill("Previous lesson");
  await expect(page.locator(".save-button")).toContainText("Saved");
  await page.goto(base);
  await expect(page.getByLabel("Flashcard set name")).toHaveValue(
    "Earlier shared set",
  );
  await expect(page.locator(".flash-card-item")).toHaveCount(2);
  await expect(
    page.getByText(/Existing combined tracker is preserved/),
  ).toBeVisible();
  await expect(page.getByLabel("Position X")).toHaveValue("0.7");
  await expect(
    page.getByLabel("Combined target index for space explorer"),
  ).toHaveValue("0");
  await page.getByRole("tab", { name: /Lesson boxes/ }).click();
  await expect(
    page.locator(".lesson-box-row").filter({ hasText: "Previous lesson" }),
  ).toBeVisible();
  const { files, manifest } = await archive(page);
  expect(manifest.cards.map((card) => card.targetIndex)).toEqual([0, 1]);
  expect(manifest.cards[0].scene.cards[0].title).toBe("Previous lesson");
  expect(Buffer.from(files[`public/${manifest.target}`])).toEqual(
    originalTracker,
  );
  // A newly added card must not silently inherit a guessed legacy target.
  await page
    .getByRole("dialog", { name: "Publish flashcard set" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page.getByRole("tab", { name: /Models/ }).click();
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(await named(model, "new-card.glb"));
  await page
    .getByLabel("Upload marker images")
    .setInputFiles(
      await named(image("forest-friends"), "new-card.jpg", "image/jpeg"),
    );
  await page.getByRole("button", { name: "Edit card new card" }).click();
  await expect(
    page.getByLabel("Combined target index for new card"),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Publish one QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish flashcard set" });
  await expect(
    dialog.getByText(/choose its existing combined target index/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Generate one QR & download ZIP" }),
  ).toBeDisabled();
});

test("local preview prepares the shared target and returns to the focused editor", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto(base);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(await named(model, "space-explorer.glb"));
  await page
    .getByLabel("Upload marker images")
    .setInputFiles(image("space-explorer"));
  await page
    .getByLabel("Upload mind files")
    .setInputFiles(mind("space-explorer"));
  await expect(page.locator(".flash-file-badges .done")).toHaveCount(3);
  await page.getByRole("button", { name: "Preview set" }).click();
  await expect(
    page.getByRole("heading", { name: "My flashcard set" }),
  ).toBeVisible({ timeout: 30000 });
  expect(
    new URLSearchParams(new URL(page.url()).hash.slice(1)).has("draft"),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Start AR camera" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview space explorer" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Make your own" }).click();
  await expect(page.getByLabel("Flashcard set name")).toHaveValue(
    "My flashcard set",
  );
  await expect(page.locator(".flash-card-item")).toHaveCount(1);
});

test("the library and inspector remain usable on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByLabel("Upload GLB models")).toHaveCount(1);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(await named(model, "mobile.glb"));
  await expect(
    page.getByRole("button", { name: "Edit card mobile" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit card mobile" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Object name")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("a new card asks for matching individual files, not an old combined tracker", async ({
  page,
}) => {
  await page.goto(base);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(await named(model, "lion.glb"));
  await page.getByRole("button", { name: "Publish one QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish flashcard set" });
  await expect(
    dialog.getByText("lion: upload the matching marker image."),
  ).toBeVisible();
  await expect(
    dialog.getByText("lion: upload its matching .mind file."),
  ).toBeVisible();
  await expect(dialog.getByText(/Upload one combined .mind file/)).toHaveCount(
    0,
  );
  await expect(
    dialog.getByRole("button", { name: "Generate one QR & download ZIP" }),
  ).toBeDisabled();
});

test("a full set rejects extra uploads before storing orphan files", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    const id = crypto.randomUUID();
    const entries = Array.from({ length: 50 }, (_, i) => ({
      id: crypto.randomUUID(),
      sceneId: crypto.randomUUID(),
      title: `Card ${i + 1}`,
      matchKey: `card-${i + 1}`,
      targetIndex: i,
    }));
    localStorage.setItem(
      "wonderlab.mini-projects.v1",
      JSON.stringify([
        {
          id,
          title: "Full set",
          mode: "shared",
          entries,
          updatedAt: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem("wonderlab.projects.v1", "[]");
    sessionStorage.setItem("seeded", "1");
  });
  await page.goto(base);
  await expect(page.locator(".flash-card-item")).toHaveCount(50);
  await page
    .getByLabel("Upload GLB models")
    .setInputFiles(await named(model, "extra.glb"));
  await expect(page.getByRole("alert")).toContainText("at most 50 cards");
  expect(
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open("wonderlab.mini.files.v1", 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const count = open.result
              .transaction("files")
              .objectStore("files")
              .count();
            count.onerror = () => reject(count.error);
            count.onsuccess = () => resolve(count.result);
          };
        }),
    ),
  ).toBe(0);
});
