import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  ArrowLeft,
  Box,
  Camera,
  Check,
  ChevronRight,
  HelpCircle,
  LoaderCircle,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import StudioCanvas from "./StudioCanvas";
import { IconButton, Logo } from "./UI";
import { LoadingLesson, LinkError } from "./Viewer";
import { CardOverlay, LessonCardSheet, positionCards } from "./LessonCards";
import { ActionBar } from "./ModelActions";
import {
  addLights,
  applyObjectTransform,
  createAsset,
  disposeGroup,
  tickModel,
} from "../lib/assets";
import {
  actionOffsets,
  playAction,
  setIdleClip,
  stopAllSounds,
  validIdleClip,
} from "../lib/model-actions";
import { loadCollectionFromLocation } from "../lib/mini-projects";
import { resolveResourceUrl } from "../lib/local-files";
import { APP_BASE } from "../lib/deployment";

export default function CollectionViewer() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    loadCollectionFromLocation()
      .then((collection) => active && setResult({ collection }))
      .catch(
        (error) =>
          active &&
          setResult({
            error: error?.message || "This project could not be opened.",
          }),
      );
    return () => {
      active = false;
    };
  }, []);
  if (!result) return <LoadingLesson />;
  return result.error ? (
    <LinkError message={result.error} />
  ) : (
    <CollectionExperience collection={result.collection} />
  );
}

