// AR Portal Workshop — configuration, catalogues and small helpers.
//
// A "portal" is a doorway that stands on a printed marker. Everything is drawn
// by the app itself (no assets to upload apart from the marker image), so the
// same builder powers the live 3D preview in the browser and the MindAR camera
// session on a phone.
import { publicUrl } from "./deployment";
import { resolveResourceUrl } from "./local-files";

export const PORTAL_VERSION = 1;
export const PORTAL_STORAGE_KEY = "wonderlab.portal.v1";

export const PORTAL_WORLDS = [
  {
    id: "aurora",
    name: "Aurora valley",
    blurb: "Northern lights over a frozen lake",
    palette: ["#0b1030", "#26246b", "#3f7bd6", "#8ef0c9"],
    accent: "#8ef0c9",
  },
  {
    id: "jungle",
    name: "Hidden jungle",
    blurb: "Sunbeams through ancient leaves",
    palette: ["#06180f", "#0f3a22", "#2f7d46", "#f4dd7a"],
    accent: "#f4dd7a",
  },
  {
    id: "cosmos",
    name: "Deep space",
    blurb: "A purple nebula and two moons",
    palette: ["#07030f", "#231045", "#6b3fb0", "#ffb0e6"],
    accent: "#ffb0e6",
  },
  {
    id: "sunset",
    name: "Sunset dunes",
    blurb: "Warm desert light, endless horizon",
    palette: ["#2a0d1c", "#7d2433", "#e2703a", "#ffd9a0"],
    accent: "#ffd9a0",
  },
  {
    id: "candy",
    name: "Cloud candy",
    blurb: "Soft pastel clouds for little worlds",
    palette: ["#2b2450", "#6f5bd0", "#c79cf5", "#ffe6f2"],
    accent: "#ffe6f2",
  },
];

export const PORTAL_STYLES = [
  {
    id: "runes",
    name: "Sunken runes",
    blurb: "Stone arch with glowing script",
    frame: "#6f6455",
    trim: "#d9b36a",
    glow: "#ffd9a0",
  },
  {
    id: "crystal",
    name: "Crystal gate",
    blurb: "Faceted shards and violet light",
    frame: "#5b4a86",
    trim: "#c9b6ff",
    glow: "#b18cff",
  },
  {
    id: "jungle",
    name: "Jungle arch",
    blurb: "Vines and moss over old wood",
    frame: "#4d5f3a",
    trim: "#a8c96a",
    glow: "#d6f5a2",
  },
  {
    id: "neon",
    name: "Neon ring",
    blurb: "Clean futuristic light tube",
    frame: "#2c2b3c",
    trim: "#7bf1ff",
    glow: "#7bf1ff",
  },
];

// The demo set that ships in public/published — handy for trying the workshop.
export const DEMO_PORTAL = {
  marker:
    "published/28e2ee39-2531-411d-8a06-e615565468bb/files/e00170cd-6da3-4da1-b77d-8b9f7283feff.jpg",
  tracker:
    "published/28e2ee39-2531-411d-8a06-e615565468bb/files/48aa4d84-64e2-48d3-9362-202723be7f4c.mind",
  trackerIndex: 0,
  name: "Ankylosaurus portal",
};

export const PORTAL_RESIDENTS = [
  { id: "none", name: "Nothing" },
  { id: "prim:crystal", name: "Crystal" },
  { id: "prim:planet", name: "Planet" },
  { id: "prim:tree", name: "Tree" },
  { id: "prim:rocket", name: "Rocket" },
  { id: "prim:robot", name: "Robot" },
  { id: "prim:ufo", name: "UFO" },
  { id: "prim:flower", name: "Flower" },
];

const SHAPE_IDS = new Set([
  "prim:crystal",
  "prim:planet",
  "prim:tree",
  "prim:rocket",
  "prim:robot",
  "prim:ufo",
  "prim:flower",
]);
export const residentShapeId = (id) =>
  SHAPE_IDS.has(String(id || "")) ? id : "";

export const DEFAULT_PORTAL = {
  version: PORTAL_VERSION,
  name: "My portal",
  marker: "",
  tracker: "",
  trackerIndex: 0,
  style: "runes",
  world: "aurora",
  width: 0.86,
  height: 1.2,
  depth: 0.7,
  glow: 0.75,
  sparkles: true,
  resident: "prim:crystal",
  flip: false,
};

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const pick = (list, value, fallback) =>
  list.some((item) => item.id === value) ? value : fallback;

