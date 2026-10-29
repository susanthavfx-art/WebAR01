import { APP_BASE, fragmentParams } from "./deployment";
import LZString from "lz-string";
import {
  ASSETS,
  MARKERS,
  sceneObject,
  getAsset,
  hasAsset,
  registerSharedModel,
  registerCustomMarker,
  isBuiltInMarker,
} from "./assets";
import { decodeCards, encodeCards, validateCards } from "./lesson-cards";
import { fetchLesson, validLessonKey } from "./cloud";
import {
  decodeObjectActions,
  encodeObjectActions,
  validIdleClip,
  validateActions,
} from "./model-actions";

export const STORAGE_KEY = "wonderlab.projects.v1";
export const ACTIVE_KEY = "wonderlab.active.v1";
export const MAX_OBJECTS = 20;
const copy = (value) => JSON.parse(JSON.stringify(value));
export const clone = copy;

export const TEMPLATES = [
  {
    id: "space",
    name: "My space adventure",
    category: "Space & beyond",
    description: "A small step for you. A giant leap for your imagination.",
    color: "#eee9fc",
    asset: "saturn",
    markerId: "space-explorer",
    objects: () => [
      sceneObject("earth", [-0.05, 0.35, 0.9], 1.06, { animation: "spin" }),
      sceneObject("saturn", [1.3, 0.8, -1], 0.9, { rotation: [0, 0, -8] }),
      sceneObject("rocket", [-2.1, 0.38, 1.3], 1.05, {
        rotation: [0, 18, -17],
        animation: "float",
      }),
      sceneObject("moon", [1.65, 0.12, 1.1], 0.5),
      sceneObject("sun", [-1.05, 1.4, -1.4], 0.52),
    ],
  },
  {
    id: "forest",
    name: "My little green world",
    category: "The natural world",
    description: "Plant an idea. Watch a wonderful little world grow.",
    color: "#e9f2e5",
    asset: "tree",
    markerId: "forest-friends",
    objects: () => [
      sceneObject("tree", [-0.75, 0, -0.5], 1.3),
      sceneObject("tree", [1.0, 0, -0.8], 0.8),
      sceneObject("mushroom", [-1.1, 0, 1.1], 0.65),
      sceneObject("flower", [0.65, 0, 0.9], 0.7, { animation: "float" }),
      sceneObject("sun", [0.9, 1.7, -1.5], 0.48),
    ],
  },
  {
    id: "science",
    name: "Hello, future!",
    category: "Science & discovery",
    description:
      "Meet a friendly robot and explore the tiniest building blocks.",
    color: "#e8f1f7",
    asset: "robot",
    markerId: "space-explorer",
    objects: () => [
      sceneObject("robot", [-0.8, 0, 0.55], 1.1, { animation: "float" }),
      sceneObject("atom", [1, 0.4, -0.5], 1.1, { animation: "spin" }),
      sceneObject("rocket", [-1.2, 0, -1.2], 0.6),
    ],
  },
  {
    id: "blank",
    name: "My next big idea",
    category: "Start from scratch",
    description: "An empty canvas. Endless possibilities. All yours.",
    color: "#f8efe2",
    asset: "rocket",
    markerId: "space-explorer",
    objects: () => [],
  },
];

