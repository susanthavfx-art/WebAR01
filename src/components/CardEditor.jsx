import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FileAudio,
  FileVideo,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Mic,
  Move3D,
  Palette,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Unlink,
  Upload,
  X,
} from "lucide-react";
import { CARD_ICONS } from "./LessonCards";
import {
  CARD_COLORS,
  CARD_TEXT_LIMIT,
  CARD_TITLE_LIMIT,
  CARD_TYPE_NAMES,
  LINK_LABEL_LIMIT,
  MAX_CARDS,
  cardIsReady,
  formatDuration,
  linkHost,
  normaliseWebLink,
  safeHttpsUrl,
} from "../lib/lesson-cards";
import { saveLocalFile, resolveResourceUrl } from "../lib/local-files";

const AUDIO_LIMIT = 20 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;
const MAX_RECORDING = 300;

const TOOL_TEXT = {
  text: "Explain a part in words",
  audio: "Record or upload a voice",
  video: "Upload a short video",
  image: "Show a picture",
  link: "Open a website",
};

export function LessonToolsPanel({ cards, selectedId, onAdd, onSelect }) {
  return (
    <div className="library-scroll lesson-tools">
      <p className="panel-description">
        Add explanation boxes beside your model. Point each box to a part of the
        model.
      </p>
      <div className="lesson-tool-grid">
        {Object.keys(CARD_TYPE_NAMES).map((type) => {
          const Icon = CARD_ICONS[type];
          return (
            <button
              key={type}
              className={`lesson-tool type-${type}`}
              onClick={() => onAdd(type)}
              disabled={cards.length >= MAX_CARDS}
              aria-label={`Add ${CARD_TYPE_NAMES[type].toLowerCase()}`}
            >
              <span>
                <Icon size={19} />
              </span>
              <strong>{CARD_TYPE_NAMES[type]}</strong>
              <small>{TOOL_TEXT[type]}</small>
            </button>
          );
        })}
      </div>
      <div className="library-section-label">
        <span>BOXES IN THIS SCENE</span>
        <span>
          {cards.length}/{MAX_CARDS}
        </span>
      </div>
      {cards.length ? (
        <div className="lesson-box-list">
          {cards.map((card) => {
            const Icon = CARD_ICONS[card.type];
            return (
              <button
                key={card.id}
                className={`lesson-box-row ${selectedId === card.id ? "active" : ""}`}
                onClick={() => onSelect(card.id)}
                style={{ "--card-color": card.color }}
              >
                <span className="lesson-card-icon">
                  <Icon size={13} />
                </span>
                <span>
                  <strong>{card.title || "Untitled box"}</strong>
                  <small>
                    {CARD_TYPE_NAMES[card.type]}
                    {!cardIsReady(card) ? " · needs content" : ""}
                    {!card.visible ? " · hidden" : ""}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="lesson-empty-note">
          No boxes yet. Choose a box above to start explaining your model.
        </p>
      )}
      <div className="teacher-account muted">
        <ShieldCheck size={16} />
        <span>
          <strong>Separate boxes for each model</strong>
          <small>Text, audio, video, images &amp; links export with Publish.</small>
        </span>
      </div>
    </div>
  );
}

export function CardProperties({
  card,
  objects,
  update,
  onDelete,
  onDuplicate,
  picking,
  onPick,
  notify,
}) {
  const Icon = CARD_ICONS[card.type];
  const target = card.target
    ? objects.find((o) => o.id === card.target.objectId)
    : null;

  function axis(i, value) {
    if (value === "") return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    const position = [...card.position];
    position[i] = Math.max(i === 1 ? -0.5 : -6, Math.min(6, number));
    update({ position });
  }

  return (
    <div className="card-properties">
      <div
        className="selected-object-card lesson-selected"
        style={{ "--card-color": card.color }}
      >
        <span className="selected-object-art lesson-selected-art">
          <Icon size={26} />
        </span>
        <div>
          <span>{CARD_TYPE_NAMES[card.type].toUpperCase()}</span>
          <strong className="lesson-selected-title">
            {card.title || "Untitled box"}
          </strong>
          <small>Drag the box in the scene to move it.</small>
        </div>
      </div>
      <div className="object-action-row">
        <button onClick={onDuplicate}>
          <Copy size={13} />
          Duplicate
        </button>
        <span />
        <button onClick={() => update({ visible: !card.visible })}>
          {card.visible ? <EyeOff size={13} /> : <Eye size={13} />}
          {card.visible ? "Hide" : "Show"}
        </button>
        <span />
        <button onClick={onDelete}>
          <Trash2 size={13} />
          Remove
        </button>
      </div>
      <section className="property-section">
        <label className="field-label" htmlFor="card-title">
          TITLE
        </label>
        <input
          id="card-title"
          className="text-input"
          aria-label="Box title"
          value={card.title}
          maxLength={CARD_TITLE_LIMIT}
          onChange={(e) =>
            update({ title: e.target.value.slice(0, CARD_TITLE_LIMIT) })
          }
        />
        <div className="field-label-row">
          <label className="field-label" htmlFor="card-text">
            {card.type === "text" ? "EXPLANATION" : "SHORT DESCRIPTION"}
          </label>
          <small>
            {card.text.length}/{CARD_TEXT_LIMIT}
          </small>
        </div>
        <textarea
          id="card-text"
          className="text-input"
          aria-label="Box text"
          rows={card.type === "text" ? 6 : 3}
          value={card.text}
          maxLength={CARD_TEXT_LIMIT}
          onChange={(e) =>
            update({ text: e.target.value.slice(0, CARD_TEXT_LIMIT) })
          }
        />
      </section>
      {card.type === "audio" && (
        <MediaField
          kind="audio"
          media={card.media}
          onChange={(media) => update({ media })}
          notify={notify}
        />
      )}
      {card.type === "video" && (
        <MediaField
          kind="video"
          media={card.media}
          onChange={(media) => update({ media })}
          notify={notify}
        />
      )}
      {card.type === "image" && (
        <ImageField card={card} update={update} notify={notify} />
      )}
      {card.type === "link" && <LinkField card={card} update={update} />}
      <section className="property-section">
        <div className="property-section-heading">
          <h3>
            <Crosshair size={14} />
            Points to
          </h3>
          {card.target && (
            <button onClick={() => update({ target: null })}>
              <Unlink size={12} />
              Remove line
            </button>
          )}
        </div>
        <p className="pointer-status">
          {target
            ? `A line points to ${target.name}.`
            : "No line yet. Choose the model part this box explains."}
        </p>
        <button
          className={`button secondary full ${picking ? "picking" : ""}`}
          onClick={onPick}
          disabled={!objects.some((o) => o.visible !== false)}
        >
          <Crosshair size={15} />
          {picking
            ? "Click a model part… (Esc to cancel)"
            : "Point to a model part"}
        </button>
      </section>
      <section className="property-section color-section">
        <div className="property-section-heading">
          <h3>
            <Palette size={14} />
            Box colour
          </h3>
        </div>
        <div className="color-swatches">
          {CARD_COLORS.map((c) => (
            <button
              key={c.id}
              style={{ background: c.id }}
              className={card.color === c.id ? "active" : ""}
              aria-label={`Box colour ${c.name}`}
              onClick={() => update({ color: c.id })}
            >
              {card.color === c.id && <Check size={14} />}
            </button>
          ))}
        </div>
      </section>
      <section className="property-section">
        <div className="property-section-heading">
          <h3>
            <Move3D size={14} />
            Position
          </h3>
          <button
            onClick={() =>
              update({ position: [card.position[0], 1.5, card.position[2]] })
            }
          >
            <RotateCcw size={12} />
            Height
          </button>
        </div>
        <div className="vector-fields">
          {["X", "Y", "Z"].map((name, i) => (
            <label key={name}>
              <span className={`axis-${name.toLowerCase()}`}>{name}</span>
              <input
                aria-label={`Box position ${name}`}
                type="number"
                step="0.1"
                min={i === 1 ? -0.5 : -6}
                max="6"
                value={card.position[i]}
                onChange={(e) => axis(i, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

function ImageField({ card, update, notify }) {
  const input = useRef(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUrl("");
    setError("");
  }, [card.id]);

  async function upload(file) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const saved = await saveLocalFile(file, "image");
      update({
        media: {
          url: saved.ref,
          name: saved.name,
          mime: saved.type,
          size: saved.size,
        },
      });
      notify("Image added to Lesson box.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function useUrl() {
    const safe = safeHttpsUrl(url);
    if (!safe) {
      setError("Enter a direct HTTPS image address.");
      return;
    }
    setError("");
    update({ media: { url: safe, name: "Image", mime: "image/jpeg" } });
    notify("Image link added.");
  }

  const src = card.media && resolveResourceUrl(card.media.url);
  return (
    <section className="property-section media-field image-field">
      <div className="property-section-heading">
        <h3>
          <ImageIcon size={14} /> Picture
        </h3>
        {card.media && (
          <button onClick={() => update({ media: null })}>
            <X size={12} /> Remove
          </button>
        )}
      </div>
      {src && (
        <div className="image-field-preview">
          <img src={src} alt="Image box preview" />
          <small>{card.media.name}</small>
        </div>
      )}
      <button
        className="button secondary full"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <LoaderCircle size={15} className="spin" />
        ) : (
          <Upload size={15} />
        )}
        {busy ? "Saving image…" : card.media ? "Replace image" : "Upload image"}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        aria-label="Choose image for box"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          upload(file);
        }}
      />
      <label className="field-label image-url-label" htmlFor="image-box-url">
        OR DIRECT HTTPS IMAGE LINK
      </label>
      <div className="image-url-row">
        <input
          id="image-box-url"
          className="text-input"
          aria-label="Image URL"
          value={url}
          placeholder="https://…"
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="button secondary" onClick={useUrl}>
          Use
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="small-note">
        JPG, PNG or WebP up to 20 MB. Bundled automatically when you publish.
      </p>
    </section>
  );
}

function LinkField({ card, update }) {
  const [draft, setDraft] = useState(card.link?.url || "");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(card.link?.url || "");
    setError("");
  }, [card.id]);

  function save(value = draft) {
    if (!value.trim()) {
      setError("");
      update({ link: { ...card.link, url: "" } });
      return;
    }
    const url = normaliseWebLink(value);
    if (!url) {
      setError(
        "Enter a full website address, for example https://example.com.",
      );
      return;
    }
    setError("");
    setDraft(url);
    update({ link: { ...card.link, url } });
  }

  return (
    <section className="property-section">
      <div className="property-section-heading">
        <h3>
          <Link2 size={14} />
          Web link
        </h3>
      </div>
      <label className="field-label" htmlFor="card-link">
        WEBSITE ADDRESS
      </label>
      <input
        id="card-link"
        className="text-input"
        aria-label="Web link"
        inputMode="url"
        placeholder="https://"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        aria-invalid={!!error}
      />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : card.link?.url ? (
        <p className="field-ok">
          <Check size={12} /> Opens {linkHost(card.link.url)} in a new tab
        </p>
      ) : null}
      <label className="field-label" htmlFor="card-link-label">
        BUTTON TEXT
      </label>
      <input
        id="card-link-label"
        className="text-input"
        aria-label="Link button text"
        maxLength={LINK_LABEL_LIMIT}
        value={card.link?.label || ""}
        onChange={(e) =>
          update({
            link: {
              ...card.link,
              label: e.target.value.slice(0, LINK_LABEL_LIMIT),
            },
          })
        }
      />
    </section>
  );
}

function measureDuration(blob, kind) {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    const url = URL.createObjectURL(blob);
    const done = (value) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
      resolve(Number.isFinite(value) && value > 0 ? value : undefined);
    };
    const timer = setTimeout(() => done(undefined), 4000);
    element.preload = "metadata";
    element.onloadedmetadata = () => done(element.duration);
    element.onerror = () => done(undefined);
    element.src = url;
  });
}

