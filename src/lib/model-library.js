import * as THREE from "three";
import { applyIdleClip } from "./model-actions";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { publicUrl } from "./deployment";
import { resolveModelFile } from "./local-files";

export const MODEL_STATUS_EVENT = "wonderlab:model-status";
export const catalogue = {
  loaded: false,
  warnings: [],
  count: 0,
  repository: "",
};
const requests = new Map();
const statuses = new Map();
let loader;
const queue = [];
let activeLoads = 0;
function schedule(load) {
  return new Promise((resolve, reject) => {
    const next = () => {
      activeLoads++;
      load()
        .then(resolve, reject)
        .finally(() => {
          activeLoads--;
          queue.shift()?.();
        });
    };
    if (activeLoads < 2) next();
    else queue.push(next);
  });
}
const MAX_BYTES = 40 * 1024 * 1024;

function relativeFile(value, extensions, required = true) {
  if (!value && !required) return "";
  if (typeof value !== "string" || value.length > 180)
    throw new Error("Use a relative model filename, for example lion.glb.");
  const parts = value.trim().split("/");
  if (
    !parts.length ||
    parts.some((p) => !p || p === "." || p === "..") ||
    /[\\:#?\u0000-\u001f]/.test(value) ||
    value.startsWith("/") ||
    !extensions.some((e) => value.toLowerCase().endsWith(e))
  )
    throw new Error(
      `Invalid filename: ${value}. Use a file inside public/models/.`,
    );
  return parts.join("/");
}
const bounded = (n, fallback, min, max) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.max(min, Math.min(max, n))
    : fallback;
const short = (s, fallback, length) =>
  typeof s === "string" && s.trim() ? s.trim().slice(0, length) : fallback;
export function normaliseModel(input) {
  if (
    !input ||
    typeof input !== "object" ||
    typeof input.id !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,59}$/i.test(input.id)
  )
    throw new Error(
      "Each model needs a unique id using letters, numbers, hyphens or underscores.",
    );
  const category = short(input.category, "General", 24);
  return {
    id: input.id,
    name: short(input.name, input.id, 45),
    category: category.toLowerCase() === "your models" ? "General" : category,
    file: relativeFile(input.file, [".glb"]),
    height: bounded(input.height, 1.5, 0.2, 4),
    rotation: [0, 1, 2].map((i) => bounded(input.rotation?.[i], 0, -360, 360)),
    animate: input.animate !== false,
    ...(input.thumbnail
      ? {
          thumbnail: relativeFile(input.thumbnail, [
            ".png",
            ".jpg",
            ".jpeg",
            ".webp",
          ]),
        }
      : {}),
    ...(typeof input.background === "string" &&
    /^#[0-9a-f]{6}$/i.test(input.background)
      ? { background: input.background }
      : {}),
    ...(typeof input.credit === "string"
      ? { credit: input.credit.slice(0, 180) }
      : {}),
  };
}
function fileUrl(path) {
  const uploaded = resolveModelFile(path);
  if (uploaded) return uploaded;
  return publicUrl(
    `models/${path.split("/").map(encodeURIComponent).join("/")}`,
  );
}
export function modelAsset(input) {
  const model = normaliseModel(input);
  return {
    id: `model:${model.id}`,
    name: model.name,
    category: model.category,
    bg: model.background || "#edf4ef",
    color: "#9bbab0",
    tag: "Library model",
    kind: "glb",
    model,
    modelUrl: fileUrl(model.file),
    thumbnailUrl: model.thumbnail ? fileUrl(model.thumbnail) : "",
  };
}
export async function fetchCatalogue() {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10000);
  catalogue.warnings = [];
  try {
    const response = await fetch(publicUrl("models/catalog.json"), {
      cache: "no-cache",
      signal: abort.signal,
    });
    if (!response.ok)
      throw new Error(
        `catalog.json could not be loaded (HTTP ${response.status}).`,
      );
    const text = await response.text();
    if (text.length > 200000)
      throw new Error("catalog.json is too large. Keep it below 200 KB.");
    const json = JSON.parse(text);
    if (json.version !== 1 || !Array.isArray(json.models))
      throw new Error(
        'Use a catalogue with "version": 1 and a "models" array.',
      );
    if (
      typeof json.repository === "string" &&
      /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(json.repository)
    )
      catalogue.repository = json.repository;
    const seen = new Set(),
      assets = [];
    for (const [index, input] of json.models.slice(0, 100).entries()) {
      try {
        const asset = modelAsset(input);
        if (seen.has(asset.id))
          throw new Error(`Duplicate model id: ${input.id}`);
        seen.add(asset.id);
        assets.push(asset);
      } catch (error) {
        catalogue.warnings.push(`Entry ${index + 1}: ${error.message}`);
      }
    }
    if (json.models.length > 100)
      catalogue.warnings.push("Only the first 100 catalogue entries are used.");
    catalogue.count = assets.length;
    return assets;
  } catch (error) {
    catalogue.warnings.push(
      error.name === "AbortError"
        ? "Model catalogue loading timed out. Demo objects are still available."
        : `Model catalogue: ${error.message}`,
    );
    catalogue.count = 0;
    return [];
  } finally {
    clearTimeout(timer);
    catalogue.loaded = true;
  }
}
function setStatus(asset, state, message = "") {
  const status = { state, message };
  statuses.set(asset.id, status);
  window.dispatchEvent(
    new CustomEvent(MODEL_STATUS_EVENT, {
      detail: { id: asset.id, ...status },
    }),
  );
}
export function modelStatus(id) {
  return statuses.get(id) || { state: "idle", message: "" };
}
function gltfLoader() {
  if (!loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(publicUrl("vendor/draco/"));
    draco.setWorkerLimit(2);
    loader = new GLTFLoader()
      .setDRACOLoader(draco)
      .setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}
export function loadModel(asset) {
  if (!requests.has(asset.modelUrl)) {
    setStatus(asset, "loading");
    const promise = schedule(async () => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 30000);
      try {
        const response = await fetch(asset.modelUrl, { signal: abort.signal });
        if (!response.ok)
          throw new Error(
            `${asset.model.file} was not found (HTTP ${response.status}). Check the filename and capital letters.`,
          );
        if ((response.headers.get("content-type") || "").includes("text/html"))
          throw new Error(
            `${asset.model.file} was not found (the server returned a web page). Check the filename and capital letters.`,
          );
        if (Number(response.headers.get("Content-Length")) > MAX_BYTES)
          throw new Error(
            "This GLB is over 40 MB. Optimise it for a phone before adding it.",
          );
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > MAX_BYTES)
          throw new Error(
            "This GLB is over 40 MB. Optimise it for a phone before adding it.",
          );
        const view = new DataView(bytes);
        if (
          bytes.byteLength < 20 ||
          view.getUint32(0, true) !== 0x46546c67 ||
          view.getUint32(4, true) !== 2 ||
          view.getUint32(8, true) !== bytes.byteLength ||
          view.getUint32(16, true) !== 0x4e4f534a
        )
          throw new Error(
            `${asset.model.file} is not a valid GLB 2.0 file. Do not rename an FBX or OBJ to .glb.`,
          );
        const jsonLength = view.getUint32(12, true);
        if (jsonLength < 2 || jsonLength > bytes.byteLength - 20)
          throw new Error("The GLB JSON chunk is damaged.");
        const json = JSON.parse(
          new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)),
        );
        if (
          [...(json.buffers || []), ...(json.images || [])].some(
            (resource) => resource.uri && !resource.uri.startsWith("data:"),
          )
        )
          throw new Error(
            "Embed all textures and buffers inside the GLB. External texture files are not supported.",
          );
        if ((json.extensionsRequired || []).includes("KHR_texture_basisu"))
          throw new Error(
            "KTX2 textures are not supported. Export with embedded PNG/JPEG textures instead.",
          );
        const base = asset.modelUrl.startsWith("blob:")
          ? new URL(publicUrl(""), window.location.href).href
          : new URL(".", new URL(asset.modelUrl, window.location.href)).href;
        abort.signal.throwIfAborted();
        const gltf = await Promise.race([
          gltfLoader().parseAsync(bytes, base),
          new Promise((_, reject) => {
            abort.signal.addEventListener(
              "abort",
              () =>
                reject(
                  new DOMException("Model loading timed out", "AbortError"),
                ),
              { once: true },
            );
          }),
        ]);
        setStatus(asset, "ready");
        return gltf;
      } catch (error) {
        const message =
          error.name === "AbortError"
            ? `${asset.model.file} took too long to load. Check your connection or use a smaller model.`
            : error.message;
        setStatus(asset, "error", message);
        throw new Error(message);
      } finally {
        clearTimeout(timer);
      }
    });
    // The cached promise is always observed by createGLBModel / thumbnail loads.
    requests.set(asset.modelUrl, promise);
  }
  return requests.get(asset.modelUrl);
}
export function createGLBModel(asset, tint) {
  const group = new THREE.Group();
  group.name = asset.name;
  group.userData.assetId = asset.id;
  group.userData.loading = true;
  const placeholder = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 0),
    new THREE.MeshStandardMaterial({
      color: "#b8a8d8",
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    }),
  );
  placeholder.position.y = 0.5;
  group.add(placeholder);
  group.userData.ready = loadModel(asset)
    .then((gltf) => {
      if (group.userData.disposed) return group;
      const model = cloneSkeleton(gltf.scene);
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry = object.geometry.clone();
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        const copies = materials.map((original) => {
          const material = original.clone();
          if (tint && material.color) material.color.set(tint);
          return material;
        });
        object.material = Array.isArray(object.material) ? copies : copies[0];
        object.castShadow = true;
        object.receiveShadow = true;
      });
      const fitted = new THREE.Group();
      fitted.add(model);
      fitted.rotation.set(
        ...asset.model.rotation.map((v) => THREE.MathUtils.degToRad(v)),
      );
      fitted.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(fitted);
      const size = bounds.getSize(new THREE.Vector3());
      const extent = size.y > 0.00001 ? size.y : Math.max(size.x, size.z);
      if (!Number.isFinite(extent) || extent <= 0.00001)
        throw new Error("The GLB has no visible geometry.");
      fitted.scale.setScalar(asset.model.height / extent);
      fitted.updateMatrixWorld(true);
      bounds = new THREE.Box3().setFromObject(fitted);
      const centre = bounds.getCenter(new THREE.Vector3());
      fitted.position.set(-centre.x, -bounds.min.y, -centre.z);
      group.remove(placeholder);
      placeholder.geometry.dispose();
      placeholder.material.dispose();
      group.add(fitted);
      group.userData.loading = false;
      group.userData.modelReady = true;
      setStatus(asset, "ready");
      group.userData.animationCount = gltf.animations.length;
      group.userData.clips = gltf.animations;
      group.userData.autoAnimate = !!asset.model.animate;
      if (gltf.animations.length) {
        // A mixer is kept for every animated GLB so teachers' play buttons can
        // run any clip, even when the owner turned automatic animation off.
        group.userData.mixer = new THREE.AnimationMixer(model);
        group.userData.mixerRoot = model;
        applyIdleClip(group);
      }
      return group;
    })
    .catch((error) => {
      if (group.userData.disposed) return group;
      group.userData.loading = false;
      group.userData.loadError = error.message;
      placeholder.material.color.set("#d08b89");
      placeholder.material.opacity = 0.9;
      setStatus(asset, "error", error.message);
      return group;
    });
  return group;
}
export function tickModel(group, delta) {
  if (group.userData.mixer && delta > 0)
    group.userData.mixer.update(Math.min(delta, 0.1));
}
export function catalogueRepositoryUrl(file = "") {
  if (!catalogue.repository) return "";
  const root = `https://github.com/${catalogue.repository}`;
  return file
    ? `${root}/edit/main/public/models/catalog.json`
    : `${root}/tree/main/public/models`;
}

export function clipLabel(clip, index) {
  const name = String(clip?.name || "")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name ? name.slice(0, 40) : `Animation ${index + 1}`;
}
export async function modelClipNames(asset) {
  if (!asset?.model) return [];
  const gltf = await loadModel(asset);
  return gltf.animations.map(clipLabel);
}
