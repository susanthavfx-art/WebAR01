import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { decode, encode } from "@msgpack/msgpack";
import { unzipSync } from "fflate";

const base = process.env.APP_BASE_PATH || "/";
const markers = ["space-explorer", "forest-friends"];
const imagePath = (name) => `public/markers/${name}.jpg`;
const mindPath = (name) => `public/markers/${name}.mind`;
const modelPath = "tests/fixtures/animated-box.glb";
const imageBox = "tests/fixtures/plain-photo.png";
async function combinedMind() {
  const dataList = [];
  for (const name of markers)
    dataList.push(...decode(await fs.readFile(mindPath(name))).dataList);
  return {
    name: "two-cards.mind",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(encode({ v: 2, dataList })),
  };
}
async function enterMini(page, name = "Dinosaur flash cards", mode = "shared") {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Mini projects", exact: true })
    .click();
  await page.getByRole("button", { name: "New mini project" }).click();
  await page.getByLabel("Mini project name").fill(name);
  await page
    .getByRole("radio", {
      name: mode === "shared" ? /One QR for a whole set/ : /A QR on every card/,
    })
    .click();
  await page
    .getByRole("button", { name: "Create mini project", exact: true })
    .click();
}
async function addTwoCards(page, mode = "shared", merge = false) {
  if (mode === "shared") {
    if (merge) {
      await page
        .getByLabel("Choose separate mind files to combine")
        .setInputFiles([mindPath(markers[1]), mindPath(markers[0])]);
      await expect(page.locator(".mini-combiner-list li")).toHaveCount(2);
      await page
        .getByRole("button", { name: "Move space-explorer.mind up" })
        .click();
      await expect(
        page.locator(".mini-combiner-list li").first(),
      ).toContainText("space-explorer.mind");
      await page
        .getByRole("button", { name: "Combine and use these files" })
        .click();
      await expect(
        page.getByText(/combined-targets\.mind.*2 targets/),
      ).toBeVisible();
    } else {
      await page
        .getByLabel("Upload combined mind file")
        .setInputFiles(await combinedMind());
      await expect(page.getByText(/two-cards\.mind.*2 targets/)).toBeVisible();
    }
  }
  await page
    .getByLabel("Upload multiple marker images")
    .setInputFiles(markers.map(imagePath));
  await expect(page.locator(".mini-entry")).toHaveCount(2);
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  if (mode === "individual")
    await page
      .getByLabel("Upload mind file for card 1")
      .setInputFiles(mindPath(markers[0]));
  await page.getByRole("button", { name: /Expand forest friends/ }).click();
  await page.getByLabel("Upload model for card 2").setInputFiles(modelPath);
  if (mode === "individual") {
    await page.getByLabel("Target index for card 2").fill("0");
    await page
      .getByLabel("Upload mind file for card 2")
      .setInputFiles(mindPath(markers[1]));
  }
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled({ timeout: 20000 });
}
async function downloadPackage(page) {
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page
    .getByRole("button", { name: "Prepare publication package" })
    .click();
  const download = await downloadPromise;
  const files = unzipSync(
    new Uint8Array(await fs.readFile(await download.path())),
  );
  const manifestName = Object.keys(files).find((name) =>
    name.endsWith("/manifest.json"),
  );
  const manifest = JSON.parse(new TextDecoder().decode(files[manifestName]));
  return { files, manifest, download };
}
async function servePublication(context, files) {
  await context.route(`**/published/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const path = pathname.slice(pathname.indexOf("/published/") + 1);
    const bytes = files[`public/${path}`];
    if (!bytes) return route.fulfill({ status: 404, body: "Not found" });
    const type = path.endsWith(".json")
      ? "application/json"
      : path.endsWith(".png")
        ? "image/png"
        : path.endsWith(".jpg")
          ? "image/jpeg"
          : path.endsWith(".webm")
            ? "video/webm"
            : path.endsWith(".wav")
              ? "audio/wav"
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

test("shared set uploads, image box, local persistence and a portable publication", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enterMini(page);
  await addTwoCards(page, "shared", true);
  await page
    .locator(".mini-entry")
    .first()
    .getByRole("button", { name: "Edit scene & boxes" })
    .click();
  await expect(page.getByLabel("Object name")).toHaveValue("space explorer");
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.getByRole("button", { name: "Add image box" }).click();
  await page.getByLabel("Box title").fill("Dinosaur picture");
  await page.getByLabel("Choose image for box").setInputFiles(imageBox);
  await expect(page.getByAltText("Image box preview")).toBeVisible();
  await expect(page.locator(".canvas-area .lesson-card-image")).toBeVisible();
  // With no cloud account configured, audio/video also remain usable locally.
  await page.getByRole("button", { name: "Add video box" }).click();
  await page.getByLabel("Box title").fill("Dinosaur video");
  await page
    .getByLabel("Choose video file")
    .setInputFiles("tests/fixtures/short.webm");
  await expect(page.getByLabel("Box video preview")).toBeVisible();
  await page.locator(".publish-button").click();
  await expect(page.getByLabel("Edit mini project name")).toHaveValue(
    "Dinosaur flash cards",
  );
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Mini projects", exact: true })
    .click();
  await page.getByRole("button", { name: /Dinosaur flash cards/ }).click();
  await expect(
    page.getByText(/combined-targets\.mind.*2 targets/),
  ).toBeVisible();
  await expect(page.locator(".mini-entry")).toHaveCount(2);
  const { files, manifest, download } = await downloadPackage(page);
  expect(download.suggestedFilename()).toBe(
    "dinosaur-flash-cards-publication.zip",
  );
  expect(manifest.mode).toBe("shared");
  expect(manifest.cards.map((card) => card.targetIndex)).toEqual([0, 1]);
  expect(
    manifest.cards[0].scene.cards.find((box) => box.type === "image").media.url,
  ).toMatch(/^published\//);
  const videoPath = manifest.cards[0].scene.cards.find(
    (box) => box.type === "video",
  ).media.url;
  expect(videoPath).toMatch(/^published\/.*\.webm$/);
  expect(files[`public/${videoPath}`].length).toBeGreaterThan(100);
  expect(
    Object.keys(files).filter((name) => name.startsWith("qr/")).length,
  ).toBe(1);
  expect(files["printable-marker-sheets.pdf"].length).toBeGreaterThan(10000);
  const publicLink = await page
    .locator(".mini-qr-row button")
    .first()
    .evaluate((el) => {
      // The URL is deterministic from the publication's ID and displayed base.
      return document.querySelector('input[aria-label="Deployed studio URL"]')
        .value;
    });
  const link = `${publicLink}#page=collection&p=${manifest.id}`;
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
  });
  await servePublication(context, files);
  await fakeCamera(context);
  const viewer = await context.newPage();
  const viewerErrors = [];
  viewer.on("pageerror", (e) => viewerErrors.push(e.message));
  await viewer.goto(link);
  await expect(
    viewer.getByRole("heading", { name: "Dinosaur flash cards" }),
  ).toBeVisible();
  await viewer
    .getByRole("button", { name: "Open lesson box Dinosaur picture" })
    .click();
  await expect(
    viewer.getByRole("dialog", { name: "Dinosaur picture" }).locator("img"),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer
    .getByRole("button", { name: "Open lesson box Dinosaur video" })
    .click();
  const videoElement = viewer
    .getByRole("dialog", { name: "Dinosaur video" })
    .locator("video");
  await expect(videoElement).toBeVisible();
  await expect
    .poll(() => videoElement.evaluate((video) => video.readyState))
    .toBeGreaterThan(0);
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer.getByRole("button", { name: "Start AR camera" }).click();
  await expect(viewer.getByText("Marker found · space explorer")).toBeVisible({
    timeout: 50000,
  });
  await viewer
    .getByRole("button", { name: "Open lesson box Dinosaur picture" })
    .click();
  await expect(
    viewer.getByRole("dialog", { name: "Dinosaur picture" }).locator("img"),
  ).toBeVisible();
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer.evaluate(() => {
    window.__markerName = "forest-friends";
  });
  await expect(viewer.getByText("Marker found · forest friends")).toBeVisible({
    timeout: 50000,
  });
  await viewer.getByRole("button", { name: "Stop camera and go back" }).click();
  await expect
    .poll(() =>
      viewer.evaluate(() =>
        window.__streams.flatMap((s) => s.getTracks().map((t) => t.readyState)),
      ),
    )
    .toEqual(["ended"]);
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test("individual mode creates a different QR and matching target per card", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await enterMini(page, "Holiday cards", "individual");
  await addTwoCards(page, "individual");
  const { files, manifest } = await downloadPackage(page);
  expect(manifest.mode).toBe("individual");
  expect(manifest.cards.map((card) => card.targetIndex)).toEqual([0, 0]);
  expect(manifest.cards[0].target).not.toBe(manifest.cards[1].target);
  expect(
    Object.keys(files).filter((name) => name.startsWith("qr/")).length,
  ).toBe(2);
  await expect(page.locator(".mini-qr-row")).toHaveCount(2);
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
  });
  await servePublication(context, files);
  await fakeCamera(context);
  const viewer = await context.newPage();
  const root = new URL(page.url()).origin + base;
  await viewer.goto(
    `${root}#page=collection&p=${manifest.id}&c=${manifest.cards[1].id}`,
  );
  await expect(
    viewer.getByRole("heading", { name: "Holiday cards" }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Preview forest friends" }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Preview space explorer" }),
  ).toHaveCount(0);
  await viewer.evaluate(() => {
    window.__markerName = "forest-friends";
  });
  await viewer.getByRole("button", { name: "Start AR camera" }).click();
  await expect(viewer.getByText("Marker found · forest friends")).toBeVisible({
    timeout: 50000,
  });
  await viewer.getByRole("button", { name: "Stop camera and go back" }).click();
  await expect
    .poll(() =>
      viewer.evaluate(() =>
        window.__streams.flatMap((s) => s.getTracks().map((t) => t.readyState)),
      ),
    )
    .toEqual(["ended"]);
  await viewer.goto(`${root}#page=collection&p=${manifest.id}`);
  await expect(
    viewer.getByText("Each card in this project has its own QR code."),
  ).toBeVisible();
  await context.close();
});

