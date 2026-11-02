import * as THREE from "three";

/**
 * Ready-made 3D content for the studio — the equivalent of Assemblr's shape /
 * object library. Every shape is generated with Three.js primitives, so nothing
 * has to be downloaded: a marker can hold a tree, a rocket or a robot without
 * the teacher ever exporting a GLB.
 *
 * Shapes live in the same registry as uploaded GLB models (see lib/assets.js),
 * which means they work in the studio canvas, in Lesson-box targets and in the
 * published AR viewer without any extra code path.
 */

const MATERIAL = { roughness: 0.52, metalness: 0.04 };

function part(geometry, color, options = {}) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      ...MATERIAL,
      ...(options.material || {}),
    }),
  );
  if (options.position) mesh.position.set(...options.position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  const scale = options.scale ?? 1;
  if (typeof scale === "number") mesh.scale.setScalar(scale);
  else mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Detail parts (eyes, trunk, ribbon) stay their own colour when the creator
  // recolours the object; the main body gets the tint.
  mesh.userData.tintable = options.tintable !== false;
  return mesh;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sphere = (r, w = 32, h = 24) => new THREE.SphereGeometry(r, w, h);
const cylinder = (top, bottom, h, segments = 28) =>
  new THREE.CylinderGeometry(top, bottom, h, segments);
const cone = (r, h, segments = 28) => new THREE.ConeGeometry(r, h, segments);

function starShape(points = 5, outer = 0.5, inner = 0.22) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? inner : outer;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function extrude(shape, depth = 0.24) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geometry.center();
  return geometry;
}

function heartShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(0.62, -0.02, 0.52, 0.46, 0.24, 0.46);
  shape.bezierCurveTo(0.08, 0.46, 0.01, 0.34, 0, 0.22);
  shape.bezierCurveTo(-0.01, 0.34, -0.08, 0.46, -0.24, 0.46);
  shape.bezierCurveTo(-0.52, 0.46, -0.62, -0.02, 0, -0.5);
  return extrude(shape, 0.28);
}

function ringOfParts(count, radius, makePart, phase = 0) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = phase + (i / count) * Math.PI * 2;
    parts.push(
      makePart([Math.cos(angle) * radius, 0, Math.sin(angle) * radius], -angle),
    );
  }
  return parts;
}

export const SHAPE_CATEGORIES = ["Basics", "Nature", "Space", "Fun"];

