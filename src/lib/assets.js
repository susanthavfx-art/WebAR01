import { safeResourceReference, resolveResourceUrl } from "./local-files";
import { createGLBModel, fetchCatalogue, modelAsset } from "./model-library";
export { catalogue, tickModel } from "./model-library";
import { publicUrl } from "./deployment";
import { disposeActions } from "./model-actions";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const ASSETS = [
  {
    id: "rocket",
    name: "Rocket",
    category: "Space",
    bg: "#fff0e9",
    color: "#f17865",
    tag: "Blast off!",
  },
  {
    id: "earth",
    name: "Earth",
    category: "Space",
    bg: "#eaf5f4",
    color: "#6db6e3",
    tag: "Our home",
  },
  {
    id: "saturn",
    name: "Saturn",
    category: "Space",
    bg: "#fff4dc",
    color: "#e8ae65",
    tag: "Ring, ring",
  },
  {
    id: "moon",
    name: "Moon",
    category: "Space",
    bg: "#f0eef8",
    color: "#b8bdd5",
    tag: "Lunar explorer",
  },
  {
    id: "sun",
    name: "Sun",
    category: "Space",
    bg: "#fff6df",
    color: "#f9bd52",
    tag: "Shine bright",
  },
  {
    id: "astronaut",
    name: "Astronaut",
    category: "Space",
    bg: "#eaf0fc",
    color: "#e8eaf4",
    tag: "Space walker",
  },
  {
    id: "tree",
    name: "Tree",
    category: "Nature",
    bg: "#eaf5e9",
    color: "#79bd8f",
    tag: "Stay curious",
  },
  {
    id: "mushroom",
    name: "Mushroom",
    category: "Nature",
    bg: "#fff0ed",
    color: "#ed887d",
    tag: "Tiny forest",
  },
  {
    id: "robot",
    name: "Robot",
    category: "Science",
    bg: "#f0ebff",
    color: "#a391dc",
    tag: "Hello, human",
  },
  {
    id: "atom",
    name: "Atom",
    category: "Science",
    bg: "#e8f6f6",
    color: "#78bec9",
    tag: "Little big ideas",
  },
  {
    id: "volcano",
    name: "Volcano",
    category: "Nature",
    bg: "#f9ede5",
    color: "#ab826e",
    tag: "Earth in action",
  },
  {
    id: "flower",
    name: "Flower",
    category: "Nature",
    bg: "#fff0f5",
    color: "#f3a6c2",
    tag: "Watch me bloom",
  },
];

export const MARKERS = [
  {
    id: "space-explorer",
    name: "Space explorer",
    subtitle: "A universe of possibilities",
    image: publicUrl("markers/space-explorer.jpg"),
    target: publicUrl("markers/space-explorer.mind"),
    color: "#e9e5fa",
  },
  {
    id: "forest-friends",
    name: "Forest friends",
    subtitle: "Let your ideas grow wild",
    image: publicUrl("markers/forest-friends.jpg"),
    target: publicUrl("markers/forest-friends.mind"),
    color: "#e5f1e8",
  },
];
// Teacher-made markers live online; their definitions travel with projects.
const customMarkers = new Map();
export const CUSTOM_MARKER_ID =
  /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 1200) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
export function validateMarkerDefinition(input) {
  if (!input || typeof input !== "object" || !CUSTOM_MARKER_ID.test(input.id))
    return null;
  const image = safeResourceReference(input.image),
    target = safeResourceReference(input.target);
  if (!image || !target) return null;
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 40)
      : "My marker";
  return {
    id: input.id.toLowerCase(),
    name,
    image,
    target,
    ...(typeof input.quality === "number" && Number.isFinite(input.quality)
      ? {
          quality: Math.max(
            0,
            Math.min(1, Math.round(input.quality * 100) / 100),
          ),
        }
      : {}),
    ...(typeof input.createdAt === "string" &&
    Number.isFinite(Date.parse(input.createdAt))
      ? { createdAt: new Date(input.createdAt).toISOString() }
      : {}),
  };
}
export function registerCustomMarker(input) {
  const definition = validateMarkerDefinition(input);
  if (!definition) return null;
  const marker = {
    ...definition,
    subtitle: "Made by you",
    color: "#f3effb",
    custom: true,
    definition,
  };
  customMarkers.set(definition.id, marker);
  return marker;
}
export const isBuiltInMarker = (id) => MARKERS.some((m) => m.id === id);
export const hasMarker = (id) => isBuiltInMarker(id) || customMarkers.has(id);
export const getMarker = (id) => {
  const marker =
    MARKERS.find((m) => m.id === id) || customMarkers.get(id) || MARKERS[0];
  return marker.custom
    ? {
        ...marker,
        image: resolveResourceUrl(marker.image),
        target: resolveResourceUrl(marker.target),
      }
    : marker;
};
const sharedModels = new Map();
export const findAsset = (id) =>
  ASSETS.find((a) => a.id === id) || sharedModels.get(id);
