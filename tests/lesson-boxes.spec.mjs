import { test, expect } from "@playwright/test";
import LZString from "lz-string";
import {
  CLOUD_URL,
  TEACHER_EMAIL,
  TEACHER_ID,
  createCloudStore,
  useFakeCloud,
  useFakeMicrophone,
} from "./helpers/fake-cloud.mjs";

const appPath = process.env.APP_BASE_PATH || "/";
const key = "wonderlab.projects.v1";
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};
const robotProject = (cards = []) => ({
  version: 2,
  id: "lesson-project",
  title: "Cell lesson",
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
    },
  ],
  cards,
  updatedAt: new Date().toISOString(),
});
async function seed(target, project = robotProject()) {
  await target.addInitScript(
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
  expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
const canvasCard = (page, title) =>
  page.locator(".canvas-area .lesson-card", { hasText: title });

test("teacher adds text, link and audio boxes, points them at a model and shares them", async ({
  page,
  browser,
}) => {
  const errors = errorsFor(page);
  await seed(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await expect(page.getByText("Files save on this device")).toBeVisible();

  await page.getByRole("button", { name: "Add text box" }).click();
  await page.getByLabel("Box title").fill("Nucleus");
  await page
    .getByLabel("Box text")
    .fill("The nucleus is the control centre.\nIt stores DNA.");
  const nucleus = canvasCard(page, "Nucleus");
  await expect(nucleus).toBeVisible();
  await expect(nucleus).toContainText("The nucleus is the control centre.");
  await expect(page.getByText("A line points to Robot.")).toBeVisible();
  const dot = page.locator(".canvas-area .lesson-lines circle").first();
  await expect(dot).toBeVisible();

  // Re-point the line by clicking the model where the current pointer sits.
  await page.getByRole("button", { name: "Point to a model part" }).click();
  await expect(page.locator(".pick-banner")).toBeVisible();
  const area = await page.locator(".canvas-area .studio-canvas").boundingBox();
  const cx = Number(await dot.getAttribute("cx")),
    cy = Number(await dot.getAttribute("cy"));
  await page.mouse.click(area.x + cx, area.y + cy - 6);
  await expect(page.getByText("The box now points to Robot.")).toBeVisible();
  await expect(page.locator(".pick-banner")).toHaveCount(0);

  // Drag the card in the 3D workspace.
  const beforeX = Number(await page.getByLabel("Box position X").inputValue());
  const card = await nucleus.boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + 18);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 - 170, card.y + 40, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Box position X").inputValue()),
    )
    .toBeLessThan(beforeX - 0.4);

  await page.getByRole("button", { name: "Add link box" }).click();
  await page.getByLabel("Box title").fill("Explore cells");
  const linkInput = page.getByLabel("Web link");
  await linkInput.fill("javascript:alert(1)");
  await linkInput.press("Enter");
  await expect(page.getByRole("alert")).toContainText("full website address");
  await linkInput.fill("example.com/cells");
  await linkInput.press("Enter");
  await expect(page.getByText("Opens example.com in a new tab")).toBeVisible();
  await page.getByLabel("Link button text").fill("Cell website");

  await page.getByRole("button", { name: "Add audio box" }).click();
  await expect(
    page.getByText(
      "Files save on this device. Publish the set before sharing.",
    ),
  ).toBeVisible();
  await expect(canvasCard(page, "Listen and learn")).toContainText(
    "Add a voice or audio file",
  );
  // Wait for this specific edit to reach localStorage rather than observing
  // the previous edit's transient "Saved" label during React's save effect.
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const project = JSON.parse(localStorage.getItem(key) || "[]").find(
          (item) => item.id === "lesson-project",
        );
        return project?.cards?.length || 0;
      }, key),
    )
    .toBe(3);
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "Lesson 3" }).click();
  await expect(page.locator(".lesson-box-row")).toHaveCount(3);
  await expect(canvasCard(page, "Cell website")).toBeVisible();
  await page.screenshot({ path: "tests/lesson-boxes-studio.png" });

  await page.getByRole("button", { name: "Publish & share" }).click();
  await expect(page.getByText("1 object · 3 lesson boxes")).toBeVisible();
  const link = await page.locator("#share-link").inputValue();
  expect(link).toContain("scene=");

  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  const viewer = await context.newPage();
  const viewerErrors = errorsFor(viewer);
  await viewer.goto(link);
  await expect(viewer.getByText("Tap the 3 lesson boxes")).toBeVisible();
  await viewer.getByRole("button", { name: "Open lesson box Nucleus" }).click();
  const sheet = viewer.getByRole("dialog", { name: "Nucleus" });
  await expect(sheet).toContainText("It stores DNA.");
  await viewer.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await viewer
    .getByRole("button", { name: "Open lesson box Explore cells" })
    .click();
  const open = viewer.getByRole("link", { name: /Cell website/ });
  await expect(open).toHaveAttribute("href", "https://example.com/cells");
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", /noopener/);
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer
    .getByRole("button", { name: "Open lesson box Listen and learn" })
    .click();
  await expect(
    viewer.getByText("Your teacher has not added this media yet."),
  ).toBeVisible();
  await viewer.screenshot({ path: "tests/lesson-boxes-viewer.png" });
  await context.close();
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
});

