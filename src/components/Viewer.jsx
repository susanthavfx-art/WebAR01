import { APP_BASE } from "../lib/deployment";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  ArrowLeft,
  Box,
  Camera,
  Check,
  ChevronRight,
  Download,
  HelpCircle,
  LoaderCircle,
  Minus,
  Plus,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import StudioCanvas from "./StudioCanvas";
import { Logo, IconButton } from "./UI";
import { loadProjectFromLocation } from "../lib/projects";
import { CardOverlay, LessonCardSheet, positionCards } from "./LessonCards";
import {
  addLights,
  applyObjectTransform,
  createAsset,
  disposeGroup,
  getMarker,
  tickModel,
} from "../lib/assets";
import { markerPdf } from "../lib/pdf";
import {
  actionOffsets,
  playAction,
  setIdleClip,
  stopAllSounds,
  validIdleClip,
} from "../lib/model-actions";
import { ActionBar } from "./ModelActions";

export function LinkError({ message }) {
  return (
    <main className="link-error">
      <Logo full />
      <span className="link-error-icon">
        <ScanLine size={42} />
      </span>
      <h1>This wonder needs a new link.</h1>
      <p>{message}</p>
      <a href={APP_BASE} className="button primary">
        <ArrowLeft size={17} />
        Open Wonderlab
      </a>
    </main>
  );
}
export function LoadingLesson() {
  return (
    <main className="link-error lesson-loading" role="status">
      <Logo full />
      <LoaderCircle size={34} className="spin" />
      <h1>Opening your lesson…</h1>
      <p>Getting the 3D models and lesson boxes ready.</p>
    </main>
  );
}
// Reads either a full scene link or a short published lesson link.
export function useLocationProject() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    loadProjectFromLocation()
      .then((value) => active && setResult(value))
      .catch(
        (e) =>
          active &&
          setResult({ error: e?.message || "This link could not be opened." }),
      );
    return () => {
      active = false;
    };
  }, []);
  return result;
}
export default function Viewer() {
  const result = useLocationProject();
  if (!result) return <LoadingLesson />;
  return result.error ? (
    <LinkError message={result.error} />
  ) : (
    <ViewerExperience project={result.project} lesson={result.lesson} />
  );
}
function useCompact() {
  const [compact, setCompact] = useState(
    () => window.matchMedia?.("(max-width: 720px)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 720px)");
    if (!query) return;
    const change = () => setCompact(query.matches);
    query.addEventListener?.("change", change);
    return () => query.removeEventListener?.("change", change);
  }, []);
  return compact;
}
function ViewerExperience({ project, lesson }) {
  const [mode, setMode] = useState("intro"),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(""),
    [tracking, setTracking] = useState(false),
    [ready, setReady] = useState(false),
    [tips, setTips] = useState(false),
    [busy, setBusy] = useState(false),
    [scale, setScale] = useState(1),
    [openCard, setOpenCard] = useState(null),
    [arLooping, setArLooping] = useState({}),
    [soundError, setSoundError] = useState("");
  const hasActions = project.objects.some(
    (o) => o.visible !== false && o.actions?.length,
  );
  function onSoundError() {
    setSoundError("A sound could not play. Check your phone is not on silent.");
  }
  function playArAction(object, action) {
    const index = project.objects.indexOf(object);
    const model = content.current?.children[index];
    if (!model) return;
    const result = playAction(model, action, onSoundError);
    setArLooping((current) => {
      const next = { ...current };
      if (result === "loop") next[object.id] = action.id;
      else delete next[object.id];
      return next;
    });
  }
  const playArRef = useRef(playArAction);
  playArRef.current = playArAction;
  useEffect(() => {
    if (!soundError) return;
    const id = setTimeout(() => setSoundError(""), 4000);
    return () => clearTimeout(id);
  }, [soundError]);
  useEffect(() => () => stopAllSounds(), []);
  const cards = project.cards || [],
    compact = useCompact(),
    arCards = useRef({});
  const cameraHost = useRef(null),
    ar = useRef(null),
    content = useRef(null),
    marker = getMarker(project.markerId);
  useEffect(() => {
    if (content.current) content.current.scale.setScalar(scale / 5.2);
  }, [scale]);
  useEffect(() => {
    if (mode !== "ar") return;
    let disposed = false,
      mindar = null,
      timer = null,
      timeout = null,
      stream = null,
      contentGroup = null;
    const abort = new AbortController();
    const cleanup = () => {
      if (mindar) {
        mindar.renderer?.setAnimationLoop(null);
        try {
          mindar.controller?.stopProcessVideo();
        } catch {}
        try {
          mindar.controller?.worker?.terminate();
        } catch {}
        if (mindar._boundResize)
          window.removeEventListener("resize", mindar._boundResize);
        mindar.video?.srcObject?.getTracks().forEach((t) => t.stop());
        mindar.video?.remove();
        if (contentGroup) disposeGroup(contentGroup);
        mindar.renderer?.dispose();
        mindar.renderer?.domElement?.remove();
        mindar.cssRenderer?.domElement?.remove();
      }
      stream?.getTracks().forEach((t) => t.stop());
      cameraHost.current?.removeEventListener("pointerdown", tapStart);
      cameraHost.current?.removeEventListener("pointerup", tapEnd);
      stopAllSounds();
      setArLooping({});
      ar.current = null;
      content.current = null;
    };
    // Tapping a model in AR plays its first play button.
    let tapPoint = null;
    const tapStart = (ev) => {
      tapPoint = { x: ev.clientX, y: ev.clientY };
    };
    const tapEnd = (ev) => {
      const started = tapPoint;
      tapPoint = null;
      if (
        !started ||
        !mindar?.renderer ||
        !contentGroup ||
        Math.hypot(ev.clientX - started.x, ev.clientY - started.y) > 10
      )
        return;
      const rect = mindar.renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pointer = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, mindar.camera);
      const hit = raycaster.intersectObjects(
        contentGroup.children.filter((m) => m.visible),
        true,
      )[0];
      let target = hit?.object;
      while (target && target.parent !== contentGroup) target = target.parent;
      const index = target ? contentGroup.children.indexOf(target) : -1;
      const object = project.objects[index];
      if (object?.actions?.length)
        playArRef.current(object, object.actions[0]);
    };
    const start = async () => {
      try {
        setError("");
        setReady(false);
        setTracking(false);
        setLoading("Warming up a little wonder…");
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Open this page directly in Safari or Chrome over HTTPS to use your camera.",
          );
        const { MindARThree } =
          await import("../vendor/mindar-image-three.prod.js");
        if (disposed) return;
        // Verify the local target before the tracking library starts its worker.
        const res = await fetch(marker.target, { signal: abort.signal });
        if (!res.ok)
          throw new Error(
            "The tracking image could not be loaded. Check your connection and try again.",
          );
        if (disposed) return;
        mindar = new MindARThree({
          container: cameraHost.current,
          imageTargetSrc: marker.target,
          uiLoading: "no",
          uiScanning: "no",
          uiError: "no",
          maxTrack: 1,
          filterMinCF: 0.001,
          filterBeta: 1000,
          warmupTolerance: 3,
          missTolerance: 5,
        });
        ar.current = mindar;
        mindar.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
        mindar.renderer.outputColorSpace = THREE.SRGBColorSpace;
        mindar.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        mindar.renderer.toneMappingExposure = 1.1;
        mindar.cssRenderer.domElement.style.pointerEvents = "none";
        // Preserve real camera errors and explicitly stop a stream if the user leaves during permission prompts.
        mindar._startVideo = async () => {
          const video = document.createElement("video");
          video.autoplay = true;
          video.muted = true;
          video.playsInline = true;
          video.setAttribute("playsinline", "");
          video.style.position = "absolute";
          mindar.video = video;
          cameraHost.current.appendChild(video);
          setLoading("Allow camera access to bring your creation to life.");
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
          if (disposed) {
            stream.getTracks().forEach((t) => t.stop());
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
          setLoading("Preparing your tracking image…");
        };
        addLights(mindar.scene, false);
        const anchor = mindar.addAnchor(0);
        contentGroup = new THREE.Group();
        contentGroup.rotation.x = Math.PI / 2;
        contentGroup.scale.setScalar(scale / 5.2);
        content.current = contentGroup;
        anchor.group.add(contentGroup);
        project.objects.forEach((o) => {
          const model = createAsset(o.assetId, o.color, o.model);
          applyObjectTransform(model, o);
          setIdleClip(model, validIdleClip(o.idleClip));
          contentGroup.add(model);
        });
        cameraHost.current?.addEventListener("pointerdown", tapStart);
        cameraHost.current?.addEventListener("pointerup", tapEnd);
        if (contentGroup.children.some((model) => model.userData.loading))
          setLoading("Loading your 3D models…");
        await Promise.all(
          contentGroup.children.map((model) => model.userData.ready),
        );
        if (disposed) {
          cleanup();
          return;
        }
        const failedModel = contentGroup.children.find(
          (model) => model.visible && model.userData.loadError,
        );
        if (failedModel)
          throw new Error(
            `A 3D model could not load: ${failedModel.userData.loadError}`,
          );
        anchor.onTargetFound = () => {
          if (!disposed) setTracking(true);
        };
        anchor.onTargetLost = () => {
          if (!disposed) setTracking(false);
        };
        await Promise.race([
          mindar.start(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Camera setup is taking too long. Check permissions, close other camera apps, then try again.",
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
        const startTime = performance.now();
        let lastTime = startTime;
        mindar.renderer.setAnimationLoop(() => {
          if (disposed) return;
          const now = performance.now(),
            delta = (now - lastTime) / 1000;
          lastTime = now;
          const t = (now - startTime) / 1000;
          project.objects.forEach((o, i) => {
            const model = contentGroup.children[i];
            if (model.visible) tickModel(model, delta);
            const fx = actionOffsets(model, now / 1000);
            model.position.y =
              o.position[1] +
              (o.animation === "float" ? Math.sin(t * 1.6 + i) * 0.12 : 0) +
              fx.y * o.scale;
            model.rotation.y =
              (o.rotation[1] * Math.PI) / 180 +
              (o.animation === "spin" ? t * 0.28 : 0) +
              fx.rot;
            model.rotation.z = (o.rotation[2] * Math.PI) / 180 + fx.tilt;
            model.scale.setScalar(o.scale * fx.scale);
          });
          mindar.renderer.render(mindar.scene, mindar.camera);
          if (cards.length && anchor.group.visible) {
            const host = cameraHost.current;
            positionCards(
              arCards,
              mindar.camera,
              host?.clientWidth || 0,
              host?.clientHeight || 0,
              {
                card(card, target) {
                  contentGroup.localToWorld(target.fromArray(card.position));
                  return true;
                },
                anchor(card, target) {
                  const index = project.objects.findIndex(
                    (o) => o.id === card.target.objectId,
                  );
                  const model = contentGroup.children[index];
                  if (!model?.visible) return false;
                  model.localToWorld(target.fromArray(card.target.point));
                  return true;
                },
              },
              { top: 92, bottom: 96 },
            );
          }
        });
      } catch (e) {
        if (disposed) return;
        const messages = {
          NotAllowedError:
            "Camera access was not allowed. Open this viewer directly in your phone browser, allow camera access in site settings, then try again.",
          NotFoundError:
            "No camera was found. Open this link on a phone, or explore your creation in 3D.",
          NotReadableError:
            "Your camera is busy. Close other camera apps and try again.",
          SecurityError:
            "Your browser blocked camera access. Open the viewer directly in Safari or Chrome.",
        };
        setError(
          messages[e?.name] ||
            e?.message ||
            "The camera could not start. Check camera permissions or try the 3D preview.",
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
    document.addEventListener("visibilitychange", pause);
    const leave = () => cleanup();
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
  }, [mode]);
  async function download() {
    setBusy(true);
    try {
      await markerPdf(project, true, lesson);
    } catch {
      setError("The marker PDF could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (mode === "ar")
    return (
      <main className="ar-experience">
        <div ref={cameraHost} className="ar-camera" />
        {cards.length > 0 && (
          <div className="ar-card-host">
            <CardOverlay
              cards={cards}
              registry={arCards}
              compact={compact}
              hidden={!tracking}
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
            <strong>{project.title}</strong>
            <span>
              <span className={tracking ? "green-dot" : "pulse-dot"} />
              {!ready
                ? "Getting ready…"
                : tracking
                  ? "Marker found. Hello, wonder!"
                  : "Looking for your marker…"}
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
        {ready && !tracking && (
          <div className="scan-guide">
            <div className="scan-corners">
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>
              Point your camera at the
              <br />
              <strong>{marker.name}</strong> image
            </p>
            <img src={marker.image} alt="Look for this tracking image" />
          </div>
        )}
        {tips && (
          <div className="ar-tips">
            <strong>A few little tips</strong>
            <p>
              Keep your paper flat and well lit. Show the entire illustrated
              image, not just the QR code. Slowly move your phone back until the
              whole marker is visible.
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
        {hasActions && ready && tracking && (
          <ActionBar
            className="ar-action-bar"
            objects={project.objects}
            looping={arLooping}
            onPlay={playArAction}
          />
        )}
        <div className="ar-bottom">
          <span className="ar-privacy">
            <ShieldCheck size={14} />
            Camera stays on your device
          </span>
          <div className="ar-scale">
            <IconButton
              label="Make AR objects smaller"
              disabled={scale <= 0.5}
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            >
              <Minus size={17} />
            </IconButton>
            <span>{Math.round(scale * 100)}%</span>
            <IconButton
              label="Make AR objects bigger"
              disabled={scale >= 1.8}
              onClick={() => setScale((s) => Math.min(1.8, s + 0.1))}
            >
              <Plus size={17} />
            </IconButton>
          </div>
        </div>
      </main>
    );
  return (
    <main className="viewer-page">
      <header className="viewer-header">
        <a href={APP_BASE} aria-label="Wonderlab studio">
          <Logo small />
        </a>
        <span className="viewer-top-badge">
          <Sparkles size={13} />A little world, made by you
        </span>
      </header>
      <div className="viewer-main">
        <div className="viewer-scene">
          <StudioCanvas
            project={project}
            viewOnly
            playing
            showActions
            onSoundError={onSoundError}
            grid={false}
            cards={cards}
            compactCards={compact}
            onOpenCard={setOpenCard}
          />
          {soundError && (
            <div className="action-sound-error" role="alert">
              {soundError}
            </div>
          )}
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
            <Sparkles size={14} />
            YOUR IMAGINATION, IN AR
          </span>
          <h1>{project.title}</h1>
          <p className="viewer-description">
            {hasActions
              ? "Tap the play buttons (or the model) to see it move and hear its sounds. "
              : ""}
            {cards.length
              ? `Tap the ${cards.length === 1 ? "lesson box" : `${cards.length} lesson boxes`} to read, listen, watch or open links.`
              : "There’s a whole little world waiting to step off your screen."}
          </p>
          {error && (
            <div className="camera-error" role="alert">
              <Camera size={20} />
              <p>{error}</p>
              <button
                onClick={() => setError("")}
                aria-label="Dismiss camera message"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <button
            className="button primary viewer-start"
            onClick={() => setMode("ar")}
          >
            <Camera size={20} />
            Start AR camera
            <ChevronRight size={19} />
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
          <div className="viewer-marker">
            <img src={marker.image} alt={`${marker.name} tracking marker`} />
            <div>
              <span>YOU’LL NEED THIS MARKER</span>
              <strong>{marker.name}</strong>
              <button onClick={download} disabled={busy}>
                {busy ? (
                  <LoaderCircle size={13} className="spin" />
                ) : (
                  <Download size={13} />
                )}{" "}
                {busy ? "Preparing PDF…" : "Download printable sheet"}
              </button>
            </div>
          </div>
          <ol className="viewer-steps">
            <li>
              <span>1</span>Print your marker sheet.
            </li>
            <li>
              <span>2</span>Allow camera access in your browser.
            </li>
            <li>
              <span>3</span>Point at the illustration. Meet your world.
            </li>
          </ol>
          <div className="viewer-note">
            <ShieldCheck size={16} />
            <p>
              No app to install. No camera uploads.
              <br />
              Best experienced in Safari on iPhone or Chrome on Android. HTTPS
              and internet are needed.
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
