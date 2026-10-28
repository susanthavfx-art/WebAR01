// Original tiny fixtures used by the GLB browser tests. No third-party meshes.
// npm ci && node scripts/create-test-models.mjs
// This generator downloads a pinned Meshopt encoder for development only;
// the produced fixtures and application runtime do not require that download.
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as THREE from "three";
import { DRACOExporter } from "three/addons/exporters/DRACOExporter.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import sharp from "sharp";
const folder = "tests/fixtures";
await fs.mkdir(folder, { recursive: true });
function pad(buffer) {
  const result = Buffer.alloc(Math.ceil(buffer.length / 4) * 4);
  buffer.copy(result);
  return result;
}
function writeGLB(json, binary, name) {
  const text = Buffer.from(JSON.stringify(json)),
    textChunk = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(textChunk);
  const bin = pad(binary),
    header = Buffer.alloc(12),
    jsonHeader = Buffer.alloc(8),
    binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 16 + textChunk.length + bin.length, 8);
  jsonHeader.writeUInt32LE(textChunk.length);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(bin.length);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return fs.writeFile(
    `${folder}/${name}`,
    Buffer.concat([header, jsonHeader, textChunk, binHeader, bin]),
  );
}
const basic = () => ({
  asset: { version: "2.0", generator: "Wonderlab original test geometry" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  materials: [
    {
      pbrMetallicRoughness: {
        baseColorFactor: [0.46, 0.68, 0.56, 1],
        metallicFactor: 0,
        roughnessFactor: 0.7,
      },
    },
  ],
});
const box = new THREE.BoxGeometry(1, 1, 1),
  pos = box.attributes.position,
  norm = box.attributes.normal,
  uv = box.attributes.uv;
// Draco glTF mesh compression. The encoder is included with the pinned Three.
const encoderPath = path.resolve(
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_encoder.js",
  ),
  module = { exports: {} };
const factory = new Function(
  "module",
  "exports",
  "require",
  "__dirname",
  (await fs.readFile(encoderPath, "utf8")) + ";return module.exports;",
)(
  module,
  module.exports,
  createRequire(import.meta.url),
  path.dirname(encoderPath),
);
let runtime;
await new Promise((resolve) => {
  runtime = factory({
    onModuleLoaded: (value) => {
      runtime = value;
      resolve();
    },
  });
  if (runtime?.calledRun) resolve();
});
globalThis.DracoEncoderModule = () => runtime;
const compressed = Buffer.from(
    new DRACOExporter().parse(new THREE.Mesh(box), { exportUvs: false }).buffer,
  ),
  draco = basic();
draco.extensionsUsed = draco.extensionsRequired = [
  "KHR_draco_mesh_compression",
];
draco.buffers = [{ byteLength: compressed.length }];
draco.bufferViews = [
  { buffer: 0, byteOffset: 0, byteLength: compressed.length },
];
draco.accessors = [
  {
    componentType: 5126,
    count: pos.count,
    type: "VEC3",
    min: [-0.5, -0.5, -0.5],
    max: [0.5, 0.5, 0.5],
  },
  { componentType: 5126, count: norm.count, type: "VEC3" },
  { componentType: 5123, count: box.index.count, type: "SCALAR" },
];
draco.meshes = [
  {
    primitives: [
      {
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
        extensions: {
          KHR_draco_mesh_compression: {
            bufferView: 0,
            attributes: { POSITION: 0, NORMAL: 1 },
          },
        },
      },
    ],
  },
];
await writeGLB(draco, compressed, "draco-box.glb");
// Meshopt-compressed interleaved position/normal data, with indexed triangles.
const encoderUrl =
  "https://cdn.jsdelivr.net/npm/meshoptimizer@0.20.0/meshopt_encoder.module.js";
const response = await fetch(encoderUrl);
if (!response.ok)
  throw new Error("Could not download test-only Meshopt encoder.");
const encoderFile = path.resolve("node_modules/.wonderlab-meshopt-encoder.mjs");
await fs.writeFile(encoderFile, await response.text());
const { MeshoptEncoder } = await import(encoderFile);
await MeshoptEncoder.ready;
const interleaved = new Float32Array(pos.count * 6);
for (let i = 0; i < pos.count; i++)
  for (let j = 0; j < 3; j++) {
    interleaved[i * 6 + j] = pos.array[i * 3 + j];
    interleaved[i * 6 + j + 3] = norm.array[i * 3 + j];
  }
const packed = Buffer.from(
    MeshoptEncoder.encodeGltfBuffer(
      new Uint8Array(interleaved.buffer),
      pos.count,
      24,
      "ATTRIBUTES",
    ),
  ),
  indices = Buffer.from(box.index.array.buffer);
const fallback = Buffer.alloc(interleaved.byteLength),
  meshoptBinary = Buffer.concat([fallback, indices, packed]),
  meshopt = basic();
meshopt.extensionsUsed = meshopt.extensionsRequired = [
  "EXT_meshopt_compression",
];
meshopt.buffers = [{ byteLength: meshoptBinary.length }];
meshopt.bufferViews = [
  {
    buffer: 0,
    byteOffset: 0,
    byteLength: interleaved.byteLength,
    byteStride: 24,
    target: 34962,
    extensions: {
      EXT_meshopt_compression: {
        buffer: 0,
        byteOffset: fallback.length + indices.length,
        byteLength: packed.length,
        byteStride: 24,
        count: pos.count,
        mode: "ATTRIBUTES",
        filter: "NONE",
      },
    },
  },
  {
    buffer: 0,
    byteOffset: fallback.length,
    byteLength: indices.length,
    target: 34963,
  },
];
meshopt.accessors = [
  {
    bufferView: 0,
    byteOffset: 0,
    componentType: 5126,
    count: pos.count,
    type: "VEC3",
    min: [-0.5, -0.5, -0.5],
    max: [0.5, 0.5, 0.5],
  },
  {
    bufferView: 0,
    byteOffset: 12,
    componentType: 5126,
    count: norm.count,
    type: "VEC3",
  },
  {
    bufferView: 1,
    componentType: 5123,
    count: box.index.count,
    type: "SCALAR",
  },
];
meshopt.meshes = [
  {
    primitives: [
      { attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 },
    ],
  },
];
await writeGLB(meshopt, meshoptBinary, "meshopt-box.glb");
// A standard PBR material with an embedded PNG; no canvas needed to generate it.
const pixels = Buffer.alloc(8 * 8 * 4);
for (let i = 0; i < 64; i++) {
  const on = i % 8 < 4 !== Math.floor(i / 8) < 4;
  pixels.set(on ? [240, 180, 112, 255] : [134, 184, 166, 255], i * 4);
}
const png = await sharp(pixels, { raw: { width: 8, height: 8, channels: 4 } })
    .png()
    .toBuffer(),
  textured = basic();
const sections = [
  Buffer.from(pos.array.buffer),
  Buffer.from(norm.array.buffer),
  Buffer.from(uv.array.buffer),
  indices,
  png,
];
let offset = 0;
textured.bufferViews = sections.map((part, i) => {
  const result = {
    buffer: 0,
    byteOffset: offset,
    byteLength: part.length,
    ...(i < 3 ? { target: 34962 } : i === 3 ? { target: 34963 } : {}),
  };
  offset += pad(part).length;
  return result;
});
textured.buffers = [{ byteLength: offset }];
textured.accessors = [
  {
    bufferView: 0,
    componentType: 5126,
    count: pos.count,
    type: "VEC3",
    min: [-0.5, -0.5, -0.5],
    max: [0.5, 0.5, 0.5],
  },
  { bufferView: 1, componentType: 5126, count: norm.count, type: "VEC3" },
  { bufferView: 2, componentType: 5126, count: uv.count, type: "VEC2" },
  {
    bufferView: 3,
    componentType: 5123,
    count: box.index.count,
    type: "SCALAR",
  },
];
textured.images = [{ bufferView: 4, mimeType: "image/png" }];
textured.textures = [{ source: 0 }];
textured.materials[0].pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
textured.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
textured.meshes = [
  {
    primitives: [
      {
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0,
      },
    ],
  },
];
await writeGLB(textured, Buffer.concat(sections.map(pad)), "textured-box.glb");
// A two-bone skinned mesh with its own embedded animation.
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader ??= NodeFileReader;
const geometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8, 2);
geometry.translate(0, 0.5, 0);
const skinIndices = [],
  weights = [];
