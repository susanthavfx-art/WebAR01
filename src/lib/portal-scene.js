// Builds the actual doorway geometry. The same builder is used by the live
// preview in the workshop and by the MindAR camera session, so what you see in
// the browser is exactly what appears on your marker.
import * as THREE from "three";
import { createShape } from "./shapes";
import { portalStyle, portalWorld, residentShapeId } from "./portal";
import {
  paintFloor,
  paintGlyphs,
  paintHalo,
  paintSparkle,
  paintTunnel,
  paintWorldBackdrop,
} from "./portal-paint";

const ARCH_STEPS = 40;

function archShape(width, height, inset = 0) {
  const w = Math.max(0.05, width - inset * 2);
  const h = Math.max(0.08, height - inset * 2);
  const r = Math.min(w / 2, h * 0.9);
  const bottom = -height / 2 + inset;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, bottom);
  shape.lineTo(w / 2, bottom);
  shape.lineTo(w / 2, bottom + h - r);
  shape.absarc(0, bottom + h - r, r, 0, Math.PI, false);
  shape.lineTo(-w / 2, bottom);
  return shape;
}

function canvasTexture(canvas, { repeat = false, clamp = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (clamp) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

function archCurve(width, height, z) {
  const shape = archShape(width, height);
  const points = shape.getPoints(ARCH_STEPS).map((point) => {
    const vector = new THREE.Vector3(point.x, point.y, z);
    return vector;
  });
  points.push(points[0].clone());
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.1);
}

function sparkleField(count, width, height, depth, color, random) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (random() - 0.5) * width * 0.92;
    positions[i * 3 + 1] = (random() - 0.5) * height * 0.92;
    positions[i * 3 + 2] = -random() * depth;
    seeds[i] = random();
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: Math.max(0.02, width * 0.055),
    map: canvasTexture(paintSparkle(color)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
    color: new THREE.Color(color),
  });
  const points = new THREE.Points(geometry, material);
  points.userData.seeds = seeds;
  return points;
}