test("signed-in teacher records a voice, uploads a video and publishes a short lesson link", async ({
  browser,
}) => {
  const store = createCloudStore();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });
  await useFakeCloud(context, store);
  await useFakeMicrophone(context);
  const page = await context.newPage();
  const errors = errorsFor(page);
  await seed(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.getByRole("button", { name: /Teacher sign-in/ }).click();
  const dialog = page.getByRole("dialog", { name: "Teacher sign-in" });
  await dialog.getByLabel("TEACHER EMAIL").fill("someone@else.example");
  await dialog.getByRole("button", { name: "Email me a code" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "not on the teacher list",
  );
  await dialog.getByLabel("TEACHER EMAIL").fill(TEACHER_EMAIL);
  await dialog.getByRole("button", { name: "Email me a code" }).click();
  await expect(
    dialog.getByText(`Enter the code sent to ${TEACHER_EMAIL}`),
  ).toBeVisible();
  await dialog.getByLabel("SIGN-IN CODE").fill("000000");
  await dialog.getByRole("button", { name: "Sign in" }).click();
  await expect(dialog.getByRole("alert")).toContainText("incorrect or expired");
  await dialog.getByLabel("SIGN-IN CODE").fill("123456");
  await dialog.getByRole("button", { name: "Sign in" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(TEACHER_EMAIL).first()).toBeVisible();
  const otp = store.requests.find(
    (r) => r.path === "/auth/v1/otp" && r.body.email === TEACHER_EMAIL,
  );
  expect(otp.body.create_user).toBe(false);

  // Voice recording.
  await page.getByRole("button", { name: "Add audio box" }).click();
  await page.getByLabel("Box title").fill("Mitochondria voice");
  await page.getByRole("button", { name: "Record voice" }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText(/Recording 0:0\d \/ 5:00/)).toBeVisible();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByLabel("Recorded voice preview")).toBeVisible();
  await page.getByRole("button", { name: "Use recording" }).click();
  await expect(page.getByLabel("Box audio preview")).toBeVisible();
  await expect(
    page.getByText("Voice recording", { exact: true }),
  ).toBeVisible();
  const audioPath = [...store.files.keys()].find((p) =>
    p.startsWith(`${TEACHER_ID}/audio/`),
  );
  expect(audioPath).toBeTruthy();
  expect(store.files.get(audioPath).type).toMatch(/^audio\/(webm|mp4|ogg)$/);
  expect(store.files.get(audioPath).body.length).toBeGreaterThan(200);
  expect(
    await page.evaluate(() =>
      window.__micStreams.flatMap((s) =>
        s.getTracks().map((t) => t.readyState),
      ),
    ),
  ).toEqual(["ended"]);

  // Video upload, including a rejected file type.
  await page.getByRole("button", { name: "Add video box" }).click();
  await page.getByLabel("Box title").fill("Cell video");
  const videoInput = page.locator('input[aria-label="Choose video file"]');
  await videoInput.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(300, 65),
  });
  await expect(page.getByRole("alert")).toContainText("Choose an MP4");
  await videoInput.setInputFiles({
    name: "cell-tour.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(4096, 1),
  });
  await expect(page.getByLabel("Box video preview")).toBeVisible();
  const videoPath = [...store.files.keys()].find((p) =>
    p.startsWith(`${TEACHER_ID}/video/`),
  );
  expect(videoPath).toMatch(/\.mp4$/);
  expect(store.files.get(videoPath).type).toBe("video/mp4");
  await expect(canvasCard(page, "Cell video")).toContainText("Watch video");
  await expect(canvasCard(page, "Mitochondria voice")).toContainText("Listen");

  await page.getByRole("button", { name: "Publish & share" }).click();
  await expect(page.locator("#share-link")).toHaveValue(/lesson=/);
  const link = await page.locator("#share-link").inputValue();
  expect(link).not.toContain("scene=");
  expect(link.length).toBeLessThan(200);
  await expect(
    page.getByRole("img", {
      name: "QR code to open your AR creation on a phone",
    }),
  ).toBeVisible();
  const lessonPath = [...store.files.keys()].find((p) =>
    p.startsWith(`${TEACHER_ID}/lessons/`),
  );
  expect(store.files.get(lessonPath).type).toBe("application/json");
  await page
    .getByRole("button", { name: "Close dialog" })
    .click()
    .catch(() => {});

  // A student opens the short link in a fresh browser.
  const student = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await useFakeCloud(student, store);
  const viewer = await student.newPage();
  const viewerErrors = errorsFor(viewer);
  await viewer.goto(link);
  await expect(viewer.getByText("Tap the 2 lesson boxes")).toBeVisible();
  await expect(viewer.locator(".lesson-layer.compact")).toHaveCount(1);
  await viewer
    .getByRole("button", { name: "Open lesson box Mitochondria voice" })
    .click();
  await expect(viewer.locator(".lesson-sheet-audio")).toHaveAttribute(
    "src",
    `${CLOUD_URL}/storage/v1/object/public/lesson-media/${audioPath}`,
  );
  await viewer.screenshot({ path: "tests/lesson-boxes-mobile-audio.png" });
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer
    .getByRole("button", { name: "Open lesson box Cell video" })
    .click();
  await expect(viewer.locator(".lesson-sheet-video")).toHaveAttribute(
    "src",
    `${CLOUD_URL}/storage/v1/object/public/lesson-media/${videoPath}`,
  );
  await viewer.getByRole("button", { name: "Close lesson box" }).click();
  await viewer.goto(link.replace("page=view", "page=print"));
  await expect(
    viewer.getByRole("img", { name: "QR code to open this AR scene" }),
  ).toBeVisible();
  // Missing lesson files fail with a clear message.
  await viewer.goto(
    `${new URL(link).origin}${appPath}#page=view&lesson=${TEACHER_ID}/00000000-0000-4000-8000-000000000000`,
  );
  await viewer.reload();
  await expect(viewer.getByText("This lesson was not found.")).toBeVisible();
  await student.close();

  await page.getByRole("button", { name: "Lesson 2" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: /Teacher sign-in/ }),
  ).toBeVisible();
  expect(viewerErrors).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test("unsafe lesson box content from a crafted link is neutralised", async ({
  page,
}) => {
  const errors = errorsFor(page);
  const payload = {
    v: 2,
    n: "Safety check",
    m: 0,
    a: [],
    o: [["robot", 0, 0, 0, 0, 0, 0, 1, 0, 1, "", ""]],
    c: [
      [
        0,
        '<img src=x onerror="window.__xss=1">',
        "<b>Plain</b> text",
        0,
        2.6,
        0.4,
        0,
        0,
        0,
        0.7,
        0,
        1,
        0,
      ],
      [
        3,
        "Bad link",
        "",
        1,
        -2.6,
        0.4,
        0,
        -1,
        0,
        0,
        0,
        1,
        ["javascript:alert(1)", "Click"],
      ],
      [
        1,
        "Bad audio",
        "",
        2,
        2.6,
        3.4,
        0,
        7,
        0,
        0,
        0,
        1,
        ["http://insecure.example/a.mp3", "a", "audio/mpeg", 0, 0],
      ],
      [
        2,
        "Wrong type",
        "",
        3,
        -2.6,
        3.4,
        0,
        -1,
        0,
        0,
        0,
        1,
        ["https://media.example/v.mp4", "v", "audio/mpeg", 0, 0],
      ],
    ],
  };
  const scene = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  await page.goto(`${appPath}#page=view&scene=${scene}`);
  await page.reload();
  await expect(page.getByText("Tap the 4 lesson boxes")).toBeVisible();
  const layer = page.locator(".viewer-scene .lesson-layer");
  await expect(
    layer.getByText('<img src=x onerror="window.__xss=1">'),
  ).toBeVisible();
  await expect(layer.locator("img, b")).toHaveCount(0);
  await page.getByRole("button", { name: "Open lesson box Bad link" }).click();
  await expect(
    page.getByText("Your teacher has not added this media yet."),
  ).toBeVisible();
  await expect(page.locator(".lesson-sheet a")).toHaveCount(0);
  await page.getByRole("button", { name: "Close lesson box" }).click();
  await page.getByRole("button", { name: "Open lesson box Bad audio" }).click();
  await expect(page.locator(".lesson-sheet audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Close lesson box" }).click();
  await page
    .getByRole("button", { name: "Open lesson box Wrong type" })
    .click();
  await expect(page.locator(".lesson-sheet video")).toHaveCount(0);
  // An invalid object index in a card does not create a pointer line.
  await expect(
    page.locator(".viewer-scene .lesson-lines circle:visible"),
  ).toHaveCount(1);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

test("lesson boxes appear over real MindAR tracking and open on tap", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await seed(
    page,
    robotProject([
      {
        id: "card-1",
        type: "text",
        title: "Robot arm",
        text: "The arm can lift small objects.",
        color: "#f0bf2e",
        position: [2, 2, 0],
        target: { objectId: "robot-1", point: [0, 0.8, 0] },
        visible: true,
      },
      {
        id: "card-2",
        type: "link",
        title: "Robots online",
        text: "",
        color: "#4f86f0",
        position: [-2, 1.6, 0],
        target: null,
        visible: true,
        link: { url: "https://example.com/robots", label: "Visit" },
      },
    ]),
  );
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Publish & share" }).click();
  const link = await page.locator("#share-link").inputValue();
  await page.addInitScript((base) => {
    window.__testStreams = [];
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 720;
        c.height = 960;
        const ctx = c.getContext("2d");
        const image = new Image();
        image.src = `${base}markers/space-explorer.jpg`;
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
  }, appPath);
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto(link);
  await page.reload();
  await page.getByRole("button", { name: "Start AR camera" }).click();
  await expect(page.getByText("Marker found. Hello, wonder!")).toBeVisible({
    timeout: 40000,
  });
  const arCard = page.locator(".ar-card-host .lesson-card", {
    hasText: "Robot arm",
  });
  await expect(arCard).toBeVisible();
  await expect(
    page.locator(".ar-card-host .lesson-lines circle:visible"),
  ).toHaveCount(1);
  await page.screenshot({ path: "tests/ar-lesson-boxes.png" });
  await arCard.click();
  await expect(page.getByRole("dialog", { name: "Robot arm" })).toContainText(
    "The arm can lift small objects.",
  );
  await page.getByRole("button", { name: "Close lesson box" }).click();
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