test("rejects bad target files and duplicate or out-of-range shared indices", async ({
  page,
}) => {
  await enterMini(page, "Validation set");
  await page.getByLabel("Upload combined mind file").setInputFiles({
    name: "bad.mind",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not a target"),
  });
  await expect(page.getByRole("alert")).toContainText("not a readable MindAR");
  await addTwoCards(page);
  await page.getByLabel("Target index for card 2").fill("0");
  await expect(page.getByText(/already used by another card/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeDisabled();
  await page.getByLabel("Target index for card 2").fill("2");
  await expect(page.getByText(/outside the 2-target/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeDisabled();
});

test("a standalone local image box can be moved into a publishable mini project", async ({
  page,
}) => {
  test.setTimeout(80000);
  await page.goto(`${base}?studio=1`);
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.getByRole("button", { name: "Add image box" }).click();
  await page.getByLabel("Box title").fill("My photo");
  await page.getByLabel("Choose image for box").setInputFiles(imageBox);
  await expect(page.getByAltText("Image box preview")).toBeVisible();
  await page.getByRole("button", { name: "Publish & share" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Publish and share your AR creation",
  });
  await expect(dialog.getByRole("alert")).toContainText(
    "saved only on this device",
  );
  await expect(
    dialog.getByRole("button", { name: "Print your marker" }),
  ).toBeDisabled();
  await expect(dialog.locator("#share-link")).toHaveValue("");
  await dialog
    .getByRole("button", { name: /Continue in a mini project/ })
    .click();
  await expect(page.getByLabel("Edit mini project name")).toHaveValue(
    "My space adventure",
  );
  await expect(page.getByText(/marker\.jpg/)).toBeVisible();
  await expect(page.getByText(/target\.mind/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled();
  const { manifest } = await downloadPackage(page);
  expect(
    manifest.cards[0].scene.cards.some(
      (box) => box.type === "image" && box.media?.url.startsWith("published/"),
    ),
  ).toBe(true);
});

test("bulk marker upload handles a 25-card set and target indices", async ({
  page,
}) => {
  test.setTimeout(100000);
  await enterMini(page, "Twenty five cards");
  const first = decode(await fs.readFile(mindPath(markers[0]))).dataList[0];
  const combined = Buffer.from(
    encode({ v: 2, dataList: Array(25).fill(first) }),
  );
  await page.getByLabel("Upload combined mind file").setInputFiles({
    name: "25-targets.mind",
    mimeType: "application/octet-stream",
    buffer: combined,
  });
  await expect(page.getByText(/25-targets\.mind.*25 targets/)).toBeVisible({
    timeout: 30000,
  });
  const bytes = await fs.readFile(imageBox);
  await page.getByLabel("Upload multiple marker images").setInputFiles(
    Array.from({ length: 25 }, (_, i) => ({
      name: `card-${String(i + 1).padStart(2, "0")}.png`,
      mimeType: "image/png",
      buffer: bytes,
    })),
  );
  await expect(page.locator(".mini-entry")).toHaveCount(25, { timeout: 30000 });
  const indices = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("wonderlab.mini-projects.v1"),
    )[0].entries.map((e) => e.targetIndex),
  );
  expect(indices).toEqual(Array.from({ length: 25 }, (_, i) => i));
  await page.reload();
  await page
    .getByRole("button", { name: "Mini projects", exact: true })
    .click();
  await page.getByRole("button", { name: /Twenty five cards/ }).click();
  await expect(page.locator(".mini-entry")).toHaveCount(25);
  await expect(page.getByText(/25-targets\.mind.*25 targets/)).toBeVisible();
});

test("an individual card previews even when another card is unfinished", async ({
  page,
}) => {
  await enterMini(page, "Work in progress", "individual");
  await page
    .getByLabel("Upload multiple marker images")
    .setInputFiles([imagePath(markers[0]), imagePath(markers[1])]);
  await expect(page.locator(".mini-entry")).toHaveCount(2);
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await page
    .getByLabel("Upload mind file for card 1")
    .setInputFiles(mindPath(markers[0]));
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeDisabled();
  const popupPromise = page.waitForEvent("popup");
  await page
    .locator(".mini-entry")
    .first()
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  const preview = await popupPromise;
  await expect(
    preview.getByRole("heading", { name: "Work in progress" }),
  ).toBeVisible();
  await expect(
    preview.getByRole("button", { name: "Preview space explorer" }),
  ).toBeVisible();
  await expect(preview.getByText("This wonder needs a new link")).toHaveCount(
    0,
  );
  await preview.close();
});

test("removing and reuploading a model replaces it without accumulating copies", async ({
  page,
}) => {
  await enterMini(page, "Model replacement");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await expect(page.getByText(/animated-box\.glb/)).toBeVisible();
  await page.getByRole("button", { name: "Edit scene & boxes" }).click();
  await page.getByRole("button", { name: /Scene\s*1/ }).click();
  await page.getByRole("button", { name: "Remove Card 1" }).click();
  await expect(page.getByText("A world waiting to happen")).toBeVisible();
  await page.locator(".publish-button").click();
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const mini = JSON.parse(
          localStorage.getItem("wonderlab.mini-projects.v1"),
        )[0];
        const scene = JSON.parse(
          localStorage.getItem("wonderlab.projects.v1"),
        ).find((p) => p.id === mini.entries[0].sceneId);
        return scene?.objects.length;
      }),
    )
    .toBe(1);
  const firstReplacementId = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("wonderlab.mini-projects.v1"))[0]
        .entries[0].model.id,
  );
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await expect
    .poll(() =>
      page.evaluate((firstReplacementId) => {
        const mini = JSON.parse(
          localStorage.getItem("wonderlab.mini-projects.v1"),
        )[0];
        const scene = JSON.parse(
          localStorage.getItem("wonderlab.projects.v1"),
        ).find((p) => p.id === mini.entries[0].sceneId);
        return [
          mini.entries[0].model.id !== firstReplacementId,
          scene?.objects.length,
          scene?.objects[0].id === mini.entries[0].modelObjectId,
          scene?.objects[0].model.file.includes(mini.entries[0].model.id),
        ];
      }, firstReplacementId),
    )
    .toEqual([true, 1, true, true]);
});