export function normalisePortal(input = {}) {
  const base = { ...DEFAULT_PORTAL, ...(input || {}) };
  return {
    version: PORTAL_VERSION,
    name: String(base.name || DEFAULT_PORTAL.name).slice(0, 60),
    marker: typeof base.marker === "string" ? base.marker.slice(0, 1200) : "",
    tracker:
      typeof base.tracker === "string" ? base.tracker.slice(0, 1200) : "",
    trackerIndex: Math.round(clamp(base.trackerIndex, 0, 99, 0)),
    style: pick(PORTAL_STYLES, base.style, DEFAULT_PORTAL.style),
    world: pick(PORTAL_WORLDS, base.world, DEFAULT_PORTAL.world),
    width: clamp(base.width, 0.35, 1, DEFAULT_PORTAL.width),
    height: clamp(base.height, 0.4, 1.6, DEFAULT_PORTAL.height),
    depth: clamp(base.depth, 0.2, 1.6, DEFAULT_PORTAL.depth),
    glow: clamp(base.glow, 0, 1, DEFAULT_PORTAL.glow),
    sparkles: base.sparkles !== false,
    resident: PORTAL_RESIDENTS.some((item) => item.id === base.resident)
      ? base.resident
      : "none",
    flip: base.flip === true,
  };
}

export const portalStyle = (id) =>
  PORTAL_STYLES.find((style) => style.id === id) || PORTAL_STYLES[0];
export const portalWorld = (id) =>
  PORTAL_WORLDS.find((world) => world.id === id) || PORTAL_WORLDS[0];

// ---------------------------------------------------------------------------
// Marker geometry
// ---------------------------------------------------------------------------
// MindAR normalises a tracking image so that it is one unit wide, with the
// height following the image's own aspect ratio. Anything we place on the card
// therefore lives in these units.
export function markerSpace(width, height) {
  const w = Number(width) || 1;
  const h = Number(height) || 1;
  return { width: 1, height: h / w, aspect: w / h };
}

export function markerUrl(portal) {
  return portal?.marker ? resolveResourceUrl(portal.marker) : "";
}

// ---------------------------------------------------------------------------
// Marker image checker — print quality decides whether tracking works at all.
// ---------------------------------------------------------------------------
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error("No marker image yet."));
      return;
    }
    const image = new Image();
    if (!/^blob:|^data:/.test(url)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "That marker image could not be opened. Use a JPG, PNG or WebP photo.",
        ),
      );
    image.src = url;
  });
}

export async function analyseMarker(url) {
  const image = await loadImage(url);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const sample = 240;
  const scale = Math.min(1, sample / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.round(width * scale));
  canvas.height = Math.max(8, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

  const luma = new Float32Array(canvas.width * canvas.height);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const y =
      (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    luma[p] = y;
    sum += y;
  }
  const mean = sum / luma.length;
  let variance = 0;
  for (let i = 0; i < luma.length; i += 1) variance += (luma[i] - mean) ** 2;
  const contrast = Math.min(1, Math.sqrt(variance / luma.length) / 0.24);

  let edges = 0;
  const w = canvas.width;
  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const gx = Math.abs(luma[i + 1] - luma[i - 1]);
      const gy = Math.abs(luma[i + w] - luma[i - w]);
      if (gx + gy > 0.16) edges += 1;
    }
  }
  const detail = Math.min(1, edges / (luma.length * 0.16));
  const pixels = Math.min(1, Math.min(width, height) / 900);
  const score = Math.round(
    (contrast * 0.34 + detail * 0.38 + pixels * 0.28) * 100,
  );

  const tips = [];
  if (Math.min(width, height) < 700)
    tips.push(
      "Use a bigger image — at least 1000 × 1000 px tracks far better.",
    );
  if (contrast < 0.45)
    tips.push(
      "The picture is flat. Pick artwork with strong light/dark areas.",
    );
  if (detail < 0.3)
    tips.push(
      "Add busy detail — plain areas give the tracker nothing to lock on.",
    );
  if (!tips.length)
    tips.push("Great marker: plenty of contrast, detail and resolution.");

  return {
    width,
    height,
    aspect: width / height,
    contrast,
    detail,
    score,
    rating: score >= 68 ? "strong" : score >= 48 ? "ok" : "weak",
    tips,
    image,
  };
}