export const getAsset = (id, definition) => {
  if (definition) {
    const asset = modelAsset(definition);
    if (asset.id === id) return asset;
  }
  return findAsset(id) || ASSETS[0];
};
export const hasAsset = (id) => !!findAsset(id);
export function registerSharedModel(input) {
  const asset = modelAsset(input);
  const existing = findAsset(asset.id);
  if (!existing) sharedModels.set(asset.id, asset);
  return asset;
}
// Library markers: image + .mind pairs the owner uploads to public/markers.
// The build lists them in markers/index.json (see scripts/marker-library.mjs).
const LIBRARY_MARKER_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const LIBRARY_FILE = /^[\w .()-]{1,120}$/;
const markerFile = (file) => publicUrl(`markers/${encodeURIComponent(file)}`);
export async function loadMarkerLibrary() {
  try {
    const response = await fetch(publicUrl("markers/index.json"), {
      cache: "no-cache",
    });
    if (!response.ok) return [];
    const data = await response.json();
    const added = [];
    for (const m of Array.isArray(data?.markers)
      ? data.markers.slice(0, 60)
      : []) {
      if (
        !m ||
        !LIBRARY_MARKER_ID.test(m.id) ||
        MARKERS.some((x) => x.id === m.id) ||
        !LIBRARY_FILE.test(m.image) ||
        !/\.(jpe?g|png|webp)$/i.test(m.image) ||
        !LIBRARY_FILE.test(m.target) ||
        !/\.mind$/i.test(m.target)
      )
        continue;
      const marker = {
        id: m.id,
        name: String(m.name || m.id).slice(0, 40),
        subtitle: String(m.subtitle || "From the marker library").slice(0, 60),
        image: markerFile(m.image),
        target: markerFile(m.target),
        color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : "#f1ece4",
        library: true,
      };
      MARKERS.push(marker);
      added.push(marker);
    }
    return added;
  } catch {
    return [];
  }
}
export async function initialiseLibrary() {
  const [models] = await Promise.all([fetchCatalogue(), loadMarkerLibrary()]);
  for (const asset of models)
    if (!ASSETS.some((a) => a.id === asset.id)) ASSETS.push(asset);
  return models;
}
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.52,
    metalness: 0.03,
    ...extra,
  });