function shortWav() {
  const rate = 8000,
    frames = 3200,
    data = Buffer.alloc(44 + frames * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + frames * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    data.writeInt16LE(
      Math.round(Math.sin((i / rate) * 440 * 2 * Math.PI) * 9000),
      44 + i * 2,
    );
  return { name: "sound.wav", mimeType: "audio/wav", buffer: data };
}

test("local audio boxes and model action sounds are packaged and play in the published viewer", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await enterMini(page, "Animal sounds");
  await page
    .getByLabel("Upload combined mind file")
    .setInputFiles(mindPath(markers[0]));
  await page
    .getByLabel("Upload multiple marker images")
    .setInputFiles(imagePath(markers[0]));
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Edit scene & boxes" }).click();
  await page.getByRole("button", { name: "Add play button" }).click();
  await page.getByLabel("Play button 1 name").fill("Roar");
  await page
    .locator(".action-card")
    .first()
    .getByLabel("Choose audio file")
    .setInputFiles(shortWav());
  await expect(page.getByLabel("Play button 1 sound preview")).toBeVisible();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.getByRole("button", { name: "Add audio box" }).click();
  await page.getByLabel("Box title").fill("Animal call");
  await page
    .locator(".inspector-panel")
    .getByLabel("Choose audio file")
    .setInputFiles(shortWav());
  await expect(page.getByLabel("Box audio preview")).toBeVisible();
  await page.locator(".publish-button").click();
  const { files, manifest } = await downloadPackage(page);
  const card = manifest.cards[0],
    audioBox = card.scene.cards.find((box) => box.type === "audio");
  const soundPath = card.scene.objects[0].actions[0].sound.url;
  expect(audioBox.media.url).toMatch(/^published\/.*\.wav$/);
  expect(soundPath).toMatch(/^published\/.*\.wav$/);
  expect(files[`public/${audioBox.media.url}`].length).toBeGreaterThan(6000);
  expect(files[`public/${soundPath}`].length).toBeGreaterThan(6000);

  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
  });
  await servePublication(context, files);
  await fakeCamera(context);
  await context.addInitScript(() => {
    window.__played = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.__played.push(this.currentSrc || this.src);
      return play.apply(this, args);
    };
  });
  const viewer = await context.newPage();
  const root = new URL(page.url()).origin + base;
  await viewer.goto(`${root}#page=collection&p=${manifest.id}`);
  await viewer
    .getByRole("button", { name: "Open lesson box Animal call" })
    .click();
  const audio = viewer
    .getByRole("dialog", { name: "Animal call" })
    .locator("audio");
  await expect(audio).toBeVisible();
  await expect
    .poll(() => audio.evaluate((el) => el.readyState))
    .toBeGreaterThan(0);
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer.getByRole("button", { name: "Start AR camera" }).click();
  await expect(viewer.getByText("Marker found · space explorer")).toBeVisible({
    timeout: 50000,
  });
  await viewer
    .getByRole("toolbar", { name: "Play buttons" })
    .getByRole("button", { name: "Roar" })
    .click();
  await expect
    .poll(() =>
      viewer.evaluate(() =>
        window.__played.some(
          (url) => url.includes("/published/") && url.endsWith(".wav"),
        ),
      ),
    )
    .toBe(true);
  await viewer.getByRole("button", { name: "Stop camera and go back" }).click();
  await context.close();
});

