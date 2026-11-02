import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  ScanLine,
  SlidersHorizontal,
  X,
} from "lucide-react";
import PortalControls from "./PortalControls";
import { buildPortal } from "../lib/portal-scene";
import { loadImage, markerUrl, portalStyle } from "../lib/portal";
import { resolveResourceUrl } from "../lib/local-files";

// The camera session. One MindAR instance tracks the marker; the doorway group
// is swapped in place whenever the look changes, so tweaking never restarts the
// camera.
export default function PortalAR({ portal, onChange, onExit }) {
  const host = useRef(null);
  const [loading, setLoading] = useState("Starting AR camera…");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [found, setFound] = useState(false);
  const [sheet, setSheet] = useState(false);
  const session = useRef(null);

  const signature = [
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

  useEffect(() => {
    let disposed = false;
    let mindar = null;
    let stream = null;
    let anchor = null;
    let portalGroup = null;
    const live = { current: null };
    let abort;
    const timers = [];

    const cleanup = () => {
      try {
        mindar?.renderer?.setAnimationLoop(null);
      } catch {
        /* ignore */
      }
      if (live.current) {
        try {
          live.current.dispose();
        } catch {
          /* ignore */
        }
        live.current = null;
      }
      try {
        mindar?.controller?.stopProcessVideo();
        mindar?.controller?.worker?.terminate();
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((track) => track.stop());
      mindar?.video?.remove();
      try {
        mindar?.renderer?.dispose();
      } catch {
        /* ignore */
      }
      mindar?.renderer?.domElement?.remove();
      mindar?.cssRenderer?.domElement?.remove();
      session.current = null;
    };

    const start = async () => {
      try {
        setError("");
        setReady(false);
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "A camera needs HTTPS. Open this page from your deployed site (or localhost) in Chrome or Safari.",
          );
        }
        const trackerUrl = resolveResourceUrl(portal.tracker);
        if (!trackerUrl)
          throw new Error(
            "This portal has no .mind tracker yet. Add one in the workshop, then try again.",
          );

        const markerImage = portal.marker
          ? await loadImage(markerUrl(portal)).catch(() => null)
          : null;
        if (disposed) return;
        const markerWidth = 1;
        const markerHeight = markerImage
          ? markerImage.naturalHeight / markerImage.naturalWidth
          : 1.4;

        setLoading("Loading the marker tracker…");
        abort = new AbortController();
        const response = await fetch(trackerUrl, { signal: abort.signal });
        if (
          !response.ok ||
          (response.headers.get("content-type") || "").includes("text/html")
        )
          throw new Error(
            "The .mind tracking file could not be loaded. Deploy the published folder first.",
          );
        if (disposed) return;

        const { MindARThree } =
          await import("../vendor/mindar-image-three.prod.js");
        if (disposed) return;

        mindar = new MindARThree({
          container: host.current,
          imageTargetSrc: trackerUrl,
          uiLoading: "no",
          uiScanning: "no",
          uiError: "no",
          maxTrack: 1,
          filterMinCF: 0.001,
          filterBeta: 800,
          warmupTolerance: 3,
          missTolerance: 6,
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
          host.current?.appendChild(video);
          setLoading("Allow camera access to open the portal…");
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
          if (!video.videoWidth) {
            await new Promise((resolve, reject) => {
              video.onloadedmetadata = resolve;
              video.onerror = reject;
            });
          }
          video.width = video.videoWidth;
          video.height = video.videoHeight;
          setLoading("Warming up the tracker…");
        };

        mindar.scene.add(new THREE.HemisphereLight("#fffaf2", "#3a3150", 2.4));
        const key = new THREE.DirectionalLight("#fff6e8", 2.2);
        key.position.set(-2, 6, 5);
        mindar.scene.add(key);
        const fill = new THREE.DirectionalLight("#b9a4ff", 0.9);
        fill.position.set(3, 2, -3);
        mindar.scene.add(fill);

        anchor = mindar.addAnchor(portal.trackerIndex || 0);
        anchor.onTargetFound = () => setFound(true);
        anchor.onTargetLost = () => setFound(false);

        portalGroup = buildPortal(portal, { markerWidth, markerHeight });
        anchor.group.add(portalGroup.group);
        live.current = portalGroup;
        session.current = { mindar, anchor, markerHeight, live };

        const timer = setTimeout(
          () =>
            setError(
              "The camera took too long to start. Check permissions and reload the page.",
            ),
          40000,
        );
        timers.push(timer);
        await mindar.start();
        clearTimeout(timer);
        if (disposed) return;
        setReady(true);
        setLoading("");

        const clock = new THREE.Clock();
        mindar.renderer.setAnimationLoop(() => {
          const delta = Math.min(0.05, clock.getDelta());
          live.current?.update(clock.elapsedTime, delta);
        });
      } catch (error_) {
        if (disposed || error_?.name === "AbortError") return;
        setError(
          error_?.name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site and try again."
            : error_?.message || "The AR camera could not start.",
        );
        setLoading("");
      }
    };

    start();
    return () => {
      disposed = true;
      abort?.abort();
      timers.forEach(clearTimeout);
      cleanup();
    };
    // The camera starts once for this portal; appearance changes are handled
    // by the effect below so the session is never interrupted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal.tracker, portal.trackerIndex, portal.marker]);

  // Swap the doorway when the look changes; the camera keeps running.
  useEffect(() => {
    const current = session.current;
    if (!current) return;
    const next = buildPortal(portal, {
      markerWidth: 1,
      markerHeight: current.markerHeight,
    });
    current.anchor.group.add(next.group);
    const previous = current.live.current;
    current.live.current = next;
    if (previous) {
      current.anchor.group.remove(previous.group);
      previous.dispose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const style = portalStyle(portal.style);
  const fatal = !!error && !ready;

  return (
    <main
      className={`portal-ar ${ready ? "live" : ""}`}
      style={{ "--accent": style.glow }}
    >
      <div className="portal-ar-camera" ref={host} />

      <header className="portal-ar-top">
        <button type="button" className="portal-round-button" onClick={onExit}>
          <ArrowLeft size={18} />
          <span className="visually-hidden">Back to the workshop</span>
        </button>
        <div className="portal-ar-title">
          <strong>{portal.name}</strong>
          <small>{found ? "Portal open" : "Looking for your marker"}</small>
        </div>
        <button
          type="button"
          className={`portal-round-button ${sheet ? "active" : ""}`}
          onClick={() => setSheet((value) => !value)}
          aria-expanded={sheet}
        >
          <SlidersHorizontal size={18} />
          <span className="visually-hidden">Adjust the portal</span>
        </button>
      </header>

      {!ready && !fatal && (
        <div className="portal-ar-waiting">
          <LoaderCircle size={26} className="spin" />
          <strong>{loading}</strong>
          <span>Keep this page open — the camera opens in a moment.</span>
        </div>
      )}

      {fatal && (
        <div className="portal-ar-waiting error">
          <AlertTriangle size={26} />
          <strong>AR camera could not start</strong>
          <span>{error}</span>
          <button type="button" className="button secondary" onClick={onExit}>
            Back to the workshop
          </button>
        </div>
      )}

      {ready && (
        <footer className="portal-ar-hint">
          <ScanLine size={16} />
          <span>
            {found
              ? "Walk around the card to look inside."
              : "Point the camera at the printed marker and hold it steady."}
          </span>
        </footer>
      )}

      {sheet && (
        <div className="portal-ar-sheet">
          <header>
            <strong>Adjust while you watch</strong>
            <button
              type="button"
              className="icon-button"
              onClick={() => setSheet(false)}
              aria-label="Close adjustments"
            >
              <X size={16} />
            </button>
          </header>
          <PortalControls portal={portal} onChange={onChange} compact />
        </div>
      )}
    </main>
  );
}