// ---------------------------------------------------------------------------
// Shareable links
// ---------------------------------------------------------------------------
export function portalParams(portal) {
  const p = normalisePortal(portal);
  const params = { page: "portal" };
  if (p.marker) params.m = p.marker;
  if (p.tracker) params.tg = p.tracker;
  if (p.trackerIndex) params.ti = String(p.trackerIndex);
  if (p.name !== DEFAULT_PORTAL.name) params.n = p.name;
  if (p.style !== DEFAULT_PORTAL.style) params.s = p.style;
  if (p.world !== DEFAULT_PORTAL.world) params.w = p.world;
  if (p.width !== DEFAULT_PORTAL.width) params.gw = p.width.toFixed(2);
  if (p.height !== DEFAULT_PORTAL.height) params.gh = p.height.toFixed(2);
  if (p.depth !== DEFAULT_PORTAL.depth) params.d = p.depth.toFixed(2);
  if (p.glow !== DEFAULT_PORTAL.glow) params.gl = p.glow.toFixed(2);
  if (!p.sparkles) params.sp = "0";
  if (p.resident !== DEFAULT_PORTAL.resident) params.r = p.resident;
  if (p.flip) params.f = "1";
  return params;
}

export function portalUrl(portal, { base } = {}) {
  const url = new URL(base || publicUrl(""), window.location.origin);
  url.hash = new URLSearchParams(portalParams(portal)).toString();
  return url.href;
}

export function portalFromParams(params) {
  return normalisePortal({
    marker: params.get("m") || "",
    tracker: params.get("tg") || "",
    trackerIndex: params.get("ti") ?? 0,
    name: params.get("n") || DEFAULT_PORTAL.name,
    style: params.get("s") || DEFAULT_PORTAL.style,
    world: params.get("w") || DEFAULT_PORTAL.world,
    width: params.get("gw") ?? DEFAULT_PORTAL.width,
    height: params.get("gh") ?? DEFAULT_PORTAL.height,
    depth: params.get("d") ?? DEFAULT_PORTAL.depth,
    glow: params.get("gl") ?? DEFAULT_PORTAL.glow,
    sparkles: params.get("sp") !== "0",
    resident: params.get("r") || DEFAULT_PORTAL.resident,
    flip: params.get("f") === "1",
  });
}

export function readPortalFromLocation() {
  return portalFromParams(
    new URLSearchParams(window.location.hash.replace(/^#/, "")),
  );
}

export function savePortal(portal) {
  try {
    window.localStorage.setItem(
      PORTAL_STORAGE_KEY,
      JSON.stringify(normalisePortal(portal)),
    );
  } catch {
    /* storage is optional */
  }
}

export function loadSavedPortal() {
  try {
    const raw = window.localStorage.getItem(PORTAL_STORAGE_KEY);
    return raw ? normalisePortal(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// "Start from a published marker" — read the Publish & share link format
// (#page=collection&p=<uuid>) and pull the first card's marker image.
// ---------------------------------------------------------------------------
export const PUBLISHED_UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export async function portalFromPublishedLink(text) {
  const value = String(text || "").trim();
  if (!value)
    throw new Error("Paste the link from your Publish & share QR first.");
  const id = PUBLISHED_UUID.exec(value)?.[0];
  if (!id)
    throw new Error(
      "That does not look like a published link. It contains an id like 28e2ee39-2531-411d-8a06-e615565468bb.",
    );
  let response;
  try {
    response = await fetch(publicUrl(`published/${id}/manifest.json`), {
      cache: "no-cache",
    });
  } catch {
    throw new Error(
      "Could not reach that published set. Check your connection.",
    );
  }
  if (
    !response.ok ||
    (response.headers.get("content-type") || "").includes("text/html")
  )
    throw new Error(
      "That published set is not online at this address yet — deploy the publish ZIP first.",
    );
  const manifest = await response.json();
  const card = Array.isArray(manifest?.cards) ? manifest.cards[0] : null;
  const marker = card?.marker;
  const tracker = manifest?.target || card?.target || "";
  if (!marker || !PUBLISHED_UUID.test(String(marker).split("/")[2] || ""))
    throw new Error("This published set does not include a marker image.");
  if (!resolveResourceUrl(marker))
    throw new Error("That marker image is not available on this device.");
  if (!tracker || !resolveResourceUrl(tracker))
    throw new Error(
      "This published set is missing its compiled .mind tracker.",
    );
  return normalisePortal({
    ...DEFAULT_PORTAL,
    name: card?.title ? `${card.title} portal` : DEFAULT_PORTAL.name,
    marker,
    tracker,
    trackerIndex: Number.isInteger(card?.targetIndex) ? card.targetIndex : 0,
  });
}

// What still stands between the user and a working portal?
export function portalGaps(portal) {
  const gaps = [];
  if (!portal?.marker) gaps.push("Choose the marker image you will print.");
  if (!portal?.tracker)
    gaps.push(
      "Add its .mind tracker — import a published set, or upload the .mind file compiled for this marker.",
    );
  return gaps;
}

// Small helper so the preview can label itself with the card size.
export function formatMarkerSize(width, height) {
  if (!width || !height) return "";
  return `${width} × ${height} px`;
}