test("Sinhala titles are shaped for the printable PDF and kept in the publication", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__drawnText = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (/[\u0D80-\u0DFF]/.test(String(text)))
        window.__drawnText.push(String(text));
      return fillText.call(this, text, ...args);
    };
  });
  await enterMini(page, "වෙසක් කාඩ්");
  await page
    .getByLabel("Upload combined mind file")
    .setInputFiles(mindPath(markers[0]));
  await page
    .getByLabel("Upload multiple marker images")
    .setInputFiles(imagePath(markers[0]));
  await page.getByLabel("Name of card 1").fill("සුබ වෙසක්");
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled();
  const { files, manifest } = await downloadPackage(page);
  expect(manifest.title).toBe("වෙසක් කාඩ්");
  expect(manifest.cards[0].title).toBe("සුබ වෙසක්");
  expect(files["printable-marker-sheets.pdf"].length).toBeGreaterThan(10000);
  expect(
    await page.evaluate(() =>
      document.fonts.check('400 64px "Noto Sans Sinhala"', "සිංහල"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => window.__drawnText)).toEqual(
    expect.arrayContaining(["වෙසක් කාඩ්", "සුබ වෙසක්"]),
  );
});

test("temporary Arena previews do not become the default public QR address", async ({
  page,
}, testInfo) => {
  const upstream = testInfo.project.use.baseURL;
  await page.route("https://preview.e2b.app/**", async (route) => {
    const incoming = new URL(route.request().url());
    const response = await route.fetch({
      url: `${upstream}${incoming.pathname}${incoming.search}`,
    });
    await route.fulfill({ response });
  });
  await page.goto(`https://preview.e2b.app${base}`);
  await page.getByRole("button", { name: "New mini project" }).click();
  await page.getByLabel("Mini project name").fill("Preview address");
  await page
    .getByRole("button", { name: "Create mini project", exact: true })
    .click();
  await expect(page.getByLabel("Deployed studio URL")).toHaveValue("");
});