export const SHAPES = [
  {
    id: "prim:cube",
    name: "Cube",
    category: "Basics",
    color: "#a397dc",
    bg: "#f2edff",
    height: 0.8,
    build: () => [part(box(1, 1, 1), "#a397dc")],
  },
  {
    id: "prim:sphere",
    name: "Sphere",
    category: "Basics",
    color: "#9dbbdc",
    bg: "#eef4fb",
    height: 0.8,
    build: () => [part(sphere(0.5), "#9dbbdc")],
  },
  {
    id: "prim:cylinder",
    name: "Cylinder",
    category: "Basics",
    color: "#92c7ae",
    bg: "#eef7f2",
    height: 0.9,
    build: () => [part(cylinder(0.5, 0.5, 1), "#92c7ae")],
  },
  {
    id: "prim:cone",
    name: "Cone",
    category: "Basics",
    color: "#edaa8f",
    bg: "#fdf1ec",
    height: 0.9,
    build: () => [part(cone(0.55, 1), "#edaa8f")],
  },
  {
    id: "prim:pyramid",
    name: "Pyramid",
    category: "Basics",
    color: "#edcc7d",
    bg: "#fdf7e8",
    height: 0.9,
    build: () => [
      part(cone(0.72, 1, 4), "#edcc7d", { rotation: [0, Math.PI / 4, 0] }),
    ],
  },
  {
    id: "prim:torus",
    name: "Ring",
    category: "Basics",
    color: "#c6a4e8",
    bg: "#f7f0fd",
    height: 0.8,
    build: () => [part(new THREE.TorusGeometry(0.36, 0.14, 20, 52), "#c6a4e8")],
  },
  {
    id: "prim:gem",
    name: "Crystal",
    category: "Basics",
    color: "#8fd2d8",
    bg: "#ecf9fa",
    height: 0.9,
    build: () => [
      part(new THREE.OctahedronGeometry(0.55, 0), "#8fd2d8", {
        material: { flatShading: true, metalness: 0.15, roughness: 0.3 },
      }),
    ],
  },
  {
    id: "prim:star",
    name: "Star",
    category: "Basics",
    color: "#f2c75c",
    bg: "#fdf8e7",
    height: 0.9,
    build: () => [
      part(extrude(starShape(5, 0.52, 0.22), 0.22), "#f2c75c", {
        material: { roughness: 0.42 },
      }),
    ],
  },
  {
    id: "prim:tree",
    name: "Tree",
    category: "Nature",
    color: "#79b98a",
    bg: "#eff8f1",
    height: 1.6,
    build: () => [
      part(cylinder(0.075, 0.1, 0.6), "#9c6b45", {
        position: [0, 0.3, 0],
        tintable: false,
      }),
      part(cone(0.46, 0.72, 26), "#79b98a", { position: [0, 0.92, 0] }),
      part(cone(0.36, 0.6, 26), "#8cc79a", { position: [0, 1.2, 0] }),
      part(cone(0.24, 0.46, 24), "#a2d6ae", { position: [0, 1.45, 0] }),
    ],
  },
  {
    id: "prim:flower",
    name: "Flower",
    category: "Nature",
    color: "#ef9fc4",
    bg: "#fdf0f7",
    height: 0.9,
    build: () => [
      part(cylinder(0.032, 0.038, 0.62, 14), "#6fa77c", {
        position: [0, 0.31, 0],
        tintable: false,
      }),
      part(sphere(0.1), "#7cb489", {
        position: [0.12, 0.4, 0],
        scale: [0.9, 0.35, 0.55],
        rotation: [0, 0, 0.5],
        tintable: false,
      }),
      ...ringOfParts(6, 0.17, (position, angle) => [
        part(sphere(0.11), "#ef9fc4", {
          position: [position[0], 0.72, position[2]],
          scale: [1, 0.55, 1],
          rotation: [0, angle, 0],
        }),
      ]).flat(),
      part(sphere(0.085), "#f6d06d", {
        position: [0, 0.75, 0],
        tintable: false,
      }),
    ],
  },
  {
    id: "prim:mushroom",
    name: "Mushroom",
    category: "Nature",
    color: "#e78379",
    bg: "#fdf0ee",
    height: 0.7,
    build: () => [
      part(cylinder(0.11, 0.15, 0.34, 20), "#f4e7d6", {
        position: [0, 0.17, 0],
        tintable: false,
      }),
      part(sphere(0.4, 28, 20), "#e78379", {
        position: [0, 0.34, 0],
        scale: [1, 0.62, 1],
      }),
      ...ringOfParts(5, 0.24, (position) => [
        part(sphere(0.055), "#fff6ea", {
          position: [position[0], 0.52, position[2]],
          scale: [1, 0.6, 1],
          tintable: false,
        }),
      ]).flat(),
    ],
  },
  {
    id: "prim:cactus",
    name: "Cactus",
    category: "Nature",
    color: "#7fb98a",
    bg: "#eff8f0",
    height: 1.1,
    build: () => [
      part(cylinder(0.2, 0.22, 0.86, 24), "#7fb98a", {
        position: [0, 0.43, 0],
      }),
      part(sphere(0.2, 24, 16), "#7fb98a", {
        position: [0, 0.86, 0],
        scale: [1, 0.7, 1],
      }),
      part(cylinder(0.07, 0.07, 0.3, 16), "#7fb98a", {
        position: [0.24, 0.55, 0],
        rotation: [0, 0, Math.PI / 2.4],
      }),
      part(cylinder(0.065, 0.065, 0.24, 16), "#7fb98a", {
        position: [-0.22, 0.42, 0],
        rotation: [0, 0, -Math.PI / 2.4],
      }),
      part(cylinder(0.16, 0.16, 0.1, 24), "#d98d6a", {
        position: [0, 0.03, 0],
        tintable: false,
      }),
    ],
  },
  {
    id: "prim:planet",
    name: "Planet",
    category: "Space",
    color: "#8f9de0",
    bg: "#eef0fd",
    height: 1,
    build: () => [
      part(sphere(0.5, 36, 26), "#8f9de0"),
      part(new THREE.TorusGeometry(0.66, 0.045, 14, 60), "#f0cd86", {
        rotation: [Math.PI / 2.6, 0, 0.3],
        tintable: false,
        material: { roughness: 0.45 },
      }),
    ],
  },
  {
    id: "prim:rocket",
    name: "Rocket",
    category: "Space",
    color: "#f2f0f8",
    bg: "#f4f2fd",
    height: 1.8,
    build: () => {
      const fins = ringOfParts(3, 0.2, (position, angle) => [
        part(box(0.06, 0.34, 0.24), "#e2705f", {
          position: [position[0], 0.24, position[2]],
          rotation: [0, -angle, 0],
          tintable: false,
        }),
      ]).flat();
      return [
        part(cylinder(0.2, 0.24, 0.86, 28), "#f2f0f8", {
          position: [0, 0.6, 0],
        }),
        part(cone(0.2, 0.46, 28), "#e2705f", {
          position: [0, 1.24, 0],
          tintable: false,
        }),
        part(cylinder(0.06, 0.09, 0.1, 18), "#cfc7dd", {
          position: [0, 0.12, 0],
          tintable: false,
        }),
        part(sphere(0.075), "#7fc4e3", {
          position: [0, 0.82, 0.19],
          scale: [1, 1, 0.5],
          tintable: false,
          material: { metalness: 0.3, roughness: 0.2 },
        }),
        ...fins,
      ];
    },
  },
  {
    id: "prim:ufo",
    name: "UFO",
    category: "Space",
    color: "#a8a3b8",
    bg: "#f2f1f6",
    height: 0.65,
    build: () => [
      part(cylinder(0.42, 0.6, 0.14, 32), "#a8a3b8", {
        position: [0, 0.18, 0],
      }),
      part(
        new THREE.SphereGeometry(0.26, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        "#9ed8e4",
        {
          position: [0, 0.25, 0],
          material: { transparent: true, opacity: 0.8, roughness: 0.15 },
          tintable: false,
        },
      ),
      ...ringOfParts(6, 0.38, (position) => [
        part(sphere(0.042), "#f5d67f", {
          position: [position[0], 0.17, position[2]],
          tintable: false,
          material: { emissive: "#f5d67f", emissiveIntensity: 0.5 },
        }),
      ]).flat(),
      part(cylinder(0.16, 0.28, 0.12, 24), "#8b86a0", {
        position: [0, 0.07, 0],
        tintable: false,
      }),
    ],
  },
  {
    id: "prim:moon",
    name: "Moon",
    category: "Space",
    color: "#d8d5cc",
    bg: "#f6f5f0",
    height: 1,
    build: () => [
      part(sphere(0.5, 36, 26), "#d8d5cc", {
        material: { roughness: 0.85 },
      }),
      part(sphere(0.11), "#c2bfb4", {
        position: [0.2, 0.18, 0.36],
        scale: [1, 1, 0.28],
        rotation: [0.5, 0.4, 0],
        tintable: false,
        material: { roughness: 0.9 },
      }),
      part(sphere(0.08), "#c2bfb4", {
        position: [-0.24, -0.1, 0.34],
        scale: [1, 1, 0.28],
        rotation: [0.4, -0.5, 0],
        tintable: false,
        material: { roughness: 0.9 },
      }),
      part(sphere(0.07), "#c2bfb4", {
        position: [0.06, -0.3, 0.32],
        scale: [1, 1, 0.28],
        rotation: [0.6, 0.1, 0],
        tintable: false,
        material: { roughness: 0.9 },
      }),
    ],
  },
  {
    id: "prim:robot",
    name: "Robot",
    category: "Fun",
    color: "#9fb8dd",
    bg: "#eef3fc",
    height: 1.3,
    build: () => [
      part(box(0.46, 0.36, 0.38), "#9fb8dd", { position: [0, 1.02, 0] }),
      part(box(0.34, 0.06, 0.02), "#3c3a4a", {
        position: [0, 1.05, 0.2],
        tintable: false,
        material: { roughness: 0.2, metalness: 0.4 },
      }),
      part(sphere(0.045), "#f7f5ff", {
        position: [-0.08, 1.06, 0.205],
        tintable: false,
      }),
      part(sphere(0.045), "#f7f5ff", {
        position: [0.08, 1.06, 0.205],
        tintable: false,
      }),
      part(cylinder(0.012, 0.012, 0.16, 10), "#8d89a6", {
        position: [0, 1.28, 0],
        tintable: false,
      }),
      part(sphere(0.05), "#f2a4a4", {
        position: [0, 1.37, 0],
        tintable: false,
      }),
      part(new THREE.CapsuleGeometry(0.22, 0.24, 8, 20), "#aec4e6", {
        position: [0, 0.62, 0],
      }),
      part(box(0.1, 0.34, 0.1), "#9fb8dd", {
        position: [-0.3, 0.62, 0],
        rotation: [0, 0, 0.16],
      }),
      part(box(0.1, 0.34, 0.1), "#9fb8dd", {
        position: [0.3, 0.62, 0],
        rotation: [0, 0, -0.16],
      }),
      part(box(0.13, 0.3, 0.14), "#8d89a6", {
        position: [-0.12, 0.18, 0],
        tintable: false,
      }),
      part(box(0.13, 0.3, 0.14), "#8d89a6", {
        position: [0.12, 0.18, 0],
        tintable: false,
      }),
      part(box(0.18, 0.05, 0.22), "#6f6b86", {
        position: [-0.12, 0.03, 0.02],
        tintable: false,
      }),
      part(box(0.18, 0.05, 0.22), "#6f6b86", {
        position: [0.12, 0.03, 0.02],
        tintable: false,
      }),
    ],
  },
  {
    id: "prim:heart",
    name: "Heart",
    category: "Fun",
    color: "#ef8fa4",
    bg: "#fdf0f3",
    height: 0.8,
    build: () => [
      part(heartShape(), "#ef8fa4", { material: { roughness: 0.4 } }),
    ],
  },
  {
    id: "prim:gift",
    name: "Gift",
    category: "Fun",
    color: "#b39ce4",
    bg: "#f5f0fd",
    height: 0.75,
    build: () => [
      part(box(0.62, 0.52, 0.62), "#b39ce4", { position: [0, 0.26, 0] }),
      part(box(0.64, 0.54, 0.12), "#f5cf74", {
        position: [0, 0.27, 0],
        tintable: false,
      }),
      part(box(0.12, 0.54, 0.64), "#f5cf74", {
        position: [0, 0.27, 0],
        tintable: false,
      }),
      part(new THREE.TorusGeometry(0.09, 0.032, 12, 26), "#f5cf74", {
        position: [-0.08, 0.57, 0],
        rotation: [Math.PI / 2, 0, 0.4],
        tintable: false,
      }),
      part(new THREE.TorusGeometry(0.09, 0.032, 12, 26), "#f5cf74", {
        position: [0.08, 0.57, 0],
        rotation: [Math.PI / 2, 0, -0.4],
        tintable: false,
      }),
    ],
  },
  {
    id: "prim:snowman",
    name: "Snowman",
    category: "Fun",
    color: "#f4f7ff",
    bg: "#f0f5fd",
    height: 1.35,
    build: () => [
      part(sphere(0.32, 30, 22), "#f4f7ff", { position: [0, 0.32, 0] }),
      part(sphere(0.24, 28, 20), "#f7faff", { position: [0, 0.72, 0] }),
      part(sphere(0.18, 26, 18), "#fbfcff", { position: [0, 1.02, 0] }),
      part(cone(0.045, 0.2, 14), "#f08b52", {
        position: [0, 1.01, 0.2],
        rotation: [Math.PI / 2, 0, 0],
        tintable: false,
      }),
      part(sphere(0.022), "#3c3a4a", {
        position: [-0.07, 1.08, 0.15],
        tintable: false,
      }),
      part(sphere(0.022), "#3c3a4a", {
        position: [0.07, 1.08, 0.15],
        tintable: false,
      }),
      part(sphere(0.028), "#3c3a4a", {
        position: [0, 0.76, 0.22],
        tintable: false,
      }),
      part(sphere(0.028), "#3c3a4a", {
        position: [0, 0.66, 0.225],
        tintable: false,
      }),
      part(cylinder(0.22, 0.22, 0.04, 26), "#4b4860", {
        position: [0, 1.17, 0],
        tintable: false,
      }),
      part(cylinder(0.13, 0.13, 0.16, 22), "#4b4860", {
        position: [0, 1.26, 0],
        tintable: false,
      }),
      part(box(0.42, 0.04, 0.04), "#b9865d", {
        position: [0.16, 0.86, 0.06],
        rotation: [0, 0, 0.6],
        tintable: false,
      }),
    ],
  },
];

const shapeById = new Map(SHAPES.map((shape) => [shape.id, shape]));

/** Asset descriptors registered in the shared model registry. */
export const SHAPE_ASSETS = SHAPES.map((shape) => ({
  id: shape.id,
  name: shape.name,
  category: shape.category,
  bg: shape.bg,
  color: shape.color,
  tag: "Ready-made shape",
  kind: "shape",
  shape: shape.id,
}));

export const FALLBACK_SHAPE = "prim:cube";

export function findShape(id) {
  return shapeById.get(id) || null;
}

/**
 * Build a ready-to-use Three.js group. The group is normalised so the shape is
 * `height` units tall and sits exactly on y = 0, matching how uploaded GLBs are
 * fitted by createGLBModel.
 */
export function createShape(id, tint) {
  const definition = findShape(id) || findShape(FALLBACK_SHAPE);
  const group = new THREE.Group();
  group.name = definition.name;
  group.userData.assetId = definition.id;
  group.userData.shape = true;

  const inner = new THREE.Group();
  definition.build().forEach((mesh) => inner.add(mesh));

  if (tint) {
    inner.traverse((object) => {
      if (!object.isMesh || object.userData.tintable === false) return;
      if (object.material?.color) object.material.color.set(tint);
    });
  }

  inner.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(inner);
  const size = bounds.getSize(new THREE.Vector3());
  const extent = size.y > 0.0001 ? size.y : Math.max(size.x, size.z, 0.1);
  inner.scale.setScalar(definition.height / extent);
  inner.updateMatrixWorld(true);

  const fitted = new THREE.Box3().setFromObject(inner);
  const centre = fitted.getCenter(new THREE.Vector3());
  inner.position.set(-centre.x, -fitted.min.y, -centre.z);
  inner.updateMatrixWorld(true);

  group.add(inner);
  group.userData.height = definition.height;
  group.userData.ready = Promise.resolve(group);
  return group;
}
