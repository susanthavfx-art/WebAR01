import { test, expect } from "@playwright/test";
import {
  CLOUD_URL,
  TEACHER_EMAIL,
  TEACHER_ID,
  createCloudStore,
  useFakeCloud,
} from "./helpers/fake-cloud.mjs";

const appPath = process.env.APP_BASE_PATH || "/";
const key = "wonderlab.projects.v1";
const photo = "tests/fixtures/marker-photo.jpg";
const plain = "tests/fixtures/plain-photo.png";
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};
const robot = (id, title, extra = {}) => ({
  version: 2,
  id,
  title,
  markerId: "space-explorer",
  objects: [
    {
      id: `${id}-robot`,
      assetId: "robot",
      name: "Robot",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1.2,
      animation: "none",
      visible: true,
    },
  ],
  cards: [],
  updatedAt: new Date().toISOString(),
  ...extra,
});
async function seed(target, projects, extra = {}) {
  await target.addInitScript(
    ({ key, projects, extra }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(key, JSON.stringify(projects));
      localStorage.setItem("wonderlab.active.v1", projects[0].id);
      for (const [k, v] of Object.entries(extra))
        localStorage.setItem(k, JSON.stringify(v));
    },
    { key, projects, extra },
  );
}
async function syntheticCamera(page, imageUrl) {
  await page.addInitScript((src) => {
    window.__testStreams = [];
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        const c = document.createElement("canvas");
        c.width = 720;
        c.height = 960;
        const ctx = c.getContext("2d");
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = src;
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
  }, imageUrl);
}

