import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MousePointerClick } from "lucide-react";
import { buildPortal } from "../lib/portal-scene";
import { loadImage, markerUrl, portalStyle } from "../lib/portal";

// A small stage that shows the portal on the printed marker, exactly the way
// the camera session will place it. Drag to peek at it from different angles.
export default function PortalPreview({ portal, className = "" }) {
  const host = useRef(null);
  const built = useRef(null);
  const sceneRef = useRef(null);
  const imageCache = useRef(new Map());
  const [empty, setEmpty] = useState(!portal.marker);
  const [failed, setFailed] = useState("");

  const signature = [
    portal.marker,
    portal.style,
    portal.world,
    portal.width,
    portal.height,
    portal.depth,
    portal.glow,
    portal.sparkles,
    portal.resident,
    portal.flip,
  ].join("|");

  // Stage: renderer, camera, lights, marker card. Created once.
  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
    camera.position.set(0.9, 1.15, 1.2);

    scene.add(new THREE.HemisphereLight("#fffaf2", "#3b3352", 2.1));
    const key = new THREE.DirectionalLight("#fff6e8", 2.2);
    key.position.set(-1.6, 2.4, 1.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#b9a4ff", 1.1);
    rim.position.set(1.8, 1.2, -1.6);
    scene.add(rim);

    const world = new THREE.Group();
    world.rotation.x = -Math.PI / 2; // the printed card lies flat
    scene.add(world);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.7;
    controls.maxDistance = 3.4;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, -0.02, 0);
    controls.update();

    const clock = new THREE.Clock();
    const resize = () => {
      const width = element.clientWidth || 1;
      const height = element.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      if (built.current) built.current.portal.update(clock.elapsedTime, delta);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { world, camera, controls };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      if (built.current) {
        built.current.portal.dispose();
        built.current = null;
      }
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  // Rebuild the portal + marker card whenever the look changes.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const stage = sceneRef.current;
      if (!stage) return;
      let image = null;
      const url = markerUrl(portal);
      if (url) {
        if (imageCache.current.has(url)) image = imageCache.current.get(url);
        else {
          try {
            image = await loadImage(url);
            imageCache.current.set(url, image);
          } catch {
            image = null;
          }
        }
      }
      if (cancelled) return;
      setEmpty(!image);

      const markerWidth = 1;
      const markerHeight = image
        ? image.naturalHeight / image.naturalWidth
        : 1.4;

      const holder = new THREE.Group();
      const cardGeometry = new THREE.PlaneGeometry(markerWidth, markerHeight);
      if (image) {
        const texture = new THREE.CanvasTexture(image);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        cardGeometry.userData.texture = texture;
        holder.add(
          new THREE.Mesh(
            cardGeometry,
            new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
          ),
        );
      } else {
        holder.add(
          new THREE.Mesh(
            cardGeometry,
            new THREE.MeshBasicMaterial({ color: 0xe9e4f4 }),
          ),
        );
      }
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(markerWidth + 0.03, markerHeight + 0.03),
        new THREE.MeshBasicMaterial({ color: 0x2f2745 }),
      );
      edge.position.z = -0.004;
      const portalGroup = buildPortal(portal, { markerWidth, markerHeight });
      const card = holder.children[0];
      card.position.z = -0.002;
      const wrapper = new THREE.Group();
      wrapper.add(edge);
      wrapper.add(holder);
      wrapper.add(portalGroup.group);

      if (built.current) {
        stage.world.remove(built.current.wrapper);
        built.current.portal.dispose();
        built.current.wrapper.traverse((object) => {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : object.material
              ? [object.material]
              : [];
          materials.forEach((material) => {
            material.map?.dispose();
            material.dispose();
          });
        });
      }
      stage.world.add(wrapper);
      built.current = { wrapper, portal: portalGroup };

      const distance = Math.max(1.05, markerHeight * 1.02);
      stage.camera.position.set(distance * 0.6, distance * 1.0, distance * 0.9);
      stage.controls.target.set(0, -markerHeight * 0.03, 0);
      stage.controls.update();
      setFailed("");
    };

    run().catch((error) => setFailed(error.message || "Preview failed."));
    return () => {
      cancelled = true;
    };
  }, [signature]);

  const style = portalStyle(portal.style);

  return (
    <div
      className={`portal-stage ${className}`}
      style={{ "--glow": style.glow }}
    >
      <div className="portal-stage-host" ref={host} />
      {empty && (
        <div className="portal-stage-empty">
          <MousePointerClick size={22} />
          <strong>Your marker goes here</strong>
          <span>Upload a marker picture and the doorway opens on it.</span>
        </div>
      )}
      {failed && <p className="portal-stage-error">{failed}</p>}
      <span className="portal-stage-badge">Drag to look around</span>
    </div>
  );
}
