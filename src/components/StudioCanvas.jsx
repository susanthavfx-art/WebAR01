import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  createAsset,
  applyObjectTransform,
  addLights,
  disposeGroup,
  getMarker,
  tickModel,
} from "../lib/assets";
import {
  actionOffsets,
  isActing,
  playAction,
  setIdleClip,
  stopActions,
  validIdleClip,
} from "../lib/model-actions";
import { CardOverlay, positionCards } from "./LessonCards";
import { ActionBar } from "./ModelActions";

const StudioCanvas = forwardRef(function StudioCanvas(
  {
    project,
    selectedId,
    onSelect,
    onTransform,
    onDropAsset,
    tool = "select",
    grid = true,
    markerVisible = false,
    markerImage = "",
    playing = false,
    viewOnly = false,
    onReady,
    cards = [],
    cardMode = "view",
    onSelectCard,
    onMoveCard,
    onOpenCard,
    pickMode = null,
    onPickPoint,
    compactCards = false,
    showActions = false,
    onSoundError,
  },
  ref,
) {
  const host = useRef(null),
    engine = useRef(null),
    props = useRef({}),
    [error, setError] = useState(""),
    [modelSummary, setModelSummary] = useState({ loading: 0, errors: [] }),
    [looping, setLooping] = useState({}),
    cardRegistry = useRef({});
  props.current = {
    project,
    selectedId,
    onSelect,
    onTransform,
    onDropAsset,
    tool,
    grid,
    markerVisible,
    playing,
    viewOnly,
    cards,
    cardMode,
    onSelectCard,
    onMoveCard,
    pickMode,
    onPickPoint,
    showActions,
    onSoundError,
  };
  function runAction(objectId, action) {
    const e = engine.current;
    const group = e?.models.get(objectId)?.group;
    if (!group || !action) return "none";
    const result = playAction(group, action, (error) =>
      props.current.onSoundError?.(error, action),
    );
    setLooping((current) => {
      const next = { ...current };
      if (result === "loop") next[objectId] = action.id;
      else delete next[objectId];
      return next;
    });
    e.requestRender();
    return result;
  }
  props.current.runAction = runAction;
  useImperativeHandle(
    ref,
    () => ({
      reset() {
        const e = engine.current;
        if (!e) return;
        e.controls.target.set(0, 0.65, 0);
        e.camera.position
          .copy(e.controls.target)
          .add(
            new THREE.Vector3(7.2, 5.05, 8.2).multiplyScalar(e.fitFactor || 1),
          );
        e.controls.update();
      },
      zoom(factor) {
        const e = engine.current;
        if (!e) return;
        const d = e.camera.position
          .clone()
          .sub(e.controls.target)
          .multiplyScalar(factor);
        d.clampLength(4, 29);
        e.camera.position.copy(e.controls.target).add(d);
        e.controls.update();
      },
      playAction(objectId, action) {
        return props.current.runAction(objectId, action);
      },
      stopActions() {
        engine.current?.models.forEach((m) => stopActions(m.group));
        setLooping({});
      },
      capture() {
        try {
          const e = engine.current;
          e.renderer.render(e.scene, e.camera);
          return e.renderer.domElement.toDataURL("image/png");
        } catch {
          return "";
        }
      },
    }),
    [],
  );
  useEffect(() => {
    const container = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "Your browser could not start 3D. Try a recent Chrome, Safari or Firefox browser with WebGL enabled.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D workspace. Use the object properties panel to move, rotate and resize objects.",
    );
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    camera.position.set(7.2, 5.7, 8.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.65, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 29;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.update();
    addLights(scene);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.09 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.25;
    ground.receiveShadow = true;
    scene.add(ground);
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3.08, 3.08, 0.15, 100),
      [
        new THREE.MeshStandardMaterial({ color: "#ded7ed", roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: "#f5f1fc", roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: "#ded7ed", roughness: 0.8 }),
      ],
    );
    stage.position.y = -0.15;
    stage.receiveShadow = true;
    scene.add(stage);
    const lines = new THREE.Group();
    for (const r of [1.02, 1.95, 2.75]) {
      const points = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * r, -0.07, Math.sin(a) * r));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({
          color: "#dcd3eb",
          dashSize: 0.055,
          gapSize: 0.055,
          transparent: true,
          opacity: 0.85,
        }),
      );
      line.computeLineDistances();
      lines.add(line);
    }
    scene.add(lines);
    const gridHelper = new THREE.GridHelper(24, 48, "#dcd5e7", "#e8e2ee");
    gridHelper.position.y = -0.246;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.65;
    scene.add(gridHelper);
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = -0.063;
    marker.visible = false;
    scene.add(marker);
    const selection = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 0.82, 80),
      new THREE.MeshBasicMaterial({
        color: "#9878e2",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    selection.rotation.x = -Math.PI / 2;
    selection.visible = false;
    scene.add(selection);
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSize(0.7);
    scene.add(transform);
    const models = new Map();
    let needsRender = true;
    const e = {
      renderer,
      scene,
      camera,
      controls,
      transform,
      models,
      gridHelper,
      marker,
      selection,
      dragging: false,
      requestRender: () => {
        needsRender = true;
      },
    };
    engine.current = e;
    const cardPlane = new THREE.Plane(),
      cardHit = new THREE.Vector3();
    e.startCardDrag = (card, event) => {
      props.current.onSelectCard?.(card.id);
      pointerStart = null;
      if (!event || props.current.cardMode !== "edit") return;
      event.preventDefault();
      event.stopPropagation();
      const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
      const start = new THREE.Vector3().fromArray(card.position);
      cardPlane.setFromNormalAndCoplanarPoint(normal, start);
      pointerFor(event);
      if (!raycaster.ray.intersectPlane(cardPlane, cardHit)) return;
      e.cardDrag = {
        id: card.id,
        x: event.clientX,
        y: event.clientY,
        offset: start.clone().sub(cardHit),
        position: null,
      };
      controls.enabled = false;
      const move = (ev) => {
        const drag = e.cardDrag;
        if (!drag) return;
        if (
          !drag.position &&
          Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 4
        )
          return;
        pointerFor(ev);
        if (!raycaster.ray.intersectPlane(cardPlane, cardHit)) return;
        const p = cardHit.clone().add(drag.offset);
        drag.position = [
          Math.max(-6, Math.min(6, p.x)),
          Math.max(-0.5, Math.min(6, p.y)),
          Math.max(-6, Math.min(6, p.z)),
        ];
        needsRender = true;
      };
      const end = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        const drag = e.cardDrag;
        e.cardDrag = null;
        controls.enabled = true;
        if (drag?.position)
          props.current.onMoveCard?.(
            drag.id,
            drag.position.map((v) => Math.round(v * 100) / 100),
          );
        needsRender = true;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };
    controls.addEventListener("change", () => {
      needsRender = true;
    });
    transform.addEventListener("change", () => {
      needsRender = true;
      renderer.shadowMap.needsUpdate = true;
    });
    transform.addEventListener("dragging-changed", (ev) => {
      controls.enabled = !ev.value;
      e.dragging = ev.value;
    });
    transform.addEventListener("objectChange", () => {
      if (props.current.tool === "scale" && transform.object) {
        const model = transform.object;
        const axis = transform.axis || "XYZ";
        const value =
          axis === "Y"
            ? model.scale.y
            : axis === "Z"
              ? model.scale.z
              : model.scale.x;
        model.scale.setScalar(Math.max(0.15, Math.min(2.5, value)));
      }
      needsRender = true;
      renderer.shadowMap.needsUpdate = true;
    });
    transform.addEventListener("mouseUp", () => {
      const selected = models.get(props.current.selectedId)?.group;
      if (selected) {
        props.current.onTransform?.(props.current.selectedId, {
          position: selected.position
            .toArray()
            .map((v) => Math.round(v * 100) / 100),
          rotation: [
            selected.rotation.x,
            selected.rotation.y,
            selected.rotation.z,
          ].map((v) => Math.round((v * 180) / Math.PI)),
          scale: Math.max(
            0.15,
            Math.min(2.5, Math.round(selected.scale.x * 100) / 100),
          ),
        });
      }
    });
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const pointerFor = (event) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        -((event.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };
    let pointerStart = null;
    const down = (ev) => {
      pointerStart = { x: ev.clientX, y: ev.clientY, wasDragging: e.dragging };
    };
    const tapAction = (ev) => {
      const p = props.current;
      if (!p.showActions || !(p.viewOnly || p.playing)) return false;
      pointerFor(ev);
      const hit = raycaster.intersectObjects(
        [...models.values()].map((m) => m.group).filter((g) => g.visible),
        true,
      )[0];
      let target = hit?.object;
      while (target && !target.userData.objectId) target = target.parent;
      const object = p.project.objects.find(
        (o) => o.id === target?.userData.objectId,
      );
      if (!object?.actions?.length) return false;
      p.runAction(object.id, object.actions[0]);
      return true;
    };
    const up = (ev) => {
      const started = pointerStart;
      pointerStart = null;
      if (
        started &&
        !e.dragging &&
        !started.wasDragging &&
        Math.hypot(ev.clientX - started.x, ev.clientY - started.y) <= 5 &&
        !props.current.pickMode &&
        tapAction(ev)
      )
        return;
      if (
        props.current.viewOnly ||
        !started ||
        e.dragging ||
        started.wasDragging ||
        Math.hypot(ev.clientX - started.x, ev.clientY - started.y) > 5
      )
        return;
      if (transform.axis) return;
      pointerFor(ev);
      if (props.current.pickMode) {
        const hit = raycaster.intersectObjects(
          [...models.values()].map((m) => m.group).filter((g) => g.visible),
          true,
        )[0];
        let target = hit?.object;
        while (target && !target.userData.objectId) target = target.parent;
        if (hit && target) {
          const local = target.worldToLocal(hit.point.clone());
          props.current.onPickPoint?.(
            target.userData.objectId,
            local.toArray().map((v) => Math.round(v * 1000) / 1000),
          );
        }
        return;
      }
      const hits = raycaster.intersectObjects(
        [...models.values()].map((m) => m.group).filter((g) => g.visible),
        true,
      );
      if (hits[0]) {
        let target = hits[0].object;
        while (target && !target.userData.objectId) target = target.parent;
        props.current.onSelect?.(target?.userData.objectId || null);
      } else props.current.onSelect?.(null);
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    const dragover = (ev) => {
      if (!props.current.viewOnly) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "copy";
        container.classList.add("dragging-asset");
      }
    };
    const dragleave = () => container.classList.remove("dragging-asset");
    const drop = (ev) => {
      ev.preventDefault();
      dragleave();
      const id = ev.dataTransfer.getData("wonderlab/asset");
      if (id) {
        pointerFor(ev);
        const pos = new THREE.Vector3();
        raycaster.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
          pos,
        );
        props.current.onDropAsset?.(id, [
          Math.max(-2.2, Math.min(2.2, pos.x)),
          0,
          Math.max(-2.2, Math.min(2.2, pos.z)),
        ]);
      }
    };
    container.addEventListener("dragover", dragover);
    container.addEventListener("dragleave", dragleave);
    container.addEventListener("drop", drop);
    const resize = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const fit = Math.max(1, Math.min(2.2, 1.25 / camera.aspect));
      const offset = camera.position
        .clone()
        .sub(controls.target)
        .multiplyScalar(fit / (e.fitFactor || 1));
      camera.position.copy(controls.target).add(offset);
      e.fitFactor = fit;
      camera.updateProjectionMatrix();
      controls.update();
      needsRender = true;
    });
    resize.observe(container);
    let frame,
      lastFrame = 0;
    const start = performance.now();
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      if (document.hidden || now - lastFrame < 32) return;
      const delta = (now - lastFrame) / 1000;
      lastFrame = now;
      const t = (now - start) / 1000;
      controls.update();
      const p = props.current;
      let acting = false;
      for (const m of models.values()) if (isActing(m.group)) acting = true;
      if (!needsRender && !p.playing && !e.dragging && !e.cardDrag && !acting)
        return;
      if ((p.playing || acting) && !e.dragging) {
        p.project.objects.forEach((o, i) => {
          const m = models.get(o.id)?.group;
          if (!m || !(p.playing || isActing(m))) return;
          if (m.visible) tickModel(m, delta);
          const fx = actionOffsets(m, now / 1000);
          m.position.y =
            o.position[1] +
            (p.playing && o.animation === "float"
              ? Math.sin(t * 1.6 + i) * 0.12
              : 0) +
            fx.y * o.scale;
          m.rotation.y =
            (o.rotation[1] * Math.PI) / 180 +
            (p.playing && o.animation === "spin" ? t * 0.28 : 0) +
            fx.rot;
          m.rotation.z = (o.rotation[2] * Math.PI) / 180 + fx.tilt;
          m.scale.setScalar(o.scale * fx.scale);
        });
      }
      if (selection.visible && p.selectedId) {
        const m = models.get(p.selectedId)?.group;
        if (m) {
          selection.position.set(m.position.x, -0.055, m.position.z);
          selection.scale.setScalar(Math.max(0.45, m.scale.x));
        }
      }
      if (p.playing || acting || e.dragging)
        renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      positionCards(
        cardRegistry,
        camera,
        container.clientWidth,
        container.clientHeight,
        {
          card(card, target) {
            const drag = e.cardDrag;
            target.fromArray(
              drag?.id === card.id && drag.position
                ? drag.position
                : card.position,
            );
            return true;
          },
          anchor(card, target) {
            const group = models.get(card.target.objectId)?.group;
            if (!group?.visible) return false;
            group.updateMatrixWorld();
            group.localToWorld(target.fromArray(card.target.point));
            return true;
          },
        },
      );
      needsRender = false;
    };
    loop();
    onReady?.();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      transform.dispose();
      models.forEach((m) => disposeGroup(m.group));
      disposeGroup(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      container.removeEventListener("dragover", dragover);
      container.removeEventListener("dragleave", dragleave);
      container.removeEventListener("drop", drop);
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    const refreshModels = () => {
      if (engine.current !== e) return;
      const visible = [...e.models.values()].filter((m) => m.group.visible);
      setModelSummary({
        loading: visible.filter((m) => m.group.userData.loading).length,
        errors: [
          ...new Set(
            visible.map((m) => m.group.userData.loadError).filter(Boolean),
          ),
        ],
      });
    };
    const ids = new Set(project.objects.map((o) => o.id));
    for (const [id, m] of e.models) {
      if (!ids.has(id)) {
        if (e.transform.object === m.group) e.transform.detach();
        e.scene.remove(m.group);
        disposeGroup(m.group);
        e.models.delete(id);
      }
    }
    for (const object of project.objects) {
      let m = e.models.get(object.id);
      const key = `${object.assetId}-${object.color || ""}-${JSON.stringify(object.model || null)}`;
      if (m && m.key !== key) {
        e.transform.detach();
        e.scene.remove(m.group);
        disposeGroup(m.group);
        e.models.delete(object.id);
        m = null;
      }
      if (!m) {
        m = {
          key,
          group: createAsset(object.assetId, object.color, object.model),
        };
        e.models.set(object.id, m);
        e.scene.add(m.group);
        const current = m;
        m.group.userData.ready?.then(() => {
          if (engine.current !== e || e.models.get(object.id) !== current)
            return;
          e.renderer.shadowMap.needsUpdate = true;
          e.requestRender();
          refreshModels();
        });
      }
      if (!e.dragging) applyObjectTransform(m.group, object);
      setIdleClip(m.group, validIdleClip(object.idleClip));
    }
    refreshModels();
    const selected = e.models.get(selectedId)?.group;
    if (selected && tool !== "select" && !viewOnly && !playing) {
      e.transform.attach(selected);
      e.transform.setMode(tool);
      e.transform.setSpace("world");
      e.transform.showX = true;
      e.transform.showY = true;
      e.transform.showZ = true;
    } else e.transform.detach();
    e.selection.visible = !!selected && !viewOnly && !playing;
    e.gridHelper.visible = grid;
    e.marker.visible = markerVisible;
    e.renderer.shadowMap.needsUpdate = true;
    e.requestRender();
  }, [
    project.objects,
    selectedId,
    tool,
    grid,
    markerVisible,
    playing,
    viewOnly,
  ]);
  useEffect(() => {
    engine.current?.requestRender();
  }, [cards, selectedId, compactCards]);
  useEffect(() => {
    if (playing || viewOnly) return;
    engine.current?.models.forEach((m) => stopActions(m.group));
    setLooping({});
  }, [playing, viewOnly]);
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    let cancelled = false;
    const texture = new THREE.TextureLoader().load(
      markerImage || getMarker(project.markerId).image,
      (t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        e.marker.material.map = t;
        e.marker.material.needsUpdate = true;
        e.requestRender();
      },
    );
    return () => {
      cancelled = true;
      texture.dispose();
    };
  }, [project.markerId, markerImage]);
  return (
    <div
      ref={host}
      className={`studio-canvas ${pickMode ? "picking-point" : ""}`}
      data-testid="studio-canvas"
    >
      <CardOverlay
        cards={cards}
        registry={cardRegistry}
        mode={cardMode}
        compact={compactCards}
        selectedId={selectedId}
        onCardPointerDown={(card, event) =>
          engine.current?.startCardDrag(card, event)
        }
        onOpen={onOpenCard}
      />
      {showActions && (
        <ActionBar
          objects={project.objects}
          looping={looping}
          onPlay={(object, action) => runAction(object.id, action)}
        />
      )}
      {(modelSummary.loading > 0 || modelSummary.errors.length > 0) &&
        !error && (
          <div
            className={`model-load-note ${modelSummary.errors.length ? "has-error" : ""}`}
            role="status"
          >
            {modelSummary.loading > 0 && (
              <span>
                Loading{" "}
                {modelSummary.loading === 1
                  ? "your model"
                  : `${modelSummary.loading} models`}
                …
              </span>
            )}
            {modelSummary.errors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
      {error && (
        <div className="webgl-error">
          <strong>Let’s get 3D working</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
});
export default StudioCanvas;
