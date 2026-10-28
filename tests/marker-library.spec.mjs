import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import LZString from "lz-string";
import { scanMarkers } from "../scripts/marker-library.mjs";

const appPath = process.env.APP_BASE_PATH || "/";
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

test("build scan lists image + .mind pairs from public/markers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "markers-"));
  const dir = path.join(root, "public", "markers");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of [
    "space-explorer.jpg",
    "space-explorer.mind",
    "Stegosaurus.jpg",
    "Stegosaurus.mind",
    "T_Rex-world.png",
    "T_Rex-world.mind",
    "lonely.mind",
    "photo-only.jpg",
  ])
    fs.writeFileSync(path.join(dir, f), "x");
  fs.writeFileSync(
    path.join(dir, "markers.json"),
    JSON.stringify({
      markers: [
        { file: "T_Rex-world.png", name: "T. rex world", subtitle: "Roar!", order: 1 },
      ],
    }),
  );
  const warnings = [];
  const result = scanMarkers(root, { warn: (m) => warnings.push(m) });
  expect(result.markers).toEqual([
    {
      id: "t-rex-world",
      name: "T. rex world",
      subtitle: "Roar!",
      image: "T_Rex-world.png",
      target: "T_Rex-world.mind",
      color: "#f1ece4",
    },
    {
      id: "stegosaurus",
      name: "Stegosaurus",
      subtitle: "From the marker library",
      image: "Stegosaurus.jpg",
      target: "Stegosaurus.mind",
      color: "#f1ece4",
    },
  ]);
  expect(warnings.join("\n")).toContain("lonely.mind has no matching");
});

const built = JSON.parse(
  fs.existsSync("site/markers/index.json")
    ? fs.readFileSync("site/markers/index.json", "utf8")
    : '{"markers":[]}',
);
const libraryMarker = built.markers[0];

test("an uploaded library marker shows in the Markers tab, travels in links and is detected by real MindAR", async ({
  page,
}) => {
  test.skip(!libraryMarker, "No extra markers in public/markers");
  const errors = errorsFor(page);
  await page.goto(`${appPath}?studio=1`);
  await page.getByRole("button", { name: "Markers", exact: true }).click();
  const card = page.getByRole("button", {
    name: `${libraryMarker.name} ${libraryMarker.subtitle}`,
  });
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveJSProperty("complete", true);
  expect(
    await card.locator("img").evaluate((img) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await card.click();
  await page.getByRole("button", { name: "Publish & share" }).click();
  const link = await page.locator("#share-link").inputValue();
  const data = JSON.parse(
    LZString.decompressFromEncodedURIComponent(
      new URLSearchParams(new URL(link).hash.slice(1)).get("scene"),
    ),
  );
  expect(data.g).toBe(libraryMarker.id);
  await page.addInitScript(
    ({ file, base }) => {
      window.__testStreams = [];
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const c = document.createElement("canvas");
          c.width = 720;
          c.height = 960;
          const ctx = c.getContext("2d");
          const image = new Image();
          image.src = `${base}markers/${encodeURIComponent(file)}`;
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
            .forEach((t) => t.addEventListener("ended", () => clearInterval(timer)));
          window.__testStreams.push(stream);
          return stream;
        },
      });
    },
    { file: libraryMarker.image, base: appPath },
  );
  await page.setViewportSize({ width: 430, height: 900 });
  await page.goto(link);
  await page.reload();
  await expect(
    page.getByAltText(`${libraryMarker.name} tracking marker`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start AR camera" }).click();
  await expect(page.getByText("Marker found. Hello, wonder!")).toBeVisible({
    timeout: 40000,
  });
  await page.screenshot({ path: `tests/ar-library-marker.png` });
  await page.getByRole("button", { name: "Stop camera and go back" }).click();
  expect(errors).toEqual([]);
});
