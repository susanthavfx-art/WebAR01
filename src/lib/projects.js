import { getAsset, hasAsset, registerSharedModel } from "./assets";
import { validateCards } from "./lesson-cards";
import { validIdleClip, validateActions } from "./model-actions";

export const MAX_OBJECTS = 20;

export const clone = (value) => JSON.parse(JSON.stringify(value));

export function slug(text) {
  return (
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "webar-project"
  );
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function newScene(title = "New model") {
  return {
    version: 2,
    id: crypto.randomUUID(),
    title: String(title || "New model").trim().slice(0, 70) || "New model",
    objects: [],
    cards: [],
    updatedAt: new Date().toISOString(),
  };
}

const number = (v, fallback = 0, min = -10, max = 10) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback;

export function validateScene(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.objects)) {
    throw new Error("Invalid scene data.");
  }
  if (input.objects.length > MAX_OBJECTS) {
    throw new Error(`Keep your scene to ${MAX_OBJECTS} objects.`);
  }
  const candidates = input.objects
    .filter((o) => o && typeof o.assetId === "string")
    .map((object) => {
      if (object.assetId.startsWith("model:") && object.model) {
        const asset = registerSharedModel(object.model);
        if (asset.id !== object.assetId) {
          throw new Error("A model definition does not match its model id.");
        }
        return { ...object, model: asset.model };
      }
      return object;
    });

  const ids = new Set();
  const objects = candidates
    .filter((o) => hasAsset(o.assetId))
    .map((o) => {
      let id =
        typeof o.id === "string" && o.id.length < 80
          ? o.id
          : crypto.randomUUID();
      if (ids.has(id)) id = crypto.randomUUID();
      ids.add(id);
      const asset = getAsset(o.assetId, o.model);
      return {
        id,
        assetId: o.assetId,
        ...(asset.model ? { model: asset.model } : {}),
        name:
          typeof o.name === "string" && o.name.trim()
            ? o.name.slice(0, 35)
            : asset.name,
        position: [0, 1, 2].map((i) =>
          number(o.position?.[i], 0, i === 1 ? 0 : -4, 4),
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
    });

  return {
    version: 2,
    id:
      typeof input.id === "string" && input.id.length < 80
        ? input.id
        : crypto.randomUUID(),
    title:
      typeof input.title === "string"
        ? input.title.trim().slice(0, 70) || "Model scene"
        : "Model scene",
    objects,
    cards: validateCards(input.cards, new Set(objects.map((o) => o.id))),
    updatedAt:
      typeof input.updatedAt === "string" &&
      Number.isFinite(Date.parse(input.updatedAt))
        ? new Date(input.updatedAt).toISOString()
        : new Date().toISOString(),
  };
}