const sizeText = (bytes) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function MediaField({
  kind,
  media,
  onChange,
  notify,
  title,
  previewLabel,
  doneMessage,
  note = "Included automatically in your Publish & share package.",
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const input = useRef(null);
  const Icon = kind === "audio" ? FileAudio : FileVideo;

  async function upload(file, extra = {}) {
    setError("");
    setSaving(true);
    try {
      const duration = extra.duration || (await measureDuration(file, kind));
      const saved = await saveLocalFile(file, kind);
      onChange({
        url: saved.ref,
        name: saved.name,
        mime: saved.type,
        size: saved.size,
        ...extra,
        ...(duration ? { duration } : {}),
      });
      notify(
        doneMessage ||
          (kind === "audio"
            ? "Audio added to your box."
            : "Video added to your box."),
      );
      setRecording(false);
    } catch (e) {
      setError(e.message || "Could not save media file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="property-section media-field">
      <div className="property-section-heading">
        <h3>
          <Icon size={14} />
          {title || (kind === "audio" ? "Voice or audio" : "Video")}
        </h3>
        {media && (
          <button onClick={() => onChange(null)}>
            <X size={12} />
            Remove
          </button>
        )}
      </div>
      {media ? (
        <div className="media-preview">
          {kind === "audio" ? (
            <audio
              controls
              preload="metadata"
              src={resolveResourceUrl(media.url)}
              aria-label={previewLabel || "Box audio preview"}
            />
          ) : (
            <video
              controls
              playsInline
              preload="metadata"
              src={resolveResourceUrl(media.url)}
              aria-label="Box video preview"
            />
          )}
          <p>
            <strong>{media.recorded ? "Voice recording" : media.name}</strong>
            <small>
              {[
                formatDuration(media.duration),
                media.size ? sizeText(media.size) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </small>
          </p>
        </div>
      ) : null}
      {saving ? (
        <div className="upload-progress" role="status">
          <span>
            <LoaderCircle size={14} className="spin" />
            Saving on this device…
          </span>
          <i style={{ width: "100%" }} />
        </div>
      ) : recording ? (
        <VoiceRecorder
          onCancel={() => setRecording(false)}
          onUse={(blob, duration) => {
            const type = blob.type.split(";")[0] || "audio/webm";
            const ext = type.includes("mp4")
              ? "m4a"
              : type.includes("ogg")
                ? "ogg"
                : "webm";
            upload(new File([blob], `voice-recording.${ext}`, { type }), {
              recorded: true,
              name: "Voice recording",
              duration,
            });
          }}
        />
      ) : (
        <div className="media-buttons">
          {kind === "audio" && (
            <button
              className="button secondary"
              onClick={() => setRecording(true)}
            >
              <Mic size={15} />
              {media ? "Record again" : "Record voice"}
            </button>
          )}
          <button
            className="button secondary"
            onClick={() => input.current?.click()}
          >
            <Upload size={15} />
            {media
              ? "Replace file"
              : kind === "audio"
                ? "Upload audio"
                : "Upload video"}
          </button>
          <input
            ref={input}
            type="file"
            hidden
            aria-label={
              kind === "audio" ? "Choose audio file" : "Choose video file"
            }
            accept={
              kind === "audio"
                ? "audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac"
                : "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            }
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <p className="small-note">
        {kind === "audio"
          ? `MP3, M4A, WAV or WebM up to ${AUDIO_LIMIT / 1024 / 1024} MB. Recordings up to 5 minutes.`
          : `MP4 (H.264) plays on most phones. Up to ${VIDEO_LIMIT / 1024 / 1024} MB.`}{" "}
        {note}
      </p>
    </section>
  );
}

function recorderType() {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    [
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ].find((type) => MediaRecorder.isTypeSupported?.(type)) || ""
  );
}

function VoiceRecorder({ onUse, onCancel }) {
  const [state, setState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const started = useRef(0);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(
    () => () => {
      clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopTracks();
    },
    [],
  );

  useEffect(
    () => () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  async function start() {
    setError("");
    const type = recorderType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser cannot record audio. Upload an audio file instead.",
      );
      return;
    }
    try {
      setState("asking");
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const chunks = [];
      const rec = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : undefined,
      );
      recorder.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      rec.onstop = () => {
        clearInterval(timer.current);
        stopTracks();
        const blob = new Blob(chunks, {
          type: rec.mimeType || type || "audio/webm",
        });
        const duration = (performance.now() - started.current) / 1000;
        if (blob.size < 64) {
          setError(
            "The recording was empty. Check your microphone and try again.",
          );
          setState("idle");
          return;
        }
        setResult({ blob, duration, url: URL.createObjectURL(blob) });
        setState("review");
      };
      started.current = performance.now();
      setSeconds(0);
      rec.start(1000);
      setState("recording");
      timer.current = setInterval(() => {
        const s = Math.floor((performance.now() - started.current) / 1000);
        setSeconds(s);
        if (s >= MAX_RECORDING && rec.state === "recording") rec.stop();
      }, 250);
    } catch (e) {
      stopTracks();
      setState("idle");
      setError(
        e?.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the microphone in your browser settings."
          : e?.name === "NotFoundError"
            ? "No microphone was found on this device."
            : "The microphone could not start. Try again or upload a file.",
      );
    }
  }

  return (
    <div className="voice-recorder" aria-live="polite">
      {state === "review" && result ? (
        <>
          <audio
            controls
            src={result.url}
            aria-label="Recorded voice preview"
          />
          <p className="recorder-time">
            Recording · {formatDuration(result.duration) || "0:01"}
          </p>
          <div className="media-buttons">
            <button
              className="button primary"
              onClick={() => onUse(result.blob, result.duration)}
            >
              <Check size={15} />
              Use recording
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setResult(null);
                setState("idle");
              }}
            >
              <RotateCcw size={15} />
              Record again
            </button>
          </div>
        </>
      ) : state === "recording" ? (
        <>
          <p className="recorder-live">
            <span className="record-dot" />
            Recording {formatDuration(seconds) || "0:00"} / 5:00
          </p>
          <button
            className="button primary full"
            onClick={() => recorder.current?.stop()}
          >
            <Square size={14} />
            Stop recording
          </button>
        </>
      ) : (
        <>
          <p className="recorder-help">
            Speak clearly near your microphone. You can listen before you add
            it.
          </p>
          <div className="media-buttons">
            <button
              className="button primary"
              onClick={start}
              disabled={state === "asking"}
            >
              {state === "asking" ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Mic size={15} />
              )}
              {state === "asking" ? "Allow microphone…" : "Start recording"}
            </button>
            <button className="button secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
