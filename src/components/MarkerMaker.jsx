import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  ImagePlus,
  Lightbulb,
  LoaderCircle,
  Mail,
  Move,
  RotateCcw,
  ScanLine,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  BAND_STYLES,
  DEFAULT_DESIGN,
  FRAME_COLORS,
  canvasToJpeg,
  compileMarker,
  drawMarker,
  ensureMarkerFonts,
  loadPhoto,
} from "../lib/marker-maker";
import { cloudEnabled, uploadMarker } from "../lib/cloud";
import { downloadBlob } from "../lib/projects";

const QUALITY_TEXT = {
  great: {
    title: "Great for tracking",
    text: "Lots of detail. Phones will find this marker quickly.",
  },
  good: {
    title: "Good for tracking",
    text: "This marker should work well. Print it clearly and keep it flat.",
  },
  weak: {
    title: "Might be slow to find",
    text: "It may work, but try a busier photo, zoom in on detail or make the text smaller.",
  },
  poor: {
    title: "Too little detail to track",
    text: "Phones cannot recognise this design. Choose a colourful photo with lots of shapes and edges.",
  },
};

export default function MarkerMaker({
  session,
  onBack,
  onSaved,
  onSignIn,
  notify,
}) {
  const canvas = useRef(null),
    fileInput = useRef(null),
    drag = useRef(null),
    abort = useRef(null);
  const [photo, setPhoto] = useState(null),
    [photoName, setPhotoName] = useState(""),
    [design, setDesign] = useState(DEFAULT_DESIGN),
    [name, setName] = useState(""),
    [fontsReady, setFontsReady] = useState(false),
    [check, setCheck] = useState({ status: "idle" }),
    [saving, setSaving] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    ensureMarkerFonts().finally(() => setFontsReady(true));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (canvas.current) drawMarker(canvas.current, photo, design);
  }, [photo, design, fontsReady]);

  function change(patch) {
    setDesign((d) => ({ ...d, ...patch }));
    setCheck({ status: "idle" });
  }
  async function choosePhoto(file) {
    setError("");
    try {
      const image = await loadPhoto(file);
      setPhoto(image);
      setPhotoName(file.name || "Photo");
      change({ zoom: 1, offsetX: 0, offsetY: 0 });
    } catch (e) {
      setError(e.message);
    }
  }
  async function runCheck() {
    if (!photo) {
      setError("Upload a photo first. Text alone is not enough to track.");
      return;
    }
    setError("");
    setCheck({ status: "checking", progress: 0 });
    try {
      drawMarker(canvas.current, photo, design);
      const jpeg = await canvasToJpeg(canvas.current);
      const { target, quality } = await compileMarker(jpeg, (progress) =>
        setCheck((c) =>
          c.status === "checking"
            ? { ...c, progress: Math.max(c.progress, progress) }
            : c,
        ),
      );
      setCheck({ status: "ready", jpeg, target, quality });
    } catch (e) {
      console.error(e);
      setCheck({ status: "idle" });
      setError(
        "This marker could not be checked on this device. Try again, or use a computer with Chrome or Edge.",
      );
    }
  }
  async function save() {
    if (check.status !== "ready" || check.quality.label === "poor") return;
    setError("");
    setSaving(0);
    abort.current = new AbortController();
    try {
      const uploaded = await uploadMarker(check.jpeg, check.target, {
        onProgress: setSaving,
        signal: abort.current.signal,
      });
      const fallback = design.text.trim().slice(0, 40) || "My marker";
      onSaved({
        ...uploaded,
        name: name.trim().slice(0, 40) || fallback,
        quality: check.quality.score,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      if (e?.name !== "AbortError") setError(e.message || "Upload failed.");
    } finally {
      setSaving(null);
      abort.current = null;
    }
  }
  async function downloadImage() {
    if (!photo) return;
    drawMarker(canvas.current, photo, design);
    const jpeg = await canvasToJpeg(canvas.current);
    const safe =
      (name || design.text || "my-marker")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "my-marker";
    downloadBlob(jpeg, `${safe}.jpg`);
    notify("Marker picture downloaded. Save it in the app to use it in AR.");
  }
  function pointerDown(e) {
    if (!photo) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: design.offsetX,
      offsetY: design.offsetY,
      size: e.currentTarget.getBoundingClientRect().width || 1,
    };
  }
  function pointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    const reach = Math.max(0.2, design.zoom - 0.6);
    change({
      offsetX: clamp(d.offsetX + ((e.clientX - d.x) / d.size) * (2 / reach)),
      offsetY: clamp(d.offsetY + ((e.clientY - d.y) / d.size) * (2 / reach)),
    });
  }
  const busy = check.status === "checking" || saving !== null;
  const quality = check.status === "ready" ? check.quality : null;
  const canSave = quality && quality.label !== "poor";

  return (
    <main className="collection-page marker-maker-page">
      <div className="mm-heading">
        <button className="button text-button" onClick={onBack}>
          <ArrowLeft size={15} />
          Back to editor
        </button>
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            YOUR OWN MARKER
          </span>
          <h1>Make a marker</h1>
          <p>
            Upload a photo, add a title and check that phones can track it. Each
            project can use its own marker.
          </p>
        </div>
      </div>
      <div className="mm-layout">
        <section className="mm-controls" aria-label="Marker design">
          <div className="mm-section">
            <span className="field-label">1. PHOTO</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              aria-label="Marker photo file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) choosePhoto(file);
              }}
            />
            <button
              className={`button ${photo ? "secondary" : "primary"} full`}
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              <ImagePlus size={16} />
              {photo ? "Change photo" : "Upload a photo"}
            </button>
            {photo ? (
              <>
                <p className="mm-file">{photoName}</p>
                <label className="mm-range">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={design.zoom}
                    disabled={busy}
                    aria-label="Photo zoom"
                    onChange={(e) => change({ zoom: Number(e.target.value) })}
                  />
                </label>
                <label className="mm-range">
                  <span>Left / right</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={design.offsetX}
                    disabled={busy}
                    aria-label="Photo left and right"
                    onChange={(e) =>
                      change({ offsetX: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="mm-range">
                  <span>Up / down</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={design.offsetY}
                    disabled={busy}
                    aria-label="Photo up and down"
                    onChange={(e) =>
                      change({ offsetY: Number(e.target.value) })
                    }
                  />
                </label>
                <p className="mm-hint">
                  <Move size={12} /> You can also drag the photo in the preview.
                </p>
              </>
            ) : (
              <p className="mm-hint">JPG, PNG or WebP, up to 20 MB.</p>
            )}
          </div>
          <div className="mm-section">
            <label className="field-label" htmlFor="marker-text">
              2. TEXT
            </label>
            <input
              id="marker-text"
              aria-label="Marker text"
              className="mm-input"
              value={design.text}
              maxLength={40}
              placeholder="e.g. Our Solar System"
              disabled={busy}
              onChange={(e) => change({ text: e.target.value })}
            />
            <div
              className="mm-segmented"
              role="radiogroup"
              aria-label="Text position"
            >
              {[
                ["top", "Top"],
                ["bottom", "Bottom"],
                ["none", "No text"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={design.textPosition === id}
                  className={design.textPosition === id ? "active" : ""}
                  disabled={busy}
                  onClick={() => change({ textPosition: id })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mm-range">
              <span>Text size</span>
              <input
                type="range"
                min="44"
                max="116"
                step="2"
                value={design.textSize}
                disabled={busy || design.textPosition === "none"}
                aria-label="Text size"
                onChange={(e) => change({ textSize: Number(e.target.value) })}
              />
            </label>
            <span className="mm-small-label">Text band</span>
            <div
              className="mm-swatches"
              role="radiogroup"
              aria-label="Text band"
            >
              {BAND_STYLES.map((b) => (
                <button
                  key={b.id}
                  role="radio"
                  aria-checked={design.band === b.id}
                  aria-label={`${b.name} text band`}
                  title={b.name}
                  className={`${design.band === b.id ? "active" : ""} ${b.fill ? "" : "empty"}`}
                  style={b.fill ? { background: b.fill } : undefined}
                  disabled={busy || design.textPosition === "none"}
                  onClick={() => change({ band: b.id })}
                >
                  {design.band === b.id ? (
                    <Check size={12} color={b.fill ? b.text : "#6c50bf"} />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="mm-section">
            <span className="field-label">3. FRAME</span>
            <div className="mm-swatches" role="radiogroup" aria-label="Frame">
              {FRAME_COLORS.map((f) => (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={design.frame === f.id}
                  aria-label={`${f.name} frame`}
                  title={f.name}
                  className={`${design.frame === f.id ? "active" : ""} ${f.color ? "" : "empty"}`}
                  style={f.color ? { background: f.color } : undefined}
                  disabled={busy}
                  onClick={() => change({ frame: f.id })}
                >
                  {design.frame === f.id ? (
                    <Check
                      size={12}
                      color={
                        !f.color || f.id === "white" || f.id === "yellow"
                          ? "#6c50bf"
                          : "#fff"
                      }
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="mm-section">
            <label className="field-label" htmlFor="marker-name">
              4. MARKER NAME
            </label>
            <input
              id="marker-name"
              aria-label="Marker name"
              className="mm-input"
              value={name}
              maxLength={40}
              placeholder={design.text.trim() || "e.g. Grade 4 Science"}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="mm-hint">
              Only you see this name in your marker list.
            </p>
          </div>
        </section>
        <section className="mm-preview" aria-label="Marker preview">
          <div
            className={`mm-canvas-wrap ${photo ? "has-photo" : ""}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <canvas
              ref={canvas}
              aria-label="Marker design preview"
              data-testid="marker-canvas"
            />
            {!photo ? (
              <button
                className="mm-empty"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={26} />
                <strong>Upload a photo to start</strong>
                <span>Colourful photos with lots of detail work best.</span>
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="mm-error" role="alert">
              <TriangleAlert size={15} />
              {error}
            </p>
          ) : null}
          {check.status === "checking" ? (
            <div className="mm-progress" role="status">
              <span>
                <LoaderCircle size={14} className="spin" />
                Checking how phones see your marker…{" "}
                {Math.round(check.progress * 100)}%
              </span>
              <i style={{ width: `${Math.round(check.progress * 100)}%` }} />
            </div>
          ) : quality ? (
            <div
              className={`mm-quality ${quality.label}`}
              role="status"
              data-quality={quality.label}
            >
              <div className="mm-quality-top">
                {quality.label === "poor" ? (
                  <TriangleAlert size={18} />
                ) : (
                  <ScanLine size={18} />
                )}
                <div>
                  <strong>{QUALITY_TEXT[quality.label].title}</strong>
                  <span>{QUALITY_TEXT[quality.label].text}</span>
                </div>
              </div>
              <div
                className="mm-meter"
                aria-label={`Tracking score ${Math.round(quality.score * 100)} out of 100`}
              >
                <i style={{ width: `${Math.max(4, quality.score * 100)}%` }} />
              </div>
            </div>
          ) : null}
          <div className="mm-actions">
            {!quality ? (
              <button
                className="button primary"
                onClick={runCheck}
                disabled={!photo || busy}
              >
                <ScanLine size={16} />
                Check tracking
              </button>
            ) : !canSave ? (
              <button
                className="button primary"
                onClick={() => fileInput.current?.click()}
              >
                <RotateCcw size={16} />
                Try another photo
              </button>
            ) : !cloudEnabled() ? (
              <p className="media-notice">
                <CloudOff size={14} />
                Saving markers needs online storage, which is not switched on
                for this website yet. Ask your library provider.
              </p>
            ) : !session ? (
              <button className="button primary" onClick={onSignIn}>
                <Mail size={16} />
                Sign in to save this marker
              </button>
            ) : saving !== null ? (
              <div className="mm-progress" role="status">
                <span>
                  <LoaderCircle size={14} className="spin" />
                  Saving marker… {Math.round(saving * 100)}%
                </span>
                <i style={{ width: `${Math.round(saving * 100)}%` }} />
                <button onClick={() => abort.current?.abort()}>Cancel</button>
              </div>
            ) : (
              <button className="button primary" onClick={save}>
                <Check size={16} />
                Save &amp; use in this project
              </button>
            )}
            <button
              className="button secondary"
              onClick={downloadImage}
              disabled={!photo || busy}
            >
              <Download size={15} />
              Download picture
            </button>
          </div>
          <div className="mm-tips">
            <Lightbulb size={16} />
            <ul>
              <li>Pick a photo with many details, colours and edges.</li>
              <li>
                Avoid plain backgrounds, blurry photos and big empty areas.
              </li>
              <li>Keep text short; the photo does the tracking.</li>
              <li>Print on matte paper and keep the page flat.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