function mesh(group, geometry, color, position = [0, 0, 0], extra = {}) {
  const m = new THREE.Mesh(geometry, mat(color, extra));
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
function ball(g, r, color, pos, scale) {
  const m = mesh(g, new THREE.SphereGeometry(r, 40, 28), color, pos);
  if (scale) m.scale.set(...scale);
  return m;
}
function box(g, dims, color, pos, radius = 0.08) {
  return mesh(g, new RoundedBoxGeometry(...dims, 3, radius), color, pos);
}
function cylinder(g, top, bottom, height, color, pos) {
  return mesh(
    g,
    new THREE.CylinderGeometry(top, bottom, height, 40),
    color,
    pos,
  );
}
let earthTexture;
function makeEarthTexture() {
  if (earthTexture) return earthTexture;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#5aadd7";
  x.fillRect(0, 0, 1024, 512);
  x.fillStyle = "#83c292";
  const land = [
    [
      [65, 105],
      [135, 65],
      [218, 78],
      [275, 115],
      [253, 150],
      [220, 163],
      [210, 198],
      [170, 207],
      [150, 180],
      [114, 174],
      [90, 141],
    ],
    [
      [207, 203],
      [254, 210],
      [273, 252],
      [298, 269],
      [281, 326],
      [262, 349],
      [250, 400],
      [222, 370],
      [210, 310],
      [197, 261],
    ],
    [
      [425, 135],
      [461, 96],
      [509, 106],
      [528, 128],
      [565, 103],
      [616, 105],
      [631, 79],
      [703, 83],
      [731, 111],
      [789, 111],
      [823, 157],
      [790, 188],
      [727, 181],
      [702, 219],
      [659, 201],
      [630, 234],
      [598, 199],
      [569, 180],
      [546, 190],
      [531, 162],
      [492, 165],
      [471, 144],
    ],
    [
      [464, 180],
      [508, 169],
      [548, 199],
      [566, 251],
      [537, 281],
      [512, 333],
      [482, 315],
      [463, 269],
      [446, 225],
    ],
    [
      [737, 314],
      [791, 292],
      [832, 325],
      [816, 362],
      [770, 370],
      [740, 348],
    ],
    [
      [302, 48],
      [350, 34],
      [364, 65],
      [334, 91],
      [309, 79],
    ],
    [
      [610, 247],
      [620, 258],
      [617, 294],
      [606, 283],
    ],
  ];
  for (const p of land) {
    x.beginPath();
    x.moveTo(...p[0]);
    for (let i = 1; i < p.length; i++) x.lineTo(...p[i]);
    x.closePath();
    x.fill();
  }
  x.fillStyle = "#edf6ec";
  x.beginPath();
  x.ellipse(512, 5, 490, 17, 0, 0, Math.PI * 2);
  x.fill();
  x.beginPath();
  x.ellipse(512, 510, 500, 20, 0, 0, Math.PI * 2);
  x.fill();
  earthTexture = new THREE.CanvasTexture(c);
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  return earthTexture;
}

export function createAsset(id, tint, definition) {
  const asset = getAsset(id, definition);
  if (asset.kind === "glb") return createGLBModel(asset, tint);
  const g = new THREE.Group();
  const defaultColor = getAsset(id).color;
  const color = tint || defaultColor;
  if (id === "earth") {
    const earth = ball(g, 0.7, tint || "#ffffff", [0, 0.72, 0]);
    earth.material.map = makeEarthTexture();
    earth.rotation.y = -0.6;
    const clouds = new THREE.Group();
    g.add(clouds);
    for (const [px, py, pz, sx] of [
      [-0.35, 1.1, 0.45, 0.3],
      [0.38, 0.55, 0.51, 0.25],
      [0.13, 1.28, 0.15, 0.21],
    ]) {
      const m = ball(
        clouds,
        0.12,
        "#ffffff",
        [px, py, pz],
        [sx / 0.12, 0.35, 1],
      );
      m.material.transparent = true;
      m.material.opacity = 0.65;
    }
  } else if (id === "saturn") {
    ball(g, 0.58, color, [0, 0.9, 0]);
    const rings = new THREE.Group();
    rings.position.y = 0.9;
    rings.rotation.set(0.04, 0, -0.16);
    g.add(rings);
    for (const [inner, outer, c] of [
      [0.75, 0.9, "#f3dab0"],
      [0.92, 1.05, "#e1bd8c"],
      [1.07, 1.12, "#f2ddbf"],
    ]) {
      const ring = mesh(rings, new THREE.RingGeometry(inner, outer, 96), c);
      ring.rotation.x = -Math.PI / 2;
      ring.material.side = THREE.DoubleSide;
    }
    for (const y of [-0.27, -0.1, 0.12, 0.3]) {
      const r = Math.sqrt(0.58 * 0.58 - y * y) + 0.003;
      const ring = mesh(
        g,
        new THREE.TorusGeometry(r, 0.014, 6, 64),
        "#f2ca8c",
        [0, 0.9 + y, 0],
      );
      ring.rotation.x = Math.PI / 2;
    }
  } else if (id === "rocket") {
    cylinder(g, 0.25, 0.31, 0.96, "#f8f3e9", [0, 0.91, 0]);
    mesh(g, new THREE.ConeGeometry(0.25, 0.48, 40), color, [0, 1.63, 0]);
    cylinder(g, 0.315, 0.315, 0.1, color, [0, 0.5, 0]);
    cylinder(g, 0.265, 0.265, 0.04, "#d6cfcd", [0, 1.3, 0]);
    const rim = mesh(
      g,
      new THREE.TorusGeometry(0.145, 0.04, 12, 48),
      "#edbd69",
      [0, 1.02, 0.267],
    );
    const glass = ball(g, 0.124, "#83bfce", [0, 1.02, 0.28], [1, 1, 0.4]);
    glass.material.metalness = 0.15;
    glass.material.roughness = 0.2;
    ball(g, 0.035, "#d9f5f4", [-0.043, 1.065, 0.327]);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Group();
      fin.rotation.y = (i * Math.PI * 2) / 3;
      g.add(fin);
      const shape = new THREE.Shape();
      shape.moveTo(0.2, 0.38);
      shape.lineTo(0.5, 0.18);
      shape.quadraticCurveTo(0.55, 0.65, 0.28, 0.85);
      shape.closePath();
      mesh(
        fin,
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.07,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.025,
          bevelThickness: 0.02,
        }),
        color,
      );
    }
    const fire = mesh(
      g,
      new THREE.ConeGeometry(0.19, 0.48, 24),
      "#ffba56",
      [0, 0.14, 0],
    );
    fire.rotation.z = Math.PI;
    const flame = mesh(
      g,
      new THREE.ConeGeometry(0.1, 0.3, 24),
      "#ffe2a0",
      [0, 0.2, 0.07],
    );
    flame.rotation.z = Math.PI;
  } else if (id === "moon") {
    ball(g, 0.65, color, [0, 0.66, 0]);
    for (const [a, b, r] of [
      [-0.45, 0.7, 0.15],
      [0.4, 0.4, 0.1],
      [0.8, 0.8, 0.12],
      [-0.2, -0.5, 0.12],
      [1.5, 0.4, 0.09],
      [-1.3, 0.2, 0.16],
      [0.1, 0.25, 0.08],
    ]) {
      const px = 0.65 * Math.cos(b) * Math.sin(a),
        py = 0.66 + 0.65 * Math.sin(b),
        pz = 0.65 * Math.cos(b) * Math.cos(a);
      const crater = ball(g, r, "#9da5c0", [px, py, pz]);
      crater.scale.set(1, 0.55, 1);
      crater.material.roughness = 0.9;
    }
  } else if (id === "sun") {
    ball(g, 0.6, color, [0, 0.87, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const ray = mesh(g, new THREE.ConeGeometry(0.085, 0.22, 8), "#f8c96a", [
        Math.sin(a) * 0.82,
        0.87 + Math.cos(a) * 0.82,
        0,
      ]);
      ray.rotation.z = -a;
    }
    ball(g, 0.035, "#a76b3f", [-0.18, 0.93, 0.57]);
    ball(g, 0.035, "#a76b3f", [0.18, 0.93, 0.57]);
    const smile = mesh(
      g,
      new THREE.TorusGeometry(0.095, 0.015, 8, 24, Math.PI),
      "#a76b3f",
      [0, 0.81, 0.585],
    );
    smile.rotation.z = Math.PI;
  } else if (id === "tree") {
    cylinder(g, 0.12, 0.17, 0.94, "#b18d6c", [0, 0.49, 0]);
    ball(g, 0.56, color, [0, 1.28, 0]);
    ball(g, 0.42, "#a2ce9e", [-0.35, 1.04, 0.08]);
    ball(g, 0.42, "#75ae8b", [0.35, 1.1, -0.05]);
    ball(g, 0.34, "#b6d9a7", [0.1, 1.6, 0.02]);
    const b = cylinder(g, 0.04, 0.065, 0.45, "#b18d6c", [0.18, 0.78, 0]);
    b.rotation.z = -0.6;
  } else if (id === "mushroom") {
    cylinder(g, 0.17, 0.21, 0.72, "#f7e7cf", [0, 0.37, 0]);
    const cap = mesh(
      g,
      new THREE.SphereGeometry(0.65, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      color,
      [0, 0.82, 0],
    );
    cap.scale.y = 0.75;
    cylinder(g, 0.65, 0.6, 0.055, "#f4d6bd", [0, 0.82, 0]);
    for (const [px, py, pz, r] of [
      [-0.3, 1.15, 0.2, 0.09],
      [0.13, 1.27, 0.1, 0.1],
      [0.36, 1.09, 0.2, 0.09],
      [0, 1.1, 0.49, 0.07],
      [-0.4, 1.0, -0.2, 0.08],
    ])
      ball(g, r, "#fff5e6", [px, py, pz], [1, 0.4, 1]);
  } else if (id === "robot") {
    box(g, [0.68, 0.66, 0.46], color, [0, 0.82, 0], 0.1);
    box(g, [0.84, 0.57, 0.5], color, [0, 1.48, 0], 0.12);
    box(g, [0.66, 0.32, 0.05], "#4c5469", [0, 1.5, 0.265], 0.06);
    ball(g, 0.06, "#b8ede3", [-0.18, 1.51, 0.31]);
    ball(g, 0.06, "#b8ede3", [0.18, 1.51, 0.31]);
    cylinder(g, 0.027, 0.027, 0.2, "#9b91b9", [0, 1.86, 0]);
    ball(g, 0.07, "#f1be6a", [0, 1.99, 0]);
    for (const s of [-1, 1]) {
      box(g, [0.22, 0.38, 0.28], "#9185bf", [s * 0.2, 0.29, 0], 0.05);
      box(g, [0.27, 0.16, 0.39], "#675c89", [s * 0.2, 0.1, 0.05], 0.045);
      const a = box(g, [0.2, 0.56, 0.23], "#b4a8de", [s * 0.5, 0.82, 0], 0.07);
      a.rotation.z = s * 0.16;
      ball(g, 0.11, "#e1d8f8", [s * 0.55, 0.51, 0]);
    }
    box(g, [0.28, 0.19, 0.02], "#d4c7f0", [0, 0.88, 0.25], 0.02);
    ball(g, 0.04, "#f2c46b", [0, 0.88, 0.27]);
  } else if (id === "astronaut") {
    box(g, [0.6, 0.72, 0.42], color, [0, 0.8, 0], 0.13);
    box(g, [0.5, 0.54, 0.25], "#c7cadd", [0, 0.9, -0.28], 0.07);
    ball(g, 0.43, "#f1f2f8", [0, 1.53, 0]);
    const visor = ball(g, 0.34, "#788aaa", [0, 1.55, 0.23], [1, 0.82, 0.5]);
    visor.material.metalness = 0.4;
    visor.material.roughness = 0.2;
    ball(g, 0.08, "#b6d6e4", [-0.13, 1.68, 0.37], [1, 0.65, 0.3]);
    for (const s of [-1, 1]) {
      box(g, [0.23, 0.43, 0.28], "#dcdfea", [s * 0.18, 0.29, 0], 0.07);
      box(g, [0.27, 0.15, 0.38], "#b6bcd2", [s * 0.18, 0.1, 0.06], 0.05);
      const a = box(
        g,
        [0.22, 0.58, 0.24],
        "#e2e5f0",
        [s * 0.44, 0.87, 0],
        0.09,
      );
      a.rotation.z = s * 0.26;
      ball(g, 0.12, "#c9d0e1", [s * 0.52, 0.58, 0]);
    }
    box(g, [0.31, 0.21, 0.03], "#b5c4de", [0, 0.9, 0.23], 0.03);
    ball(g, 0.037, "#ed9c86", [-0.07, 0.91, 0.26]);
    ball(g, 0.037, "#8dcbbd", [0.07, 0.91, 0.26]);
  } else if (id === "atom") {
    ball(g, 0.22, "#f2a28c", [0, 0.85, 0]);
    ball(g, 0.18, color, [0.2, 0.9, 0]);
    ball(g, 0.19, "#a397d8", [-0.1, 0.99, 0.1]);
    ball(g, 0.16, "#edbd6c", [0.01, 0.7, 0.1]);
    for (let i = 0; i < 3; i++) {
      const orbit = new THREE.Group();
      orbit.position.y = 0.87;
      orbit.rotation.set(i * 0.8, i * 0.9, 0.45);
      g.add(orbit);
      mesh(orbit, new THREE.TorusGeometry(0.78, 0.015, 8, 80), color);
      const a = i * 1.8;
      ball(orbit, 0.085, "#97cfd3", [
        Math.sin(a) * 0.78,
        Math.cos(a) * 0.78,
        0,
      ]);
    }
  } else if (id === "volcano") {
    mesh(
      g,
      new THREE.CylinderGeometry(0.28, 0.92, 1.15, 9),
      color,
      [0, 0.58, 0],
    );
    mesh(
      g,
      new THREE.CylinderGeometry(0.3, 0.43, 0.3, 9),
      "#ee9d79",
      [0, 1.02, 0],
    );
    cylinder(g, 0.22, 0.22, 0.02, "#c66450", [0, 1.18, 0]);
    for (let i = 0; i < 3; i++)
      ball(
        g,
        0.16 + i * 0.025,
        "#ded7da",
        [-0.07 + i * 0.15, 1.45 + i * 0.2, 0],
        [1, 1.3, 1],
      );
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ball(
        g,
        0.12,
        "#987561",
        [Math.sin(a) * 0.8, 0.09, Math.cos(a) * 0.8],
        [1.4, 0.7, 1],
      );
    }
  } else if (id === "flower") {
    cylinder(g, 0.035, 0.04, 0.94, "#79aa78", [0, 0.49, 0]);
    for (const s of [-1, 1]) {
      const l = ball(g, 0.16, "#90bb8b", [s * 0.15, 0.46, 0], [1.7, 0.4, 0.65]);
      l.rotation.z = s * 0.5;
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const p = ball(
        g,
        0.22,
        color,
        [Math.sin(a) * 0.3, 1.2 + Math.cos(a) * 0.3, 0],
        [0.8, 1.3, 0.5],
      );
      p.rotation.z = -a;
    }
    ball(g, 0.17, "#f4c35d", [0, 1.2, 0.1], [1, 1, 0.6]);
  }
  g.userData.assetId = id;
  return g;
}