export function buildPortal(portal, options = {}) {
  const style = portalStyle(portal.style);
  const world = portalWorld(portal.world);
  const markerWidth = options.markerWidth || 1;
  const markerHeight = options.markerHeight || 1;
  const glow = Math.max(0.15, portal.glow);
  const random = (() => {
    let state = 0x9e3779b9;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    };
  })();

  // The doorway is fitted to the card with a small margin so the frame never
  // floats off the printed artwork.
  const maxW = markerWidth * 0.94;
  const maxH = markerHeight * 0.94;
  let width = Math.min(portal.width, maxW);
  let height = Math.min(Math.max(portal.height, width * 0.68), maxH);
  if (height > maxH) {
    width *= maxH / height;
    height = maxH;
  }
  const depth = Math.min(height * 1.5, Math.max(0.12, portal.depth * width));

  const group = new THREE.Group();
  group.name = "ar-portal";
  const disposables = [];
  const keep = (item) => {
    disposables.push(item);
    return item;
  };

  const backdropTexture = keep(
    canvasTexture(
      paintWorldBackdrop(portal.world, 720, Math.round((720 * height) / width)),
    ),
  );
  const tunnelTexture = keep(
    canvasTexture(paintTunnel(world.palette[1], world.palette[3])),
  );
  const sideTunnelTexture = keep(
    canvasTexture(paintTunnel(world.palette[1], world.palette[3], "x")),
  );
  const floorTexture = keep(
    canvasTexture(paintFloor(world.palette[1], world.palette[3])),
  );

  // --- the world inside the doorway -------------------------------------
  const well = new THREE.Group();
  well.name = "portal-world";
  group.add(well);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: backdropTexture, toneMapped: false }),
  );
  backdrop.position.z = -depth;
  well.add(backdrop);

  const wallMaterial = (texture, tint) =>
    new THREE.MeshBasicMaterial({
      map: texture,
      color: tint,
      toneMapped: false,
    });
  const shade = new THREE.Color(0.42, 0.42, 0.5);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: floorTexture,
      color: 0xffffff,
      toneMapped: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -height / 2, -depth / 2);
  well.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    wallMaterial(tunnelTexture, shade),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, height / 2, -depth / 2);
  well.add(ceiling);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, height),
      wallMaterial(sideTunnelTexture, shade),
    );
    wall.rotation.y = (side * Math.PI) / 2;
    wall.position.set((side * width) / 2, 0, -depth / 2);
    well.add(wall);
  }

  // --- the frame ---------------------------------------------------------
  const thickness = Math.max(0.035, width * 0.075);
  const outerWidth = width + thickness * 2;
  const outerHeight = height + thickness * 2;
  const ringShape = archShape(outerWidth, outerHeight);
  const holePath = new THREE.Path(
    archShape(width, height).getPoints(ARCH_STEPS).reverse(),
  );
  ringShape.holes.push(holePath);

  const frameGeometry = keep(
    new THREE.ExtrudeGeometry(ringShape, {
      depth: thickness * 0.7,
      bevelEnabled: true,
      bevelSize: thickness * 0.16,
      bevelThickness: thickness * 0.16,
      bevelSegments: 2,
      curveSegments: 12,
    }),
  );
  const frameMaterial = keep(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(style.frame),
      roughness: style.id === "neon" ? 0.35 : 0.82,
      metalness: style.id === "neon" ? 0.6 : 0.12,
      emissive: new THREE.Color(style.trim),
      emissiveIntensity: 0.08 + glow * 0.16,
    }),
  );
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.z = -thickness * 0.1;
  group.add(frame);

  // Glowing rim: a light tube running around the outer arch.
  const rimCurve = archCurve(outerWidth, outerHeight, thickness * 0.42);
  const rimGeometry = keep(
    new THREE.TubeGeometry(
      rimCurve,
      ARCH_STEPS * 3,
      Math.max(0.008, width * 0.014),
      8,
      true,
    ),
  );
  const rimMaterial = keep(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(style.glow),
      transparent: true,
      opacity: 0.55 + glow * 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  group.add(new THREE.Mesh(rimGeometry, rimMaterial));

  // Soft halo spilling from the frame onto the card.
  const haloCanvas = paintHalo(style.glow, outerWidth / outerHeight);
  const haloTexture = keep(canvasTexture(haloCanvas));
  const haloMaterial = keep(
    new THREE.MeshBasicMaterial({
      map: haloTexture,
      transparent: true,
      opacity: 0.35 + glow * 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(outerWidth * 1.9, outerHeight * 1.9),
    haloMaterial,
  );
  halo.position.z = 0.004;
  group.add(halo);

  // --- style-specific decoration ----------------------------------------
  const decorations = new THREE.Group();
  group.add(decorations);
  const decorationParts = [];

  if (style.id === "runes") {
    const glyphTexture = keep(canvasTexture(paintGlyphs(style.glow)));
    const glyphs = new THREE.Mesh(
      new THREE.PlaneGeometry(outerWidth * 1.25, outerWidth * 1.25),
      keep(
        new THREE.MeshBasicMaterial({
          map: glyphTexture,
          transparent: true,
          opacity: 0.35 + glow * 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      ),
    );
    glyphs.position.z = 0.012;
    group.add(glyphs);
    decorationParts.push({ mesh: glyphs, spin: 0.14, bob: 0 });
  }

  if (style.id === "crystal" || style.id === "neon") {
    const shardMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(style.trim),
        emissive: new THREE.Color(style.glow),
        emissiveIntensity: 0.5 + glow * 0.8,
        roughness: 0.2,
        metalness: 0.35,
        transparent: true,
        opacity: 0.92,
        flatShading: true,
      }),
    );
    const count = style.id === "neon" ? 8 : 12;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius =
        style.id === "neon" ? outerWidth * 0.62 : outerWidth * 0.55;
      const shard = new THREE.Mesh(
        keep(new THREE.OctahedronGeometry(width * (0.03 + random() * 0.03), 0)),
        shardMaterial,
      );
      shard.position.set(
        Math.cos(angle) * radius,
        (Math.sin(angle) * radius) / (outerWidth / outerHeight),
        0.02 + random() * 0.03,
      );
      shard.rotation.set(random() * 3, random() * 3, random() * 3);
      shard.userData.baseY = shard.position.y;
      shard.userData.phase = random() * Math.PI * 2;
      decorations.add(shard);
      decorationParts.push({
        mesh: shard,
        spin: 0.5,
        bob: 0.012 + random() * 0.02,
      });
    }
  }

  if (style.id === "jungle") {
    const leafMaterial = keep(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(style.trim),
        roughness: 0.7,
        metalness: 0.05,
        emissive: new THREE.Color(style.glow),
        emissiveIntensity: 0.12,
        side: THREE.DoubleSide,
      }),
    );
    const count = 16;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius = outerWidth * (0.5 + random() * 0.12);
      const leaf = new THREE.Mesh(
        keep(new THREE.SphereGeometry(width * (0.035 + random() * 0.03), 8, 6)),
        leafMaterial,
      );
      leaf.scale.set(1, 0.28, 1.7 + random() * 0.8);
      leaf.position.set(
        Math.cos(angle) * radius,
        (Math.sin(angle) * radius) / (outerWidth / outerHeight),
        0.015 + random() * 0.04,
      );
      leaf.rotation.set(0, 0, angle + (random() - 0.5) * 0.7);
      leaf.userData.baseY = leaf.position.y;
      leaf.userData.phase = random() * Math.PI * 2;
      decorations.add(leaf);
      decorationParts.push({
        mesh: leaf,
        spin: 0,
        bob: 0.006 + random() * 0.01,
      });
    }
  }

  // --- sparkles rising out of the doorway --------------------------------
  let sparkles = null;
  if (portal.sparkles) {
    sparkles = sparkleField(
      Math.round(30 + glow * 26),
      width,
      height,
      depth,
      style.glow,
      random,
    );
    group.add(sparkles);
  }

  // --- the resident ------------------------------------------------------
  let resident = null;
  const shapeId = residentShapeId(portal.resident);
  if (shapeId) {
    const holder = new THREE.Group();
    holder.position.z = -depth * 0.72;
    const shape = createShape(shapeId);
    shape.userData.ready?.then?.((ready) => {
      const box = new THREE.Box3().setFromObject(ready);
      const size = box.getSize(new THREE.Vector3());
      const target = height * 0.46;
      const scale = size.y ? target / size.y : 1;
      ready.scale.setScalar(scale);
      ready.position.set(0, 0, 0);
    });
    // Shapes are built standing on y = 0, so turn them to stand out of the card.
    holder.rotation.x = Math.PI / 2;
    holder.add(shape);
    group.add(holder);
    resident = holder;
  }

  // Some marker image orientations end up mirrored on a phone; a half turn
  // about the doorway normal fixes that in one tap.
  if (portal.flip) group.rotation.z = Math.PI;
  const state = { spin: 0 };

  function update(elapsed, delta = 0.016) {
    state.spin += delta;
    for (const part of decorationParts) {
      if (part.spin) part.mesh.rotation.z += delta * part.spin;
      if (part.bob)
        part.mesh.position.y =
          part.mesh.userData.baseY +
          Math.sin(state.spin * 1.3 + part.mesh.userData.phase) * part.bob;
    }
    const pulse = 0.82 + Math.sin(elapsed * 2.1) * 0.18;
    haloMaterial.opacity = (0.28 + glow * 0.5) * pulse;
    rimMaterial.opacity =
      (0.45 + glow * 0.45) * (0.85 + Math.sin(elapsed * 2.1 + 0.6) * 0.15);
    halo.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.015);
    frameMaterial.emissiveIntensity =
      0.07 + glow * 0.16 + Math.sin(elapsed * 2.1) * 0.03;

    if (sparkles) {
      const attribute = sparkles.geometry.getAttribute("position");
      const seeds = sparkles.userData.seeds;
      for (let i = 0; i < attribute.count; i += 1) {
        const seed = seeds[i];
        const travel = (state.spin * (0.12 + seed * 0.22) + seed) % 1;
        attribute.setZ(i, -depth * (1 - travel));
        attribute.setX(
          i,
          Math.sin(state.spin * 0.8 + seed * 9) * width * 0.4 +
            (seed - 0.5) * width * 0.1,
        );
        attribute.setY(
          i,
          Math.cos(state.spin * 0.6 + seed * 7) * height * 0.34 +
            (seed - 0.5) * height * 0.1,
        );
      }
      attribute.needsUpdate = true;
      sparkles.material.opacity = 0.55 + glow * 0.4;
    }

    if (resident) {
      resident.rotation.z = state.spin * 0.35;
      resident.position.z =
        -depth * 0.72 + Math.sin(state.spin * 1.2) * height * 0.012;
    }
  }

  function dispose() {
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      materials.forEach((material) => {
        if (material.map && !disposables.includes(material.map))
          material.map.dispose();
        material.dispose();
      });
    });
    disposables.forEach((item) => item.dispose?.());
    group.removeFromParent();
  }

  return {
    group,
    update,
    dispose,
    size: { width, height, depth, thickness },
    markerSpace: { width: markerWidth, height: markerHeight },
  };
}
