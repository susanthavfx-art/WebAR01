import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CircleHelp,
  ClipboardCopy,
  FileScan,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import PortalAR from "./PortalAR";
import PortalPreview from "./PortalPreview";
import PortalControls from "./PortalControls";
import { IconButton, Logo } from "./UI";
import {
  analyseMarker,
  DEFAULT_PORTAL,
  DEMO_PORTAL,
  formatMarkerSize,
  loadSavedPortal,
  markerUrl,
  normalisePortal,
  portalFromPublishedLink,
  portalGaps,
  portalParams,
  portalStyle,
  readPortalFromLocation,
  portalUrl,
  savePortal,
} from "../lib/portal";
import {
  inspectMindFile,
  saveLocalFile,
  resolveResourceUrl,
} from "../lib/local-files";

const RATING_LABEL = {
  strong: "Prints well",
  ok: "Usable",
  weak: "May struggle",
};

export default function PortalWorkshop({ onExit }) {
  const [portal, setPortal] = useState(() => {
    const fromUrl =
      new URLSearchParams(window.location.hash.replace(/^#/, "")).get(
        "page",
      ) === "portal"
        ? readPortalFromLocation()
        : null;
    return fromUrl || loadSavedPortal() || normalisePortal(DEFAULT_PORTAL);
  });
  const [mode, setMode] = useState("edit");
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [trackerCount, setTrackerCount] = useState(1);
  const markerInput = useRef(null);
  const mindInput = useRef(null);

  const style = portalStyle(portal.style);
  const gaps = portalGaps(portal);
  const localOnly =
    portal.marker.startsWith("local:") || portal.tracker.startsWith("local:");

  // Keep the address bar shareable and remember the portal on this device.
  useEffect(() => {
    savePortal(portal);
    const url = new URL(window.location.href);
    url.hash = new URLSearchParams(portalParams(portal)).toString();
    window.history.replaceState(null, "", url);
  }, [portal]);

  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    setAnalysisError("");
    if (!portal.marker) return undefined;
    const url = markerUrl(portal);
    if (!url) {
      setAnalysisError("This marker image is not available on this device.");
      return undefined;
    }
    analyseMarker(url)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch((problem) => {
        if (!cancelled) setAnalysisError(problem.message);
      });
    return () => {
      cancelled = true;
    };
  }, [portal.marker]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const update = (patch) =>
    setPortal((current) => normalisePortal({ ...current, ...patch }));

  const handleMarker = async (file) => {
    if (!file) return;
    setError("");
    setBusy("Saving your marker…");
    try {
      const record = await saveLocalFile(file, "marker");
      update({ marker: record.ref });
      setNotice("Marker ready — check the doorway on it.");
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  const handleMind = async (file) => {
    if (!file) return;
    setError("");
    setBusy("Reading the tracker…");
    try {
      const count = await inspectMindFile(file);
      const record = await saveLocalFile(file, "target");
      setTrackerCount(count);
      update({ tracker: record.ref, trackerIndex: 0 });
      setNotice(
        count > 1
          ? `Tracker added with ${count} targets — pick the one for this marker.`
          : "Tracker added. Your marker is ready for AR.",
      );
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  const importPublished = async () => {
    setError("");
    setBusy("Looking up that published marker…");
    try {
      const imported = await portalFromPublishedLink(link);
      update({
        marker: imported.marker,
        tracker: imported.tracker,
        trackerIndex: imported.trackerIndex,
        name: portal.name === DEFAULT_PORTAL.name ? imported.name : portal.name,
      });
      setTrackerCount(1);
      setLink("");
      setNotice("Marker and tracker imported from your published set.");
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy("");
    }
  };

  const openAR = () => {
    if (gaps.length) {
      setError(gaps[0]);
      return;
    }
    setError("");
    setMode("ar");
  };

  const copyLink = async () => {
    const url = portalUrl(portal, {
      base: `${window.location.origin}${window.location.pathname}`,
    });
    try {
      await navigator.clipboard.writeText(url);
      setNotice(
        localOnly
          ? "Link copied — note that locally uploaded files only open on this device."
          : "Portal link copied. Open it on a phone to scan your marker.",
      );
    } catch {
      setNotice(url);
    }
  };

  if (mode === "ar")
    return (
      <PortalAR
        portal={portal}
        onChange={update}
        onExit={() => setMode("edit")}
      />
    );

  return (
    <div className="portal-page" style={{ "--accent": style.glow }}>
      <header className="portal-header">
        <button type="button" className="portal-back" onClick={onExit}>
          <ArrowLeft size={16} />
          <span>Studio</span>
        </button>
        <div className="portal-header-brand">
          <Logo small />
          <span>Portal Workshop</span>
        </div>
        <div className="portal-header-actions">
          <IconButton
            label="How portals work"
            onClick={() =>
              setNotice(
                "Print the marker, open this link on a phone, then point the camera at the print.",
              )
            }
          >
            <CircleHelp size={19} />
          </IconButton>
        </div>
      </header>

      <main className="portal-workspace">
        <section className="portal-visual">
          <div className="portal-visual-head">
            <div>
              <p className="portal-eyebrow">Live preview</p>
              <h1>
                <input
                  aria-label="Portal name"
                  value={portal.name}
                  maxLength={60}
                  onChange={(event) => update({ name: event.target.value })}
                />
              </h1>
            </div>
            <span className="portal-live-pill">
              <Sparkles size={13} />
              {style.name}
            </span>
          </div>

          <PortalPreview portal={portal} className="portal-preview" />

          <div className="portal-visual-actions">
            <button
              type="button"
              className="button primary"
              onClick={openAR}
              disabled={!!busy}
            >
              <Camera size={16} />
              <span>Open portal in AR</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={copyLink}
            >
              <Link2 size={16} />
              <span>Copy portal link</span>
            </button>
          </div>

          {gaps.length > 0 ? (
            <p className="portal-hint-line">
              <ShieldCheck size={15} />
              <span>
                Add a marker and its tracker below, then the AR button goes
                live.
              </span>
            </p>
          ) : (
            <p className="portal-hint-line ok">
              <Check size={15} />
              <span>
                Ready. Print the marker, open this link on a phone and point the
                camera at it.
              </span>
            </p>
          )}
        </section>

        <aside className="portal-side">
          <section className="portal-card">
            <header className="portal-card-head">
              <span className="portal-step">1</span>
              <div>
                <h2>Your marker</h2>
                <p>The picture you print and scan.</p>
              </div>
            </header>

            <div className="portal-marker-row">
              <div className="portal-marker-thumb">
                {markerUrl(portal) ? (
                  <img src={markerUrl(portal)} alt="Marker preview" />
                ) : (
                  <ImageIcon size={22} />
                )}
              </div>
              <div className="portal-marker-info">
                {analysis ? (
                  <>
                    <strong>
                      {formatMarkerSize(analysis.width, analysis.height)}
                    </strong>
                    <span className={`portal-score ${analysis.rating}`}>
                      {RATING_LABEL[analysis.rating]} · {analysis.score}/100
                    </span>
                  </>
                ) : (
                  <strong>
                    {analysisError ||
                      (portal.marker ? "Checking…" : "No marker yet")}
                  </strong>
                )}
                <div className="portal-marker-buttons">
                  {!portal.marker && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        update({
                          marker: DEMO_PORTAL.marker,
                          tracker: DEMO_PORTAL.tracker,
                          trackerIndex: DEMO_PORTAL.trackerIndex,
                          name: DEMO_PORTAL.name,
                        });
                        setNotice(
                          "Demo marker loaded — the print for it is in your published folder.",
                        );
                      }}
                      disabled={!!busy}
                    >
                      <Sparkles size={15} />
                      <span>Try a demo</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => markerInput.current?.click()}
                    disabled={!!busy}
                  >
                    <Upload size={15} />
                    <span>
                      {portal.marker ? "Replace image" : "Upload image"}
                    </span>
                  </button>
                  <input
                    ref={markerInput}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    className="visually-hidden"
                    onChange={(event) => {
                      handleMarker(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>
            </div>

            {analysis && (
              <ul className="portal-tips">
                {analysis.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}

            <details className="portal-published">
              <summary>
                <Link2 size={14} />
                <span>Already published a marker from the Studio?</span>
              </summary>
              <p>
                Paste the link from your Publish &amp; share QR. The marker
                image and its compiled tracker are imported together.
              </p>
              <div className="portal-inline-form">
                <input
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  placeholder="https://…/#page=collection&p=…"
                  aria-label="Published AR link"
                />
                <button
                  type="button"
                  className="button secondary"
                  onClick={importPublished}
                  disabled={!!busy || !link.trim()}
                >
                  Import
                </button>
              </div>
            </details>
          </section>

          <section className="portal-card">
            <header className="portal-card-head">
              <span className="portal-step">2</span>
              <div>
                <h2>Tracker</h2>
                <p>The .mind file compiled for this marker.</p>
              </div>
            </header>

            {portal.tracker ? (
              <div className="portal-tracker-state">
                <FileScan size={18} />
                <div>
                  <strong>
                    {portal.tracker.startsWith("local:")
                      ? "Tracker on this device"
                      : "Tracker from your published set"}
                  </strong>
                  <small>
                    Target {portal.trackerIndex + 1}
                    {trackerCount > 1 ? ` of ${trackerCount}` : ""} ·{" "}
                    {resolveResourceUrl(portal.tracker)
                      ? "loaded"
                      : "not reachable"}
                  </small>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove tracker"
                  onClick={() => update({ tracker: "", trackerIndex: 0 })}
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <p className="portal-muted">
                Import a published marker above, or upload the .mind file that
                was compiled for this picture.
              </p>
            )}

            {portal.tracker && (
              <label className="portal-select target-field">
                <span>
                  Which target inside the tracker is this marker?
                  {trackerCount > 1 ? ` (this file has ${trackerCount})` : ""}
                </span>
                {trackerCount > 1 ? (
                  <select
                    value={portal.trackerIndex}
                    onChange={(event) =>
                      update({ trackerIndex: Number(event.target.value) })
                    }
                  >
                    {Array.from({ length: trackerCount }, (_, index) => (
                      <option key={index} value={index}>
                        Target {index + 1}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={portal.trackerIndex + 1}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      update({
                        trackerIndex: Math.min(
                          99,
                          Math.max(0, Math.round(next) - 1),
                        ),
                      });
                    }}
                  />
                )}
              </label>
            )}

            <button
              type="button"
              className="button secondary full"
              onClick={() => mindInput.current?.click()}
              disabled={!!busy}
            >
              <Upload size={15} />
              <span>
                {portal.tracker ? "Replace .mind file" : "Upload .mind file"}
              </span>
            </button>
            <input
              ref={mindInput}
              type="file"
              accept=".mind"
              className="visually-hidden"
              onChange={(event) => {
                handleMind(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </section>

          <section className="portal-card">
            <header className="portal-card-head">
              <span className="portal-step">3</span>
              <div>
                <h2>Make it yours</h2>
                <p>Everything is drawn live — no assets to upload.</p>
              </div>
            </header>
            <PortalControls portal={portal} onChange={update} />
          </section>

          {busy && (
            <p className="portal-busy">
              <LoaderCircle size={16} className="spin" />
              <span>{busy}</span>
            </p>
          )}
          {error && (
            <p className="portal-error" role="alert">
              <X size={15} />
              <span>{error}</span>
            </p>
          )}
        </aside>
      </main>

      {notice && (
        <div className="portal-toast" role="status">
          <ClipboardCopy size={15} />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