test("teacher makes a marker from a photo and text, saves it, and students track it", async ({
  page,
  context,
}) => {
  test.setTimeout(180000);
  const errors = errorsFor(page);
  const store = createCloudStore();
  store.folders = ["audio", "video", "lessons"]; // storage not upgraded yet
  await useFakeCloud(context, store);
  await seed(page, [robot("p1", "Solar lesson")]);
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  await page.getByRole("button", { name: "Create your own marker" }).click();
  await expect(
    page.getByRole("heading", { name: "Make a marker" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check tracking" }),
  ).toBeDisabled();

  await page.getByLabel("Marker photo file").setInputFiles(photo);
  await expect(page.getByText("marker-photo.jpg")).toBeVisible();
  await page.getByLabel("Marker text").fill("Our Solar System");
  await page.getByRole("radio", { name: "Top" }).click();
  await page.getByRole("radio", { name: "Yellow text band" }).click();
  await page.getByRole("radio", { name: "Purple frame" }).click();
  await page.getByLabel("Photo zoom").fill("1.3");
  // Drag the photo inside the preview.
  const box = await page.getByTestId("marker-canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2);
  await page.mouse.up();
  expect(
    Number(await page.getByLabel("Photo left and right").inputValue()),
  ).toBeGreaterThan(0);
  await page.getByLabel("Marker name").fill("Grade 5 planets");

  await page.getByRole("button", { name: "Check tracking" }).click();
  await expect(
    page.getByText(/Checking how phones see your marker/),
  ).toBeVisible();
  const quality = page.locator(".mm-quality");
  await expect(quality).toBeVisible({ timeout: 90000 });
  expect(["great", "good"]).toContain(
    await quality.getAttribute("data-quality"),
  );
  await page.screenshot({ path: "tests/marker-maker.png" });

  // Saving needs a teacher account.
  await page
    .getByRole("button", { name: "Sign in to save this marker" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Teacher sign-in" });
  await dialog.getByLabel("TEACHER EMAIL").fill(TEACHER_EMAIL);
  await dialog.getByRole("button", { name: "Email me a code" }).click();
  await dialog.getByLabel("SIGN-IN CODE").fill("123456");
  await dialog.getByRole("button", { name: "Sign in" }).click();
  await expect(dialog).toHaveCount(0);

  // The owner has not run the marker storage update yet.
  await page
    .getByRole("button", { name: "Save & use in this project" })
    .click();
  await expect(page.getByRole("alert")).toContainText("MARKER-MAKER.md");
  store.folders.push("markers");
  await page
    .getByRole("button", { name: "Save & use in this project" })
    .click();
  await expect(page.getByText("Grade 5 planets is ready")).toBeVisible({
    timeout: 20000,
  });

  const files = [...store.files.entries()].filter(([p]) =>
    p.startsWith(`${TEACHER_ID}/markers/`),
  );
  expect(files.map(([p, f]) => [p.split(".").pop(), f.type]).sort()).toEqual([
    ["jpg", "image/jpeg"],
    ["mind", "application/octet-stream"],
  ]);
  const jpg = files.find(([p]) => p.endsWith(".jpg"))[1].body;
  expect(jpg.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  expect(
    files.find(([p]) => p.endsWith(".mind"))[1].body.length,
  ).toBeGreaterThan(100000);
  const imageUrl = `${CLOUD_URL}/storage/v1/object/public/lesson-media/${files.find(([p]) => p.endsWith(".jpg"))[0]}`;

  // Back in the editor, the project uses the new marker.
  await expect(page.locator(".project-subject")).toContainText(
    "Grade 5 planets",
  );
  const myMarkers = page.getByLabel("My markers");
  await expect(
    myMarkers.getByRole("button", { name: "Use Grade 5 planets marker" }),
  ).toBeVisible();
  await expect(myMarkers.locator(".marker-card.active img")).toHaveAttribute(
    "src",
    imageUrl,
  );
  const savedList = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wonderlab.markers.v1")),
  );
  expect(savedList).toHaveLength(1);
  expect(savedList[0].id).toMatch(/^custom:/);

  // Publish a short lesson link and print the matching sheet.
  await page.getByRole("button", { name: "Publish & share" }).click();
  await expect(page.locator("#share-link")).toHaveValue(/lesson=/);
  const link = await page.locator("#share-link").inputValue();
  expect(link).toContain("lesson=");
  await expect(page.getByAltText("Selected tracking marker")).toHaveAttribute(
    "src",
    imageUrl,
  );
  await page.getByRole("button", { name: "Get my printable marker" }).click();
  await expect(page.locator(".sheet-marker")).toHaveAttribute("src", imageUrl);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download marker PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

  // A student's phone sees the printed custom marker.
  await syntheticCamera(page, imageUrl);
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto(link);
  await page.reload();
  await expect(
    page.getByAltText("Grade 5 planets tracking marker"),
  ).toHaveAttribute("src", imageUrl);
  await page.getByRole("button", { name: "Start AR camera" }).click();
  await expect(page.getByText("Marker found. Hello, wonder!")).toBeVisible({
    timeout: 60000,
  });
  await page.screenshot({ path: "tests/ar-custom-marker.png" });
  await page.getByRole("button", { name: "Stop camera and go back" }).click();
  expect(
    await page.evaluate(() =>
      window.__testStreams.flatMap((s) =>
        s.getTracks().map((t) => t.readyState),
      ),
    ),
  ).toEqual(["ended"]);
  expect(errors).toEqual([]);
});

test("plain photos are rejected and saving explains when online storage is off", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = errorsFor(page);
  await seed(page, [robot("p1", "Plain test")]);
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  await page.getByRole("button", { name: "Create your own marker" }).click();
  await page.getByLabel("Marker photo file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await expect(page.getByRole("alert")).toContainText("JPG, PNG or WebP");
  await page.getByLabel("Marker photo file").setInputFiles(plain);
  await page.getByLabel("Marker text").fill("Hello");
  await page.getByRole("button", { name: "Check tracking" }).click();
  const quality = page.locator(".mm-quality");
  await expect(quality).toHaveAttribute("data-quality", "poor", {
    timeout: 60000,
  });
  await expect(quality).toContainText("Too little detail to track");
  await expect(page.getByRole("button", { name: /Save & use/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try another photo" }),
  ).toBeVisible();

  await page.getByLabel("Marker photo file").setInputFiles(photo);
  await expect(quality).toHaveCount(0);
  await page.getByRole("button", { name: "Check tracking" }).click();
  await expect(quality).toBeVisible({ timeout: 90000 });
  expect(["great", "good"]).toContain(
    await quality.getAttribute("data-quality"),
  );
  // Changing the design means the check must run again.
  await page.getByRole("radio", { name: "Dark frame" }).click();
  await expect(quality).toHaveCount(0);
  await page.getByRole("button", { name: "Check tracking" }).click();
  await expect(quality).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByText("Saving markers needs online storage"),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download picture" }).click();
  expect((await download).suggestedFilename()).toBe("hello.jpg");

  await page.getByRole("button", { name: "Back to editor" }).click();
  await expect(page.locator(".project-subject")).toContainText(
    "Space explorer",
  );
  expect(errors).toEqual([]);
});

test("each project keeps its own marker and share links carry custom markers", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const errors = errorsFor(page);
  const markerA = {
    id: "custom:2f1d8c3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    name: "Forest walk",
    image: `${CLOUD_URL}/storage/v1/object/public/lesson-media/${TEACHER_ID}/markers/a.jpg`,
    target: `${CLOUD_URL}/storage/v1/object/public/lesson-media/${TEACHER_ID}/markers/a.mind`,
  };
  const markerB = {
    ...markerA,
    id: "custom:9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
    name: "Space trip",
  };
  const store = createCloudStore();
  const fs = await import("node:fs");
  const jpg = fs.readFileSync("public/markers/forest-friends.jpg");
  store.files.set(`${TEACHER_ID}/markers/a.jpg`, {
    type: "image/jpeg",
    body: jpg,
  });
  await useFakeCloud(context, store);
  await seed(
    page,
    [
      robot("p1", "Forest lesson", { markerId: markerA.id, marker: markerA }),
      robot("p2", "Space lesson", { markerId: markerB.id, marker: markerB }),
      robot("p3", "Built-in lesson", { markerId: "forest-friends" }),
      robot("p4", "Broken marker", {
        markerId: "custom:not-a-real-id",
        marker: { ...markerA, id: "custom:not-a-real-id" },
      }),
      robot("p5", "Unsafe marker", {
        markerId: markerB.id.replace("9a", "8a"),
        marker: {
          ...markerB,
          id: markerB.id.replace("9a", "8a"),
          image: "javascript:alert(1)",
        },
      }),
    ],
    { "wonderlab.markers.v1": [markerB, { id: "bad" }] },
  );
  await page.goto(`${appPath}?studio=1`);
  await expect(page.locator(".project-subject")).toContainText("Forest walk");
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  const mine = page.getByLabel("My markers");
  // The current project's marker shows even when it is not in "My markers".
  await expect(mine.locator(".marker-card")).toHaveCount(2);
  await expect(
    mine.getByRole("button", { name: "Remove Forest walk from my markers" }),
  ).toHaveCount(0);

  // Signed out, the scene link carries the marker definition (URLs only).
  await page.getByRole("button", { name: "Publish & share" }).click();
  const link = await page.locator("#share-link").inputValue();
  expect(link).toContain("scene=");
  expect(link.length).toBeLessThan(2000);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "My projects", exact: true }).click();
  for (const [title, label] of [
    ["Space lesson", "Space trip"],
    ["Built-in lesson", "Forest friends"],
    ["Broken marker", "Space explorer"],
    ["Unsafe marker", "Space explorer"],
  ]) {
    await expect(
      page.locator(".project-card", { hasText: title }),
    ).toContainText(label);
  }
  await page
    .locator(".project-card", { hasText: "Space lesson" })
    .getByRole("button", { name: "Open Space lesson" })
    .click();
  await expect(page.locator(".project-subject")).toContainText("Space trip");
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  await mine
    .getByRole("button", { name: "Remove Space trip from my markers" })
    .click();
  await expect(
    page.getByText("Projects and printed sheets that use it keep working"),
  ).toBeVisible();
  // Still used by this project, so it stays visible without a remove button.
  await expect(
    mine.getByRole("button", { name: "Use Space trip marker" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Forest friends Let your ideas grow wild" })
    .click();
  await expect(page.locator(".project-subject")).toContainText(
    "Forest friends",
  );
  await expect(page.getByLabel("My markers")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("wonderlab.markers.v1")),
    ),
  ).toEqual([]);

  // A student opening the scene link sees the custom marker.
  const student = await context.newPage();
  await student.goto(link);
  await expect(
    student.getByAltText("Forest walk tracking marker"),
  ).toHaveAttribute("src", markerA.image);
  expect(errors).toEqual([]);
});