export function sceneObject(
  assetId,
  position = [0, 0, 0],
  scale = 1,
  extra = {},
) {
  return {
    id: crypto.randomUUID(),
    assetId,
    name: getAsset(assetId).name,
    ...(getAsset(assetId).model ? { model: getAsset(assetId).model } : {}),
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
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => m.dispose());
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
export const MODEL_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="230" viewBox="0 0 260 230"><path d="m130 48 58 32v67l-58 34-58-34V80Z" fill="#d9e7df" stroke="#9bb5a8" stroke-width="3" stroke-linejoin="round"/><path d="m72 80 58 35 58-35M130 115v66" fill="none" stroke="#9bb5a8" stroke-width="3"/><circle cx="187" cy="58" r="16" fill="#f7f3e5"/><path d="M187 50v16m-8-8h16" stroke="#b4a6cc" stroke-width="2" stroke-linecap="round"/></svg>',
  );
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
  const bounds = new THREE.Box3().setFromObject(model),
    centre = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3()),
    span = Math.max(0.1, size.x, size.y, size.z);
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
    ? asset.id + ":" + JSON.stringify(asset.model)
    : asset.id;
}
export function assetThumbnail(id, definition) {
  const asset = getAsset(id, definition),
    key = thumbnailKey(asset);
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  if (thumbnailCache.has(key)) return thumbnailCache.get(key);
  if (asset.kind === "glb") return MODEL_PLACEHOLDER;
  try {
    return renderThumbnail(key, createAsset(id));
  } catch {
    return MODEL_PLACEHOLDER;
  }
}
export function assetThumbnailAsync(id, definition) {
  const asset = getAsset(id, definition),
    key = thumbnailKey(asset);
  if (asset.kind !== "glb" || asset.thumbnailUrl || thumbnailCache.has(key))
    return Promise.resolve(assetThumbnail(id, definition));
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