test("a shared camera can reach a high target index in a 25-card file", async ({
  page,
  browser,
}) => {
  // A large synthetic target file: 24 repeats of one real compiled marker and
  // a different real marker at index 24. This tests 25 anchors and the high
  // index, not 25 *distinct* physical images or phone performance.
  test.setTimeout(180000);
  await enterMini(page, "Twenty five target camera");
  await page
    .getByLabel("Upload combined mind file")
    .setInputFiles(mindPath(markers[0]));
  await page
    .getByLabel("Upload multiple marker images")
    .setInputFiles(imagePath(markers[0]));
  await page.getByLabel("Upload model for card 1").setInputFiles(modelPath);
  await expect(
    page.getByRole("button", { name: "Prepare publication package" }),
  ).toBeEnabled();
  const { files, manifest } = await downloadPackage(page);
  const space = decode(await fs.readFile(mindPath(markers[0]))).dataList[0];
  const forest = decode(await fs.readFile(mindPath(markers[1]))).dataList[0];
  files[`public/${manifest.target}`] = new Uint8Array(
    encode({ v: 2, dataList: [...Array(24).fill(forest), space] }),
  );
  const forestPath = `published/${manifest.id}/files/${crypto.randomUUID()}.jpg`;
  files[`public/${forestPath}`] = new Uint8Array(
    await fs.readFile(imagePath(markers[1])),
  );
  const template = manifest.cards[0];
  manifest.cards = Array.from({ length: 25 }, (_, i) => ({
    ...template,
    id: crypto.randomUUID(),
    title: `Card ${i + 1}`,
    targetIndex: i,
    marker: i === 24 ? template.marker : forestPath,
  }));
  files[`public/published/${manifest.id}/manifest.json`] =
    new TextEncoder().encode(JSON.stringify(manifest));
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
  });
  await servePublication(context, files);
  await fakeCamera(context);
  const viewer = await context.newPage();
  const root = new URL(page.url()).origin + base;
  await viewer.goto(`${root}#page=collection&p=${manifest.id}`);
  await viewer.evaluate(() => {
    window.__markerName = "forest-friends";
  });
  await viewer.getByRole("button", { name: "Start AR camera" }).click();
  await expect(
    viewer.getByText(/Marker found · Card (?:[1-9]|1[0-9]|2[0-4])$/),
  ).toBeVisible({ timeout: 80000 });
  await viewer.evaluate(() => {
    window.__markerName = "space-explorer";
  });
  await expect(viewer.getByText("Marker found · Card 25")).toBeVisible({
    timeout: 80000,
  });
  await viewer.getByRole("button", { name: "Stop camera and go back" }).click();
  await expect
    .poll(() =>
      viewer.evaluate(() =>
        window.__streams.flatMap((s) => s.getTracks().map((t) => t.readyState)),
      ),
    )
    .toEqual(["ended"]);
  await context.close();
});