for (let i = 0; i < geometry.attributes.position.count; i++) {
  skinIndices.push(geometry.attributes.position.getY(i) > 0.5 ? 1 : 0, 0, 0, 0);
  weights.push(1, 0, 0, 0);
}
geometry.setAttribute(
  "skinIndex",
  new THREE.Uint16BufferAttribute(skinIndices, 4),
);
geometry.setAttribute(
  "skinWeight",
  new THREE.Float32BufferAttribute(weights, 4),
);
const root = new THREE.Bone();
root.name = "StemBase";
const tip = new THREE.Bone();
tip.name = "StemTip";
tip.position.y = 0.5;
root.add(tip);
const skin = new THREE.SkinnedMesh(
  geometry,
  new THREE.MeshStandardMaterial({ color: "#9eafd5", roughness: 0.6 }),
);
skin.name = "FlexibleStem";
skin.add(root);
skin.bind(new THREE.Skeleton([root, tip]));
const rotations = [0, 0.6, 0, -0.6, 0].flatMap((a) =>
    new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), a)
      .toArray(),
  ),
  clip = new THREE.AnimationClip("Sway", 2, [
    new THREE.QuaternionKeyframeTrack(
      "StemTip.quaternion",
      [0, 0.5, 1, 1.5, 2],
      rotations,
    ),
  ]);
const group = new THREE.Group();
group.add(skin);
await fs.writeFile(
  `${folder}/skinned-stem.glb`,
  Buffer.from(
    await new GLTFExporter().parseAsync(group, {
      binary: true,
      animations: [clip],
    }),
  ),
);
await fs.rm(`${folder}/box.drc`, { force: true });
for (const file of await fs.readdir(folder))
  console.log(file, (await fs.stat(`${folder}/${file}`)).size, "bytes");
