// Original, self-contained GLB 2.0 sample with one looping arm animation.
// Run: node scripts/create-sample-model.mjs (requires npm ci).
// No source model, third-party textures, browser or additional packages required.
import fs from "node:fs/promises";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader ??= NodeFileReader;
const robot = new THREE.Group();
robot.name = "WonderBot";
const palette = {};
const material = (colour) =>
  (palette[colour] ||= new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.57,
    metalness: 0.04,
  }));
function part(parent, name, geometry, colour, position) {
  const mesh = new THREE.Mesh(geometry, material(colour));
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function round(parent, name, size, colour, position, radius = 0.06) {
  return part(
    parent,
    name,
    new RoundedBoxGeometry(...size, 2, radius),
    colour,
    position,
  );
}
function ball(parent, name, radius, colour, position) {
  return part(
    parent,
    name,
    new THREE.SphereGeometry(radius, 16, 12),
    colour,
    position,
  );
}
function rod(parent, name, radius, length, colour, position) {
  return part(
    parent,
    name,
    new THREE.CylinderGeometry(radius, radius, length, 16),
    colour,
    position,
  );
}
for (const [side, x] of [
  ["Left", -0.18],
  ["Right", 0.18],
]) {
  round(
    robot,
    side + "Shoe",
    [0.26, 0.16, 0.34],
    "#aa99ce",
    [x, 0.08, 0.04],
    0.045,
  );
  rod(robot, side + "Leg", 0.055, 0.3, "#c2d6c9", [x, 0.3, 0]);
}
round(robot, "MintBody", [0.64, 0.65, 0.4], "#8bbba8", [0, 0.8, 0]);
round(
  robot,
  "ChestPanel",
  [0.38, 0.37, 0.035],
  "#f8ead6",
  [0, 0.83, 0.211],
  0.035,
);
ball(robot, "HeartLight", 0.07, "#ebad87", [0, 0.91, 0.245]);
for (let i = 0; i < 3; i++)
  ball(robot, `Control${i}`, 0.018, ["#aa99ce", "#8bbba8", "#e5ba6d"][i], [
    (i - 1) * 0.085,
    0.73,
    0.24,
  ]);
rod(robot, "Neck", 0.085, 0.2, "#d4c6df", [0, 1.16, 0]);
round(robot, "CreamHead", [0.73, 0.48, 0.46], "#f8ead6", [0, 1.44, 0], 0.085);
round(
  robot,
  "FaceDisplay",
  [0.55, 0.27, 0.035],
  "#465c63",
  [0, 1.45, 0.235],
  0.048,
);
ball(robot, "LeftEye", 0.042, "#f8ead6", [-0.13, 1.49, 0.263]);
ball(robot, "RightEye", 0.042, "#f8ead6", [0.13, 1.49, 0.263]);
const smile = part(
  robot,
  "Smile",
  new THREE.TorusGeometry(0.065, 0.012, 8, 20, Math.PI),
  "#f8ead6",
  [0, 1.41, 0.264],
);
smile.rotation.z = Math.PI;
rod(robot, "Antenna", 0.018, 0.17, "#aa99ce", [0, 1.76, 0]);
ball(robot, "AntennaLight", 0.065, "#e5ba6d", [0, 1.875, 0]);
let wavingArm;
for (const [side, x, angle] of [
  ["Left", -0.4, -0.22],
  ["Right", 0.4, 1.9],
]) {
  const pivot = new THREE.Group();
  pivot.name = side === "Right" ? "WaveArm" : "LeftArm";
  pivot.position.set(x, 1.02, 0);
  pivot.rotation.z = angle;
  robot.add(pivot);
  ball(pivot, side + "Shoulder", 0.085, "#aa99ce", [0, 0, 0]);
  rod(pivot, side + "Forearm", 0.052, 0.28, "#c2d6c9", [0, -0.17, 0]);
  ball(pivot, side + "Hand", 0.092, "#8bbba8", [0, -0.35, 0]);
  if (side === "Right") wavingArm = pivot;
}
const rotations = [1.9, 2.6, 1.7, 2.6, 1.9].flatMap((angle) =>
  new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle)
    .toArray(),
);
const clip = new THREE.AnimationClip("A friendly wave", 2, [
  new THREE.QuaternionKeyframeTrack(
    wavingArm.name + ".quaternion",
    [0, 0.5, 1, 1.5, 2],
    rotations,
  ),
]);
const result = await new GLTFExporter().parseAsync(robot, {
  binary: true,
  animations: [clip],
  onlyVisible: true,
});
await fs.mkdir("public/models", { recursive: true });
await fs.writeFile("public/models/wonder-bot.glb", Buffer.from(result));
console.log(
  `Created public/models/wonder-bot.glb: ${result.byteLength} bytes, one embedded animation.`,
);