export function newProject(templateId = "blank") {
  const t = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[3];
  return {
    version: 2,
    id: crypto.randomUUID(),
    title: t.name,
    markerId: t.markerId,
    objects: t.objects(),
    cards: [],
    updatedAt: new Date().toISOString(),
  };
}
const number = (v, fallback = 0, min = -10, max = 10) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback;
export function validateProject(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.objects))
    throw new Error("This is not a Wonderlab project file.");
  if (input.objects.length > MAX_OBJECTS)
    throw new Error(
      `Keep your scene to ${MAX_OBJECTS} objects for a smooth mobile experience.`,
    );
  const candidates = input.objects
    .filter((o) => o && typeof o.assetId === "string")
    .map((object) => {
      if (object.assetId.startsWith("model:") && object.model) {
        const asset = registerSharedModel(object.model);
        if (asset.id !== object.assetId)
          throw new Error("A model definition does not match its model id.");
        return { ...object, model: asset.model };
      }
      if (object.assetId.startsWith("model:") && !hasAsset(object.assetId))
        throw new Error(
          "A GLB model definition is missing. Open the latest app and re-export this project.",
        );
      return object;
    });
  const ids = new Set();
  const project = {
    version: 2,
    id:
      typeof input.id === "string" && input.id.length < 80
        ? input.id
        : crypto.randomUUID(),
    title:
      typeof input.title === "string"
        ? input.title.trim().slice(0, 70) || "My new creation"
        : "My new creation",
    markerId: MARKERS[0].id,
    updatedAt:
      typeof input.updatedAt === "string" &&
      Number.isFinite(Date.parse(input.updatedAt))
        ? new Date(input.updatedAt).toISOString()
        : new Date().toISOString(),
    objects: candidates
      .filter((o) => hasAsset(o.assetId))
      .map((o) => {
        let id =
          typeof o.id === "string" && o.id.length < 80
            ? o.id
            : crypto.randomUUID();
        if (ids.has(id)) id = crypto.randomUUID();
        ids.add(id);
        return {
          id,
          assetId: o.assetId,
          ...(getAsset(o.assetId, o.model).model
            ? { model: getAsset(o.assetId, o.model).model }
            : {}),
          name:
            typeof o.name === "string"
              ? o.name.slice(0, 35)
              : getAsset(o.assetId, o.model).name,
          position: [0, 1, 2].map((i) =>
            number(o.position?.[i], 0, i === 1 ? 0 : -4, i === 1 ? 4 : 4),
          ),
          rotation: [0, 1, 2].map((i) => number(o.rotation?.[i], 0, -360, 360)),
          scale: number(o.scale, 1, 0.15, 2.5),
          animation: ["none", "float", "spin"].includes(o.animation)
            ? o.animation
            : "none",
          visible: o.visible !== false,
          ...(typeof o.color === "string" && /^#[0-9a-f]{6}$/i.test(o.color)
            ? { color: o.color }
            : {}),
          ...(validIdleClip(o.idleClip) !== undefined
            ? { idleClip: o.idleClip }
            : {}),
          ...(Array.isArray(o.actions) && o.actions.length
            ? { actions: validateActions(o.actions) }
            : {}),
        };
      }),
  };
  if (isBuiltInMarker(input.markerId)) project.markerId = input.markerId;
  else if (
    input.marker &&
    input.marker.id === String(input.markerId).toLowerCase()
  ) {
    const marker = registerCustomMarker(input.marker);
    if (marker) {
      project.markerId = marker.id;
      project.marker = marker.definition;
    }
  }
  project.cards = validateCards(
    input.cards,
    new Set(project.objects.map((o) => o.id)),
  );
  return project;
}
export function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved))
      return saved.flatMap((project) => {
        try {
          return [validateProject(project)];
        } catch {
          return [];
        }
      });
  } catch {
    /* A corrupt or unavailable store should never prevent opening the editor. */
  }
  return [newProject("space")];
}
export function saveProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch {
    return false;
  }
}
const r = (n) => Math.round(n * 100) / 100;
export function encodeScene(project) {
  const p = validateProject(project),
    definitions = [],
    references = new Map();
  const compact = {
    v: 2,
    n: p.title,
    // Built-in markers keep their old index; library markers travel by id so
    // links survive the owner adding or reordering marker files.
    m: Math.max(
      0,
      Math.min(
        1,
        MARKERS.findIndex((m) => m.id === p.markerId),
      ),
    ),
    ...(MARKERS.findIndex((m) => m.id === p.markerId) > 1
      ? { g: p.markerId }
      : {}),
    ...(p.marker
      ? { k: [p.marker.id, p.marker.name, p.marker.image, p.marker.target] }
      : {}),
    a: definitions,
    o: p.objects.map((o) => {
      const row = [
        o.assetId,
        ...o.position.map(r),
        ...o.rotation.map(r),
        r(o.scale),
        ["none", "float", "spin"].indexOf(o.animation),
        o.visible ? 1 : 0,
        o.name === getAsset(o.assetId, o.model).name ? "" : o.name,
        o.color || "",
      ];
      if (o.model) {
        const key = JSON.stringify(o.model);
        if (!references.has(key)) {
          references.set(key, definitions.length);
          definitions.push(o.model);
        }
        row.push(references.get(key));
      }
      return row;
    }),
  };
  if (p.cards.length) compact.c = encodeCards(p.cards, p.objects);
  const actions = encodeObjectActions(p.objects);
  if (actions.length) compact.x = actions;
  return LZString.compressToEncodedURIComponent(JSON.stringify(compact));
}
export function decodeScene(encoded) {
  if (!encoded || encoded.length > 40000)
    throw new Error("This project link is missing or too large.");
  const raw = LZString.decompressFromEncodedURIComponent(encoded);
  if (!raw || raw.length > 90000)
    throw new Error("This project link could not be read.");
  const data = JSON.parse(raw);
  if (![1, 2].includes(data.v) || !Array.isArray(data.o))
    throw new Error("This project link uses an unsupported format.");
  const definitions = [],
    unique = new Set();
  if (data.v === 2) {
    if (
      data.a !== undefined &&
      (!Array.isArray(data.a) || data.a.length > MAX_OBJECTS)
    )
      throw new Error("Too many model definitions in this project link.");
    for (const definition of data.a || []) {
      const asset = registerSharedModel(definition),
        key = JSON.stringify(asset.model);
      if (unique.has(key))
        throw new Error("Duplicate model definitions in this project link.");
      unique.add(key);
      definitions.push(asset);
    }
  }
  if (data.o.length > MAX_OBJECTS)
    throw new Error("This project link has too many objects.");
  const objectIds = data.o.map(() => crypto.randomUUID());
  return validateProject({
    title: data.n,
    markerId: Array.isArray(data.k)
      ? data.k[0]
      : typeof data.g === "string" && MARKERS.some((m) => m.id === data.g)
        ? data.g
        : MARKERS[data.m]?.id,
    ...(Array.isArray(data.k)
      ? {
          marker: {
            id: data.k[0],
            name: data.k[1],
            image: data.k[2],
            target: data.k[3],
          },
        }
      : {}),
    cards: decodeCards(data.c, objectIds),
    objects: decodeObjectActions(
      data.x,
      data.o.map((row, index) => {
        if (!Array.isArray(row))
          throw new Error("A scene object could not be read.");
        const id =
          data.v === 1
            ? Number.isInteger(row[0]) && row[0] >= 0 && row[0] < 12
              ? ASSETS[row[0]]?.id
              : undefined
            : row[0];
        let definition;
        if (data.v === 2 && row[12] !== undefined) {
          if (
            !Number.isInteger(row[12]) ||
            !definitions[row[12]] ||
            definitions[row[12]].id !== id
          )
            throw new Error(
              "A model reference in this project link is invalid.",
            );
          definition = definitions[row[12]].model;
        } else if (data.v === 2) {
          const matches = definitions.filter((asset) => asset.id === id);
          if (matches.length > 1)
            throw new Error(
              "A model reference in this project link is ambiguous.",
            );
          definition = matches[0]?.model;
        }
        const asset = hasAsset(id) ? getAsset(id, definition) : null;
        return {
          id: objectIds[index],
          assetId: id,
          ...(asset?.model ? { model: asset.model } : {}),
          position: row.slice(1, 4),
          rotation: row.slice(4, 7),
          scale: row[7],
          animation: ["none", "float", "spin"][row[8]],
          visible: row[9] !== 0,
          name: row[10] || asset?.name,
          color: row[11],
        };
      }),
    ),
  });
}
// Short lesson links load a published snapshot from the optional cloud store.
export async function loadProjectFromLocation() {
  const lesson = fragmentParams().get("lesson");
  if (lesson) {
    if (!validLessonKey(lesson))
      throw new Error("This lesson link is not valid. Ask for a new link.");
    return { project: validateProject(await fetchLesson(lesson)), lesson };
  }
  return { project: projectFromLocation(), lesson: "" };
}
export function projectFromLocation() {
  const encoded = fragmentParams().get("scene");
  if (!encoded)
    throw new Error(
      "No project was included in this link. Ask your creator for a new share link.",
    );
  return decodeScene(encoded);
}
export function shareUrl(project, page = "view", lesson = "") {
  const url = new URL(APP_BASE, window.location.origin);
  url.hash = new URLSearchParams({
    page: page === "print" ? "print" : "view",
    ...(lesson ? { lesson } : { scene: encodeScene(project) }),
  }).toString();
  return url.toString();
}
export function downloadProject(project) {
  const blob = new Blob([JSON.stringify(validateProject(project), null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${slug(project.title)}.wonderlab.json`);
}
export function slug(title) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "my-creation"
  );
}
export function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
