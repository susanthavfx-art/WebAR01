import * as THREE from "three";
import { createGLBModel, modelAsset } from "./model-library";
import { disposeActions } from "./model-actions";
export { tickModel } from "./model-library";

const sharedModels = new Map();

const FALLBACK_ASSET = {
  id: "placeholder",
  name: "3D Object",
  category: "GLB Model",
  bg: "#f0ebff",
  color: "#9878e2",
  kind: "placeholder",
};

export const MODEL_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="230" viewBox="0 0 260 230"><path d="m130 48 58 32v67l-58 34-58-34V80Z" fill="#e6e0f8" stroke="#9878e2" stroke-width="3" stroke-linejoin="round"/><path d="m72 80 58 35 58-35M130 115v66" fill="none" stroke="#9878e2" stroke-width="3"/><circle cx="187" cy="58" r="16" fill="#f7f3e5"/><path d="M187 50v16m-8-8h16" stroke="#8b6ee8" stroke-width="2" stroke-linecap="round"/></svg>',
  );

export const MARKER_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="24" fill="#f3effb"/><rect x="34" y="34" width="132" height="132" rx="16" fill="none" stroke="#b5a4e0" stroke-width="4" stroke-dasharray="10 8"/><circle cx="80" cy="82" r="13" fill="#cbbdf0"/><path d="m52 142 34-36 26 26 18-18 20 28Z" fill="#b5a4e0"/></svg>',
  );

export const findAsset = (id) => sharedModels.get(id);

export const hasAsset = (id) => !!findAsset(id);

export function registerSharedModel(input) {
  const asset = modelAsset(input);
  sharedModels.set(asset.id, asset);
  return asset;
}

export const getAsset = (id, definition) => {
  if (definition) {
    try {
      const asset = modelAsset(definition);
      sharedModels.set(asset.id, asset);
      if (asset.id === id) return asset;
    } catch {
      /* Fall back to registered model or placeholder */
    }
  }
  return findAsset(id) || FALLBACK_ASSET;
};

export function createAsset(id, tint, definition) {
  const asset = getAsset(id, definition);
  if (asset.kind === "glb") return createGLBModel(asset, tint);
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshStandardMaterial({
      color: tint || asset.color || "#9878e2",
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  box.position.y = 0.45;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  group.userData.assetId = id;
  group.userData.ready = Promise.resolve(group);
  return group;
}

export function sceneObject(
  assetId,
  position = [0, 0, 0],
  scale = 1,
  extra = {},
) {
  const asset = getAsset(assetId, extra.model);
  return {
    id: crypto.randomUUID(),
    assetId,
    name: asset.name,
    ...(asset.model ? { model: asset.model } : {}),
    position,
    rotation: [0, 0, 0],
    scale,
    animation: "none",
    visible: true,
    ...extra,
  };
}

export function applyObjectTransform(group, object) {
  group.position.set(...object.position);
  group.rotation.set(...object.rotation.map((v) => (v * Math.PI) / 180));
  group.scale.setScalar(object.scale);
  group.visible = object.visible !== false;
  group.userData.objectId = object.id;
}

export function disposeGroup(group) {
  disposeActions(group);
  group.traverse((o) => {
    o.userData.disposed = true;
    if (o.userData.mixer) {
      o.userData.mixer.stopAllAction();
      o.userData.mixer.uncacheRoot(o.userData.mixerRoot);
    }
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      materials.forEach((m) => m.dispose());
    }
  });
}

export function addLights(scene, shadows = true) {
  scene.add(new THREE.HemisphereLight("#fffaf4", "#b1afc9", 1.8));
  const key = new THREE.DirectionalLight("#fff8ed", 2.6);
  key.position.set(-3, 7, 5);
  key.castShadow = shadows;
  if (shadows) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.normalBias = 0.03;
    key.shadow.bias = -0.0001;
    key.shadow.radius = 4;
  }
  scene.add(key);
  const fill = new THREE.DirectionalLight("#d8ceff", 0.75);
  fill.position.set(4, 3, -4);
  scene.add(fill);
}

let thumbnailRenderer;
const thumbnailCache = new Map();
const thumbnailJobs = new Map();

function renderThumbnail(key, model) {
  if (!thumbnailRenderer) {
    thumbnailRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    thumbnailRenderer.setSize(260, 230);
    thumbnailRenderer.setPixelRatio(1);
    thumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    thumbnailRenderer.toneMappingExposure = 1.1;
  }
  const scene = new THREE.Scene();
  addLights(scene, false);
  scene.add(model);
  const bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(0.1, size.x, size.y, size.z);
  const camera = new THREE.PerspectiveCamera(
    32,
    260 / 230,
    0.01,
    span * 12 + 10,
  );
  camera.position.set(
    centre.x + span * 1.1,
    centre.y + span * 0.5,
    centre.z + span * 2.7,
  );
  camera.lookAt(centre);
  thumbnailRenderer.render(scene, camera);
  const image = thumbnailRenderer.domElement.toDataURL("image/png");
  thumbnailCache.set(key, image);
  disposeGroup(model);
  return image;
}

function thumbnailKey(asset) {
  return asset.kind === "glb"
    ? `${asset.id}:${JSON.stringify(asset.model)}`
    : asset.id;
}

export function assetThumbnail(id, definition) {
  const asset = getAsset(id, definition);
  const key = thumbnailKey(asset);
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if (thumbnailCache.has(key)) return thumbnailCache.get(key);
  return MODEL_PLACEHOLDER;
}

export function assetThumbnailAsync(id, definition) {
  const asset = getAsset(id, definition);
  const key = thumbnailKey(asset);
  if (asset.kind !== "glb" || asset.thumbnailUrl || thumbnailCache.has(key)) {
    return Promise.resolve(assetThumbnail(id, definition));
  }
  if (!thumbnailJobs.has(key)) {
    const model = createAsset(id, undefined, definition);
    const job = model.userData.ready.then(() => {
      if (model.userData.loadError) {
        disposeGroup(model);
        throw new Error(model.userData.loadError);
      }
      return renderThumbnail(key, model);
    });
    thumbnailJobs.set(key, job);
  }
  return thumbnailJobs.get(key);
}
