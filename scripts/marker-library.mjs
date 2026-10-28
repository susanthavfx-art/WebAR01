// Builds markers/index.json from the image + .mind pairs in public/markers.
// Owners only upload e.g. Stegosaurus.jpg and Stegosaurus.mind; the marker
// then appears in the Markers library after the next GitHub Pages build.
// Optional public/markers/markers.json can set a nicer name, subtitle, colour
// or order: { "markers": [ { "file": "Stegosaurus", "name": "Stegosaurus",
// "subtitle": "Dinosaur world", "order": 1 } ] }
import fs from "node:fs";
import path from "node:path";

const BUILT_IN = new Set(["space-explorer", "forest-friends"]);
const IMAGE = /\.(jpe?g|png|webp)$/i;
const SAFE_FILE = /^[\w .()-]{1,120}$/;

const text = (value, limit) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
const prettify = (base) =>
  base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 40);
const stem = (file) => file.slice(0, file.lastIndexOf("."));

export function scanMarkers(root = process.cwd(), log = console) {
  const dir = path.join(root, "public", "markers");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  const meta = new Map();
  if (files.includes("markers.json")) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, "markers.json"), "utf8"));
      for (const m of Array.isArray(data?.markers) ? data.markers : [])
        if (m && typeof m.file === "string")
          meta.set(m.file.replace(/\.(jpe?g|png|webp|mind)$/i, "").toLowerCase(), m);
    } catch (error) {
      log.warn?.(`[markers] public/markers/markers.json ignored: ${error.message}`);
    }
  }
  const markers = [];
  for (const target of files) {
    if (!/\.mind$/i.test(target)) continue;
    const base = stem(target);
    const image = files.find((f) => IMAGE.test(f) && stem(f) === base);
    if (!SAFE_FILE.test(target) || (image && !SAFE_FILE.test(image))) {
      log.warn?.(`[markers] ${target}: use only letters, numbers, spaces, - and _ in marker file names.`);
      continue;
    }
    if (!image) {
      log.warn?.(`[markers] ${target} has no matching ${base}.jpg / .png image, so it is not shown.`);
      continue;
    }
    const id = base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    if (!id || BUILT_IN.has(id) || markers.some((m) => m.id === id)) continue;
    const info = meta.get(base.toLowerCase()) || {};
    markers.push({
      id,
      name: text(info.name, 40) || prettify(base),
      subtitle: text(info.subtitle, 60) || "From the marker library",
      image,
      target,
      color:
        typeof info.color === "string" && /^#[0-9a-f]{6}$/i.test(info.color)
          ? info.color
          : "#f1ece4",
      order: Number.isFinite(info.order) ? info.order : 1000,
    });
  }
  markers.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return { version: 1, markers: markers.map(({ order, ...m }) => m) };
}

export default function markerLibrary() {
  let root = process.cwd();
  return {
    name: "wonderlab-marker-library",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split("?")[0].endsWith("/markers/index.json")) return next();
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(scanMarkers(root)));
      });
    },
    generateBundle() {
      const library = scanMarkers(root, this);
      this.emitFile({
        type: "asset",
        fileName: "markers/index.json",
        source: JSON.stringify(library, null, 2),
      });
    },
  };
}