function CollectionExperience({ collection }) {
  const [mode, setMode] = useState("intro"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(""),
    [ready, setReady] = useState(false),
    [activeId, setActiveId] = useState(null),
    [selectedId, setSelectedId] = useState(collection.cards[0].id),
    [openCard, setOpenCard] = useState(null),
    [tips, setTips] = useState(false),
    [scale, setScale] = useState(1),
    [looping, setLooping] = useState({}),
    [soundError, setSoundError] = useState("");
  const cameraHost = useRef(null),
    runtime = useRef(null),
    arCards = useRef({}),
    scaleRef = useRef(scale);
  scaleRef.current = scale;
  const active = collection.cards.find((card) => card.id === activeId);
  const selected =
    collection.cards.find((card) => card.id === selectedId) ||
    collection.cards[0];
  const compact =
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(max-width: 720px)").matches;
  useEffect(() => {
    if (runtime.current?.content)
      runtime.current.content.scale.setScalar(scale / 5.2);
  }, [scale]);
  useEffect(() => {
    if (!soundError) return;
    const timer = setTimeout(() => setSoundError(""), 4000);
    return () => clearTimeout(timer);
  }, [soundError]);
  function playCurrent(object, action) {
    const state = runtime.current;
    const card = collection.cards.find((c) => c.id === state?.activeId);
    const index =
      card?.scene.objects.findIndex((item) => item.id === object.id) ?? -1;
    const model = state?.content?.children[index];
    if (!model) return;
    const result = playAction(model, action, () =>
      setSoundError(
        "A sound could not play. Check your phone is not on silent.",
      ),
    );
    setLooping((old) => {
      const next = { ...old };
      if (result === "loop") next[object.id] = action.id;
      else delete next[object.id];
      return next;
    });
  }
  const playRef = useRef(playCurrent);
  playRef.current = playCurrent;
  useEffect(() => {
    if (mode !== "ar") return;
    let disposed = false,
      cleaned = false,
      mindar = null,
      stream = null,
      timer = null,
      timeout = null;
    const abort = new AbortController();
    const state = { activeId: null, content: null, anchor: null };
    runtime.current = state;
    let tapPoint = null;
    const tapStart = (event) => {
      tapPoint = { x: event.clientX, y: event.clientY };
    };
    const tapEnd = (event) => {
      const start = tapPoint;
      tapPoint = null;
      if (
        !start ||
        !mindar?.renderer ||
        !state.content ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
      )
        return;
      const rect = mindar.renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, mindar.camera);
      let hit = raycaster.intersectObjects(
        state.content.children.filter((model) => model.visible),
        true,
      )[0]?.object;
      while (hit && hit.parent !== state.content) hit = hit.parent;
      const card = collection.cards.find((item) => item.id === state.activeId);
      const object = card?.scene.objects[state.content.children.indexOf(hit)];
      if (object?.actions?.length) playRef.current(object, object.actions[0]);
    };
    const disposeContent = () => {
      if (!state.content) return;
      state.content.parent?.remove(state.content);
      disposeGroup(state.content);
      state.content = null;
    };
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      mindar?.renderer?.setAnimationLoop(null);
      try {
        mindar?.controller?.stopProcessVideo();
      } catch {}
      try {
        mindar?.controller?.worker?.terminate();
      } catch {}
      if (mindar?._boundResize)
        window.removeEventListener("resize", mindar._boundResize);
      mindar?.video?.srcObject?.getTracks().forEach((track) => track.stop());
      stream?.getTracks().forEach((track) => track.stop());
      mindar?.video?.remove();
      disposeContent();
      mindar?.renderer?.dispose();
      mindar?.renderer?.domElement?.remove();
      mindar?.cssRenderer?.domElement?.remove();
      cameraHost.current?.removeEventListener("pointerdown", tapStart);
      cameraHost.current?.removeEventListener("pointerup", tapEnd);
      stopAllSounds();
      if (runtime.current === state) runtime.current = null;
    };
    const activate = (card, anchor) => {
      if (disposed) return;
      if (state.activeId !== card.id || !state.content) {
        disposeContent();
        stopAllSounds();
        setLooping({});
        setOpenCard(null);
        const group = new THREE.Group();
        group.rotation.x = Math.PI / 2;
        group.scale.setScalar(scaleRef.current / 5.2);
        anchor.group.add(group);
        state.content = group;
        state.anchor = anchor;
        card.scene.objects.forEach((object) => {
          const model = createAsset(object.assetId, object.color, object.model);
          applyObjectTransform(model, object);
          setIdleClip(model, validIdleClip(object.idleClip));
          group.add(model);
        });
        Promise.all(group.children.map((model) => model.userData.ready)).then(
          () => {
            if (disposed || state.content !== group) return;
            const failed = group.children.find(
              (model) => model.visible && model.userData.loadError,
            );
            if (failed)
              setSoundError(
                `A model could not load: ${failed.userData.loadError}`,
              );
          },
        );
      }
      state.activeId = card.id;
      setActiveId(card.id);
    };
    const start = async () => {
      try {
        setError("");
        setReady(false);
        setActiveId(null);
        setLoading("Warming up a little wonder…");
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Open this page directly in Safari or Chrome over HTTPS to use your camera.",
          );
        const { MindARThree } =
          await import("../vendor/mindar-image-three.prod.js");
        if (disposed) return;
        const targetUrl = resolveResourceUrl(collection.target);
        const response = await fetch(targetUrl, { signal: abort.signal });
        if (
          !response.ok ||
          (response.headers.get("content-type") || "").includes("text/html")
        )
          throw new Error(
            "The .mind tracking file could not be loaded. Check that the project was published completely.",
          );
        if (disposed) return;
        mindar = new MindARThree({
          container: cameraHost.current,
          imageTargetSrc: targetUrl,
          uiLoading: "no",
          uiScanning: "no",
          uiError: "no",
          maxTrack: 1,
          filterMinCF: 0.001,
          filterBeta: 1000,
          warmupTolerance: 3,
          missTolerance: 5,
        });
        mindar.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
        mindar.renderer.outputColorSpace = THREE.SRGBColorSpace;
        mindar.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        mindar.renderer.toneMappingExposure = 1.1;
        mindar.cssRenderer.domElement.style.pointerEvents = "none";
        mindar._startVideo = async () => {
          const video = document.createElement("video");
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.setAttribute("playsinline", "");
          video.style.position = "absolute";
          mindar.video = video;
          cameraHost.current?.appendChild(video);
          setLoading("Allow camera access to bring your cards to life.");
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          if (disposed) {
            stream.getTracks().forEach((track) => track.stop());
            throw new DOMException("Camera stopped", "AbortError");
          }
          video.srcObject = stream;
          await video.play();
          if (!video.videoWidth)
            await new Promise((resolve, reject) => {
              video.onloadedmetadata = resolve;
              video.onerror = reject;
            });
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          setLoading("Preparing your tracking images…");
        };
        addLights(mindar.scene, false);
        collection.cards.forEach((card) => {
          const anchor = mindar.addAnchor(card.targetIndex);
          anchor.onTargetFound = () => activate(card, anchor);
          anchor.onTargetLost = () => {
            if (disposed || state.activeId !== card.id) return;
            state.activeId = null;
            setActiveId(null);
            setOpenCard(null);
            stopAllSounds();
            setLooping({});
          };
        });
        cameraHost.current?.addEventListener("pointerdown", tapStart);
        cameraHost.current?.addEventListener("pointerup", tapEnd);
        await Promise.race([
          mindar.start(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Camera setup is taking too long. Check permissions and try again.",
                  ),
                ),
              35000,
            );
          }),
        ]);
        clearTimeout(timer);
        if (disposed) {
          cleanup();
          return;
        }
        setReady(true);
        setLoading("");
        const started = performance.now();
        let last = started;
        mindar.renderer.setAnimationLoop(() => {
          if (disposed) return;
          const now = performance.now(),
            delta = (now - last) / 1000,
            t = (now - started) / 1000;
          last = now;
          const card = collection.cards.find(
              (item) => item.id === state.activeId,
            ),
            group = state.content;
          if (card && group) {
            card.scene.objects.forEach((object, i) => {
              const model = group.children[i];
              if (!model) return;
              if (model.visible) tickModel(model, delta);
              const fx = actionOffsets(model, now / 1000);
              model.position.y =
                object.position[1] +
                (object.animation === "float"
                  ? Math.sin(t * 1.6 + i) * 0.12
                  : 0) +
                fx.y * object.scale;
              model.rotation.y =
                (object.rotation[1] * Math.PI) / 180 +
                (object.animation === "spin" ? t * 0.28 : 0) +
                fx.rot;
              model.rotation.z = (object.rotation[2] * Math.PI) / 180 + fx.tilt;
              model.scale.setScalar(object.scale * fx.scale);
            });
            if (card.scene.cards?.length && state.anchor?.group.visible) {
              const host = cameraHost.current;
              positionCards(
                arCards,
                mindar.camera,
                host?.clientWidth || 0,
                host?.clientHeight || 0,
                {
                  card(box, target) {
                    group.localToWorld(target.fromArray(box.position));
                    return true;
                  },
                  anchor(box, target) {
                    const index = card.scene.objects.findIndex(
                        (o) => o.id === box.target.objectId,
                      ),
                      model = group.children[index];
                    if (!model?.visible) return false;
                    model.localToWorld(target.fromArray(box.target.point));
                    return true;
                  },
                },
                { top: 92, bottom: 96 },
              );
            }
          }
          mindar.renderer.render(mindar.scene, mindar.camera);
        });
      } catch (e) {
        if (disposed) return;
        const messages = {
          NotAllowedError:
            "Camera access was not allowed. Open the viewer in your phone browser and allow camera access in site settings.",
          NotFoundError:
            "No camera was found. Open this link on a phone, or explore the cards in 3D.",
          NotReadableError:
            "Your camera is busy. Close other camera apps and try again.",
          SecurityError:
            "Your browser blocked camera access. Open the viewer directly in Safari or Chrome.",
        };
        setError(
          messages[e?.name] ||
            e?.message ||
            "The camera could not start. Check permissions and try again.",
        );
        setMode("intro");
        cleanup();
      }
    };
    timeout = setTimeout(() => abort.abort(), 40000);
    start();
    const pause = () => {
      if (document.hidden) setMode("intro");
    };
    const leave = () => cleanup();
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", leave);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      abort.abort();
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("pagehide", leave);
      cleanup();
    };
  }, [mode, collection]);
  if (mode === "ar")
    return (
      <main className="ar-experience">
        <div ref={cameraHost} className="ar-camera" />
        {active?.scene.cards?.length > 0 && (
          <div className="ar-card-host">
            <CardOverlay
              key={active.id}
              cards={active.scene.cards}
              registry={arCards}
              compact={compact}
              hidden={!active}
              onOpen={setOpenCard}
            />
          </div>
        )}
        {openCard && (
          <LessonCardSheet card={openCard} onClose={() => setOpenCard(null)} />
        )}
        <div className="ar-top">
          <IconButton
            className="ar-control"
            label="Stop camera and go back"
            onClick={() => setMode("intro")}
          >
            <ArrowLeft size={21} />
          </IconButton>
          <div>
            <strong>{collection.title}</strong>
            <span>
              <span className={active ? "green-dot" : "pulse-dot"} />
              {!ready
                ? "Getting ready…"
                : active
                  ? `Marker found · ${active.title}`
                  : "Looking for a card…"}
            </span>
          </div>
          <IconButton
            className="ar-control"
            label="AR viewing tips"
            onClick={() => setTips(!tips)}
          >
            <HelpCircle size={21} />
          </IconButton>
        </div>
        {loading && (
          <div className="ar-loading">
            <LoaderCircle size={34} className="spin" />
            <strong>{loading}</strong>
            <span>Your camera feed stays on this device.</span>
          </div>
        )}
        {ready && !active && (
          <div className="scan-guide">
            <div className="scan-corners">
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>
              Point your camera at
              <br />
              <strong>
                {collection.cards.length > 1
                  ? "any card in the set"
                  : collection.cards[0].title}
              </strong>
            </p>
            {collection.cards.length === 1 && (
              <img
                src={resolveResourceUrl(collection.cards[0].marker)}
                alt="Look for this tracking image"
              />
            )}
          </div>
        )}
        {tips && (
          <div className="ar-tips">
            <strong>A few little tips</strong>
            <p>
              Keep the card flat and well lit. Show the entire marker image, not
              just its QR code. Move your phone back slowly until the whole card
              is visible.
            </p>
            <button onClick={() => setTips(false)}>
              Got it <Check size={15} />
            </button>
          </div>
        )}
        {soundError && (
          <div className="action-sound-error" role="alert">
            {soundError}
          </div>
        )}
        {ready && active && (
          <ActionBar
            className="ar-action-bar"
            objects={active.scene.objects}
            looping={looping}
            onPlay={playCurrent}
          />
        )}
        <div className="ar-bottom">
          <span className="ar-privacy">
            <ShieldCheck size={14} /> Camera stays on your device
          </span>
          <div className="ar-scale">
            <IconButton
              label="Make AR objects smaller"
              disabled={scale <= 0.5}
              onClick={() => setScale((v) => Math.max(0.5, v - 0.1))}
            >
              <Minus size={17} />
            </IconButton>
            <span>{Math.round(scale * 100)}%</span>
            <IconButton
              label="Make AR objects bigger"
              disabled={scale >= 1.8}
              onClick={() => setScale((v) => Math.min(1.8, v + 0.1))}
            >
              <Plus size={17} />
            </IconButton>
          </div>
        </div>
      </main>
    );
  return (
    <main className="viewer-page collection-viewer">
      <header className="viewer-header">
        <a href={APP_BASE} aria-label="Wonderlab studio">
          <Logo small />
        </a>
        <span className="viewer-top-badge">
          <Sparkles size={13} /> A little world, made by you
        </span>
      </header>
      <div className="viewer-main">
        <div className="viewer-scene">
          <StudioCanvas
            key={selected.id}
            project={selected.scene}
            viewOnly
            playing
            showActions
            grid={false}
            cards={selected.scene.cards || []}
            compactCards={compact}
            onOpenCard={setOpenCard}
            onSoundError={() => setSoundError("A sound could not play.")}
          />
          <span className="viewer-scene-badge">
            <Box size={14} />
            {mode === "3d"
              ? "Interactive 3D preview"
              : "A peek at your creation"}
          </span>
          {mode === "3d" && (
            <span className="viewer-orbit-tip">
              Drag to look around · Pinch to zoom
            </span>
          )}
        </div>
        <div className="viewer-copy">
          <span className="eyebrow">
            <Sparkles size={14} /> YOUR CARDS, IN AR
          </span>
          <h1>{collection.title}</h1>
          <p className="viewer-description">
            {collection.cards.length > 1
              ? `One camera, ${collection.cards.length} little worlds. Scan any card in this set to bring it to life.`
              : `Bring ${selected.title} to life. Start the camera, then point it at the printed image.`}
          </p>
          {error && (
            <div className="camera-error" role="alert">
              <Camera size={20} />
              <p>{error}</p>
            </div>
          )}
          <button
            className="button primary viewer-start"
            onClick={() => setMode("ar")}
          >
            <Camera size={20} /> Start AR camera <ChevronRight size={19} />
          </button>
          <button
            className="button secondary full"
            onClick={() => setMode(mode === "3d" ? "intro" : "3d")}
          >
            <Box size={18} />
            {mode === "3d"
              ? "Back to getting started"
              : "Explore in 3D instead"}
          </button>
          <div className="collection-marker-list">
            <span>
              {collection.cards.length > 1
                ? "CHOOSE A CARD TO PREVIEW"
                : "YOUR TRACKING IMAGE"}
            </span>
            <div>
              {collection.cards.map((card) => (
                <button
                  key={card.id}
                  className={selected.id === card.id ? "selected" : ""}
                  onClick={() => {
                    setSelectedId(card.id);
                    setOpenCard(null);
                  }}
                  aria-label={`Preview ${card.title}`}
                >
                  <img src={resolveResourceUrl(card.marker)} alt="" />
                  <strong>{card.title}</strong>
                </button>
              ))}
            </div>
          </div>
          <ol className="viewer-steps">
            <li>
              <span>1</span>Have your printed{" "}
              {collection.cards.length > 1 ? "cards" : "card"} ready.
            </li>
            <li>
              <span>2</span>Allow camera access in your browser.
            </li>
            <li>
              <span>3</span>Point at the illustration, not the QR.
            </li>
          </ol>
          <div className="viewer-note">
            <ShieldCheck size={16} />
            <p>
              No app to install. Your camera stays on this device.
              <br />
              Use HTTPS in Safari on iPhone or Chrome on Android.
            </p>
          </div>
        </div>
      </div>
      {openCard && (
        <LessonCardSheet card={openCard} onClose={() => setOpenCard(null)} />
      )}
      <footer className="viewer-footer">
        <Logo small />
        <span>Made for little big thinkers.</span>
        <a href={APP_BASE}>
          Make your own <ChevronRight size={14} />
        </a>
      </footer>
    </main>
  );
}
