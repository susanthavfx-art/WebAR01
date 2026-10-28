import React, { useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  FileImage,
  FilePlus2,
  FileScan,
  FolderHeart,
  ImagePlus,
  Layers3,
  LoaderCircle,
  PackageCheck,
  Pencil,
  Plus,
  QrCode,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Modal } from "./UI";
import { publicUrl } from "../lib/deployment";
import {
  saveLocalFile,
  resolveResourceUrl,
  inspectMindFile,
  combineMindFiles,
} from "../lib/local-files";
import {
  MAX_FLASHCARDS,
  MAX_MINIS,
  createPublication,
  defaultPublicBase,
  draftUrl,
  miniProblems,
  sceneForEntry,
} from "../lib/mini-projects";
import { downloadBlob } from "../lib/projects";

const MODES = [
  {
    id: "individual",
    icon: QrCode,
    title: "A QR on every card",
    short: "Individual QR codes",
    description: "Each card opens its own AR experience.",
    example: "Perfect for birthday, Christmas & Vesak cards.",
    color: "peach",
  },
  {
    id: "shared",
    icon: Layers3,
    title: "One QR for a whole set",
    short: "One shared QR code",
    description: "Open one camera and scan any card in the set.",
    example: "Perfect for dinosaurs, animals & alphabet cards.",
    color: "purple",
  },
];
const fileSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function ModeChoices({ value, onChange }) {
  return (
    <div className="mini-mode-grid" role="radiogroup" aria-label="QR code mode">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="radio"
          aria-checked={value === mode.id}
          className={`mini-mode-card ${mode.color} ${value === mode.id ? "selected" : ""}`}
          onClick={() => onChange(mode.id)}
        >
          <span className="mini-mode-icon">
            <mode.icon size={21} />
          </span>
          <span className="mini-mode-copy">
            <strong>{mode.title}</strong>
            <small>{mode.description}</small>
            <em>{mode.example}</em>
          </span>
          <span className="mini-radio">
            {value === mode.id && <Check size={13} />}
          </span>
        </button>
      ))}
    </div>
  );
}
function NewMiniModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("shared");
  return (
    <Modal
      label="Create a mini project"
      className="mini-new-modal"
      onClose={onClose}
    >
      <span className="mini-kicker">
        <Sparkles size={13} /> LET'S MAKE SOMETHING
      </span>
      <h2>A little project, a lot of wonder.</h2>
      <p>
        Choose how you want people to open your cards. You can change this
        later.
      </p>
      <label className="mini-field-label" htmlFor="new-mini-title">
        PROJECT NAME
      </label>
      <input
        id="new-mini-title"
        autoFocus
        className="text-input"
        aria-label="Mini project name"
        value={title}
        maxLength={70}
        placeholder="e.g. My dinosaur flash cards"
        onChange={(e) => setTitle(e.target.value)}
      />
      <label className="mini-field-label">HOW SHOULD THE QR WORK?</label>
      <ModeChoices value={mode} onChange={setMode} />
      <button
        className="button primary full mini-create-submit"
        onClick={() => onCreate(title, mode)}
      >
        Create mini project <ArrowRight size={16} />
      </button>
    </Modal>
  );
}
function UploadSlot({
  kind,
  label,
  description,
  value,
  onSave,
  disabled = false,
  ariaLabel,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const accept =
    kind === "model"
      ? ".glb,model/gltf-binary"
      : kind === "target"
        ? ".mind,application/octet-stream"
        : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
  const Icon =
    kind === "model" ? Boxes : kind === "target" ? FileScan : FileImage;
  async function select(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onSave(await saveLocalFile(file, kind));
    } catch (e) {
      setError(e.message || "The file could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`mini-upload ${value ? "has-file" : ""}`}>
      <span className="mini-upload-icon">
        <Icon size={18} />
      </span>
      <span className="mini-upload-copy">
        <strong>{label}</strong>
        <small>
          {value ? (
            <>
              {value.name} · {fileSize(value.size)}
              {value.targetCount
                ? ` · ${value.targetCount} ${value.targetCount === 1 ? "target" : "targets"}`
                : ""}
            </>
          ) : (
            description
          )}
        </small>
        {error && (
          <small className="mini-upload-error" role="alert">
            {error}
          </small>
        )}
      </span>
      <label
        className={`mini-upload-button ${disabled || busy ? "disabled" : ""}`}
      >
        {busy ? (
          <LoaderCircle size={14} className="spin" />
        ) : (
          <Upload size={14} />
        )}
        {busy ? "Saving" : value ? "Replace" : "Upload"}
        <input
          type="file"
          className="visually-hidden"
          aria-label={ariaLabel || label}
          accept={accept}
          disabled={disabled || busy}
          onChange={select}
        />
      </label>
    </div>
  );
}
function MindCombiner({ onSave }) {
  const [files, setFiles] = useState([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function choose(event) {
    const selected = [...(event.target.files || [])];
    event.target.value = "";
    if (!selected.length) return;
    if (
      selected.length > 50 ||
      selected.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024
    ) {
      setError("Choose up to 50 .mind files, under 100 MB in total.");
      return;
    }
    setError("");
    setBusy("Checking your .mind files…");
    try {
      const items = [];
      for (const file of selected)
        items.push({
          id: crypto.randomUUID(),
          file,
          count: await inspectMindFile(file),
        });
      if (items.reduce((sum, item) => sum + item.count, 0) > 100)
        throw new Error("Use at most 100 targets in a combined file.");
      setFiles(items);
    } catch (e) {
      setFiles([]);
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function move(index, direction) {
    setFiles((old) => {
      const next = [...old],
        other = index + direction;
      if (other < 0 || other >= next.length) return old;
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }
  async function combine() {
    setError("");
    setBusy("Combining target files…");
    try {
      onSave(
        await combineMindFiles(
          files.map((item) => item.file),
          setBusy,
        ),
      );
      setFiles([]);
    } catch (e) {
      setError(e.message || "Could not combine target files.");
    } finally {
      setBusy("");
    }
  }
  let offset = 0;
  return (
    <div className="mini-combiner">
      <div className="mini-combiner-heading">
        <div>
          <strong>Have separate .mind files?</strong>
          <p>
            Combine your existing files instead. No need to recompile the
            images.
          </p>
        </div>
        <label className={`mini-combiner-select ${busy ? "disabled" : ""}`}>
          <Upload size={13} /> Choose files
          <input
            className="visually-hidden"
            type="file"
            multiple
            accept=".mind,application/octet-stream"
            aria-label="Choose separate mind files to combine"
            disabled={!!busy}
            onChange={choose}
          />
        </label>
      </div>
      {busy && (
        <p className="mini-combiner-busy">
          <LoaderCircle size={13} className="spin" /> {busy}
        </p>
      )}
      {error && (
        <p className="mini-error" role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <>
          <p className="mini-combiner-note">
            Arrange the files in the same order as your cards. The resulting
            target indices are shown below.
          </p>
          <ol className="mini-combiner-list">
            {files.map((item, index) => {
              const first = offset;
              offset += item.count;
              return (
                <li key={item.id}>
                  <span>
                    {first === offset - 1
                      ? `#${first}`
                      : `#${first}–${offset - 1}`}
                  </span>
                  <strong>{item.file.name}</strong>
                  <small>
                    {item.count} {item.count === 1 ? "target" : "targets"}
                  </small>
                  <button
                    disabled={!!busy || index === 0}
                    aria-label={`Move ${item.file.name} up`}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    disabled={!!busy || index === files.length - 1}
                    aria-label={`Move ${item.file.name} down`}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    disabled={!!busy}
                    aria-label={`Remove ${item.file.name} from combination`}
                    onClick={() =>
                      setFiles((old) => old.filter((x) => x.id !== item.id))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            className="button secondary mini-combine-button"
            onClick={combine}
            disabled={!!busy}
          >
            <Layers3 size={14} /> Combine and use these files
          </button>
        </>
      )}
    </div>
  );
}

function MiniOverview({ minis, onNew, onSelect, saveState }) {
  return (
    <main className="mini-page mini-overview">
      <div className="mini-overview-head">
        <div>
          <span className="mini-kicker">
            <Sparkles size={13} /> YOUR CREATIVE SPACE
          </span>
          <h1>
            Little projects. <span>Big magic.</span>
          </h1>
          <p>
            Make an AR card for someone special, or bring a whole set of flash
            cards to life.
          </p>
        </div>
        <button
          className="button primary"
          onClick={onNew}
          disabled={minis.length >= MAX_MINIS}
        >
          <Plus size={17} /> New mini project
        </button>
      </div>
      <div className="mini-hero">
        <div className="mini-hero-copy">
          <span className="mini-pill">
            <span /> A NEW WAY TO CREATE
          </span>
          <h2>
            One idea.
            <br />
            <em>Endless wonder.</em>
          </h2>
          <p>
            Use the models and markers you already have. Pick your QR style, add
            your files, and let your cards tell their story.
          </p>
          <button onClick={onNew} disabled={minis.length >= MAX_MINIS}>
            Start a mini project <ArrowRight size={16} />
          </button>
        </div>
        <img
          src={publicUrl("brand/mini-project-hero.png")}
          alt="Illustration of flash cards and a phone bringing a dinosaur to life"
        />
        <div className="mini-hero-stamp">
          <Sparkles size={15} /> MADE FOR
          <br /> IMAGINATION
        </div>
      </div>
      <div className="mini-section-heading">
        <div>
          <span className="mini-kicker">PICK UP WHERE YOU LEFT OFF</span>
          <h2>
            My mini projects <span>{minis.length}</span>
          </h2>
        </div>
        <span className="mini-local-label">
          <ShieldCheck size={15} />{" "}
          {saveState === "error"
            ? "Storage unavailable"
            : "Saved on this device"}
        </span>
      </div>
      {minis.length ? (
        <div className="mini-project-grid">
          {minis.map((mini, i) => (
            <button
              className="mini-project-tile"
              key={mini.id}
              onClick={() => onSelect(mini.id)}
            >
              <span className={`mini-tile-art tile-${i % 3}`}>
                <span>
                  <ScanLine size={24} />
                </span>
                <i />
                <i />
                <i />
              </span>
              <span className="mini-tile-copy">
                <strong>{mini.title}</strong>
                <small>
                  {mini.entries.length}{" "}
                  {mini.entries.length === 1 ? "card" : "cards"} ·{" "}
                  {mini.mode === "shared" ? "One shared QR" : "QR per card"}
                </small>
                <span>
                  Open project <ArrowRight size={14} />
                </span>
              </span>
            </button>
          ))}
          <button className="mini-project-tile mini-tile-new" onClick={onNew}>
            <span>
              <Plus size={24} />
            </span>
            <strong>Make another little world</strong>
            <small>Start with a fresh idea</small>
          </button>
        </div>
      ) : (
        <div className="mini-empty">
          <span>
            <FolderHeart size={24} />
          </span>
          <div>
            <strong>Your first project is waiting.</strong>
            <p>
              Choose “New mini project” to begin. Your creations stay in this
              browser.
            </p>
          </div>
          <button onClick={onNew}>
            Let's start <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div className="mini-guide-grid">
        <div>
          <span>01</span>
          <strong>Choose your QR style</strong>
          <p>One per card, or one for the entire set.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Add your existing files</strong>
          <p>Upload your markers, GLB models and .mind targets.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Publish & explore</strong>
          <p>Export, host, then scan your cards on a phone.</p>
        </div>
      </div>
    </main>
  );
}
function MiniEntry({
  entry,
  index,
  mini,
  scene,
  projects,
  onUpdate,
  onEdit,
  onRemove,
  onPreview,
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const ownProblems = miniProblems(
    { ...mini, entries: [entry] },
    scene ? [scene] : [],
  );
  const thumb = entry.marker && resolveResourceUrl(entry.marker.ref);
  return (
    <article className={`mini-entry ${expanded ? "expanded" : ""}`}>
      <div className="mini-entry-summary">
        <button
          className="mini-entry-toggle"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${entry.title}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="mini-entry-thumb">
            {thumb ? <img src={thumb} alt="" /> : <ImagePlus size={20} />}
          </span>
          <span>
            <small>
              CARD {String(index + 1).padStart(2, "0")} · TARGET{" "}
              {entry.targetIndex}
            </small>
            <strong>{entry.title}</strong>
            <em>
              {ownProblems.length ? "A few things to add" : "Ready to preview"}
            </em>
          </span>
        </button>
        <span
          className={`mini-entry-status ${ownProblems.length ? "pending" : "ready"}`}
        >
          {ownProblems.length ? "IN PROGRESS" : "READY"}
        </span>
        <button
          className="mini-entry-chevron"
          aria-label={`${expanded ? "Collapse" : "Expand"} card details`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {expanded && (
        <div className="mini-entry-body">
          <div className="mini-entry-fields">
            <label>
              <span>CARD NAME</span>
              <input
                className="text-input"
                aria-label={`Name of card ${index + 1}`}
                value={entry.title}
                maxLength={70}
                onChange={(e) => onUpdate({ title: e.target.value })}
                onBlur={() => {
                  if (!entry.title.trim())
                    onUpdate({ title: `Card ${index + 1}` });
                }}
              />
            </label>
            <label className="mini-index-field">
              <span>MINDAR TARGET INDEX</span>
              <input
                className="text-input"
                aria-label={`Target index for card ${index + 1}`}
                type="number"
                min="0"
                max="99"
                value={entry.targetIndex}
                onChange={(e) => {
                  if (e.target.value !== "")
                    onUpdate({
                      targetIndex: Math.max(
                        0,
                        Math.min(99, Number(e.target.value)),
                      ),
                    });
                }}
              />
            </label>
          </div>
          <p className="mini-index-note">
            Index starts at 0. Match the order used to compile this{" "}
            {mini.mode === "shared" ? "set's combined" : "card's"} .mind file.
          </p>
          <div className="mini-upload-list">
            <UploadSlot
              kind="marker"
              label="Tracking marker image"
              description="JPG, PNG or WebP · the picture you will scan"
              value={entry.marker}
              ariaLabel={`Upload marker for card ${index + 1}`}
              onSave={(file) => onUpdate({ marker: file })}
            />
            <UploadSlot
              kind="model"
              label="3D model"
              description="Self-contained .glb file · up to 40 MB"
              value={entry.model}
              ariaLabel={`Upload model for card ${index + 1}`}
              onSave={(file) => onUpdate({ model: file })}
            />
            {mini.mode === "individual" && (
              <UploadSlot
                kind="target"
                label="MindAR target"
                description="The .mind file compiled from this marker"
                value={entry.target}
                ariaLabel={`Upload mind file for card ${index + 1}`}
                onSave={(file) => onUpdate({ target: file })}
              />
            )}
          </div>
          <div className="mini-entry-actions">
            <button className="button secondary" onClick={onEdit}>
              <WandSparkles size={15} /> Edit scene & boxes
            </button>
            <button
              className="button secondary"
              onClick={onPreview}
              disabled={
                mini.mode === "shared"
                  ? miniProblems(mini, projects).length > 0
                  : ownProblems.length > 0
              }
              title={ownProblems[0] || "Preview this card"}
            >
              <Camera size={15} /> Preview
            </button>
            <button
              className="mini-remove"
              onClick={onRemove}
              aria-label={`Remove ${entry.title}`}
            >
              <Trash2 size={15} /> Remove card
            </button>
          </div>
          <p className="mini-entry-hint">
            In the scene editor you can arrange models and add text, image,
            audio, video or link boxes.
          </p>
        </div>
      )}
    </article>
  );
}
function PublicationPanel({ mini, projects, saveBeforePreview }) {
  const [base, setBase] = useState(defaultPublicBase),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [publication, setPublication] = useState(null),
    [copied, setCopied] = useState("");
  const issues = miniProblems(mini, projects);
  const revision = JSON.stringify([
    mini,
    ...mini.entries.map((entry) => sceneForEntry(entry, projects)),
  ]);
  const currentPublication =
    publication &&
    publication.revision === revision &&
    publication.inputBase === base;
  async function create() {
    setError("");
    setPublication(null);
    try {
      const result = await createPublication(mini, projects, base, setBusy);
      setPublication({ ...result, revision, inputBase: base });
    } catch (e) {
      setError(e.message || "The publication could not be prepared.");
    } finally {
      setBusy("");
    }
  }
  function preview() {
    if (!saveBeforePreview()) return;
    window.open(draftUrl(mini), "_blank", "noopener,noreferrer");
  }
  async function copy(link) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(link);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Copy the address from the link below.");
    }
  }
  return (
    <section className="mini-publish-panel" id="mini-publish">
      <div className="mini-panel-heading">
        <span className="mini-step-icon gold">
          <QrCode size={19} />
        </span>
        <div>
          <span className="mini-kicker">STEP 03 · SHARE THE MAGIC</span>
          <h2>Get your QR {mini.mode === "shared" ? "code" : "codes"}</h2>
        </div>
      </div>
      <p>
        We’ll make a printable PDF, QR{" "}
        {mini.mode === "shared" ? "code" : "codes"} and a publication package
        with your files.
      </p>
      <div className="mini-publish-notice">
        <CircleAlert size={18} />
        <span>
          <strong>One important step before scanning</strong> Upload the
          exported folder to your website and deploy it. Files saved in this
          browser are not yet online.
        </span>
      </div>
      <label className="mini-field-label" htmlFor="mini-public-url">
        YOUR DEPLOYED STUDIO URL
      </label>
      <input
        id="mini-public-url"
        className="text-input"
        aria-label="Deployed studio URL"
        value={base}
        onChange={(e) => {
          setBase(e.target.value);
          setPublication(null);
        }}
        placeholder="https://your-site.example/"
      />
      <p className="mini-url-note">
        Use your permanent HTTPS website address, not a temporary preview URL.
        Anyone with the QR can view the published files.
      </p>
      {issues.length > 0 && (
        <div className="mini-checklist">
          <strong>Before you publish</strong>
          {issues.slice(0, 4).map((issue, i) => (
            <span key={i}>
              <CircleAlert size={14} />
              {issue}
            </span>
          ))}
          {issues.length > 4 && (
            <span>+ {issues.length - 4} more things to complete</span>
          )}
        </div>
      )}
      {error && (
        <p className="mini-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full mini-publish-button"
        onClick={create}
        disabled={!!busy || issues.length > 0}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <PackageCheck size={17} />
        )}
        {busy || "Prepare publication package"}
      </button>
      {mini.mode === "shared" && (
        <button
          className="mini-preview-set"
          onClick={preview}
          disabled={issues.length > 0}
        >
          <Camera size={15} /> Test this set on this device first
        </button>
      )}
      {publication && !currentPublication && (
        <p className="mini-url-note">
          The project changed after export. Prepare a new package for the latest
          version.
        </p>
      )}
      {currentPublication && (
        <div className="mini-publication-result" role="status">
          <div className="mini-result-heading">
            <BadgeCheck size={20} />
            <div>
              <strong>Package ready to upload</strong>
              <small>
                The ZIP has downloaded. Publish the folder before scanning.
              </small>
            </div>
          </div>
          <ol>
            <li>Unzip the downloaded file.</li>
            <li>
              Upload <code>public/published/{publication.id}/</code> to the same
              path in your website repository.
            </li>
            <li>
              Deploy your site, then print the included PDF and scan the QR.
            </li>
          </ol>
          <button
            className="button secondary full"
            onClick={() => downloadBlob(publication.blob, publication.filename)}
          >
            <ArrowDownToLine size={15} /> Download ZIP again
          </button>
          <div className="mini-qr-list">
            {publication.qrList.map((qr) => (
              <div className="mini-qr-row" key={qr.cardId || "set"}>
                <img src={qr.data} alt={`QR code for ${qr.title}`} />
                <div>
                  <strong>{qr.cardId ? qr.title : "One QR for the set"}</strong>
                  <small>Works after publishing</small>
                  <a href={qr.data} download={qr.file.split("/").pop()}>
                    Download QR PNG
                  </a>
                  <button onClick={() => copy(qr.link)}>
                    <Copy size={12} />{" "}
                    {copied === qr.link ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
function MiniDetail({
  mini,
  projects,
  onBack,
  onUpdate,
  onAdd,
  onAddMarkers,
  onUpdateEntry,
  onEditEntry,
  onRemoveEntry,
  onDelete,
  saveBeforePreview,
  saveState,
}) {
  const [bulkBusy, setBulkBusy] = useState(false),
    [bulkError, setBulkError] = useState("");
  async function bulk(event) {
    const selected = [...(event.target.files || [])];
    event.target.value = "";
    if (!selected.length) return;
    if (mini.entries.length + selected.length > MAX_FLASHCARDS) {
      setBulkError(`Keep a project to ${MAX_FLASHCARDS} cards.`);
      return;
    }
    setBulkBusy(true);
    setBulkError("");
    const uploaded = [],
      failures = [];
    for (const file of selected) {
      try {
        uploaded.push(await saveLocalFile(file, "marker"));
      } catch (e) {
        failures.push(`${file.name}: ${e.message}`);
      }
    }
    if (uploaded.length) onAddMarkers(uploaded);
    if (failures.length) setBulkError(failures.join(" "));
    setBulkBusy(false);
  }
  function preview(entry) {
    if (!saveBeforePreview()) return;
    window.open(draftUrl(mini, entry.id), "_blank", "noopener,noreferrer");
  }
  const readyCount = mini.entries.filter(
    (e) => !miniProblems({ ...mini, entries: [e] }, projects).length,
  ).length;
  return (
    <main className="mini-page mini-detail">
      <button className="mini-back" onClick={onBack}>
        <ArrowLeft size={16} /> All mini projects
      </button>
      <div className="mini-detail-heading">
        <div>
          <span className="mini-kicker">
            <Sparkles size={13} /> YOUR MINI PROJECT
          </span>
          <input
            aria-label="Edit mini project name"
            className="mini-title-input"
            value={mini.title}
            maxLength={70}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onBlur={() => {
              if (!mini.title.trim()) onUpdate({ title: "My mini project" });
            }}
          />
          <p>
            Everything you need to bring this idea to life, all in one place.
          </p>
        </div>
        <div className="mini-detail-side">
          <span>
            <span
              className={`mini-save-dot ${saveState === "error" ? "error" : ""}`}
            />{" "}
            {saveState === "error"
              ? "Storage unavailable"
              : "Saved on this device"}
          </span>
          <button onClick={onDelete}>
            <Trash2 size={14} /> Delete project
          </button>
        </div>
      </div>
      <div className="mini-detail-layout">
        <div className="mini-detail-main">
          <section className="mini-panel">
            <div className="mini-panel-heading">
              <span className="mini-step-icon">
                <Settings2 size={19} />
              </span>
              <div>
                <span className="mini-kicker">
                  STEP 01 · CHOOSE YOUR EXPERIENCE
                </span>
                <h2>How will your QR work?</h2>
              </div>
            </div>
            <ModeChoices
              value={mini.mode}
              onChange={(mode) => onUpdate({ mode })}
            />
            {mini.mode === "shared" && (
              <div className="mini-shared-target">
                <div>
                  <strong>
                    <FileScan size={15} /> One combined target file
                  </strong>
                  <p>
                    Upload one .mind file containing every marker in this set.
                    Each card’s target index must match the order used when it
                    was compiled.
                  </p>
                </div>
                <UploadSlot
                  kind="target"
                  label="Combined .mind file"
                  description="One file for all flash cards"
                  value={mini.sharedTarget}
                  ariaLabel="Upload combined mind file"
                  onSave={(file) => onUpdate({ sharedTarget: file })}
                />
                <MindCombiner
                  onSave={(file) => onUpdate({ sharedTarget: file })}
                />
              </div>
            )}
          </section>
          <section className="mini-panel mini-cards-panel">
            <div className="mini-panel-heading mini-card-heading">
              <span className="mini-step-icon mint">
                <Layers3 size={19} />
              </span>
              <div>
                <span className="mini-kicker">STEP 02 · ADD YOUR CARDS</span>
                <h2>
                  Your cards <span>{mini.entries.length}</span>
                </h2>
                <p>
                  {readyCount} of {mini.entries.length} ready to publish
                </p>
              </div>
              <button
                className="button secondary mini-add-card"
                onClick={onAdd}
                disabled={mini.entries.length >= MAX_FLASHCARDS}
              >
                <Plus size={15} /> Add card
              </button>
            </div>
            <label
              className={`mini-bulk-upload ${bulkBusy || mini.entries.length >= MAX_FLASHCARDS ? "disabled" : ""}`}
            >
              <span>
                <ImagePlus size={19} />
              </span>
              <div>
                <strong>
                  {bulkBusy
                    ? "Saving marker images…"
                    : "Have lots of flash cards?"}
                </strong>
                <small>
                  Select multiple marker images to create cards at once.
                </small>
              </div>
              <b>
                {bulkBusy ? "Saving…" : "Upload markers"} <Upload size={14} />
              </b>
              <input
                className="visually-hidden"
                type="file"
                multiple
                aria-label="Upload multiple marker images"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={bulkBusy || mini.entries.length >= MAX_FLASHCARDS}
                onChange={bulk}
              />
            </label>
            {bulkError && (
              <p className="mini-error" role="alert">
                {bulkError}
              </p>
            )}
            {mini.entries.length ? (
              <div className="mini-entry-list">
                {mini.entries.map((entry, i) => (
                  <MiniEntry
                    key={entry.id}
                    entry={entry}
                    index={i}
                    mini={mini}
                    scene={sceneForEntry(entry, projects)}
                    projects={projects}
                    onUpdate={(patch) => onUpdateEntry(entry.id, patch)}
                    onEdit={() => onEditEntry(entry)}
                    onRemove={() => onRemoveEntry(entry)}
                    onPreview={() => preview(entry)}
                  />
                ))}
              </div>
            ) : (
              <div className="mini-cards-empty">
                <FilePlus2 size={25} />
                <strong>Let’s add your first card.</strong>
                <p>Upload marker images above, or start with an empty card.</p>
                <button onClick={onAdd}>
                  Add a card <ArrowRight size={14} />
                </button>
              </div>
            )}
          </section>
        </div>
        <aside>
          <PublicationPanel
            key={`${mini.id}:${mini.mode}`}
            mini={mini}
            projects={projects}
            saveBeforePreview={saveBeforePreview}
          />
          <div className="mini-help-card">
            <Sparkles size={18} />
            <strong>A little tip</strong>
            <p>
              The QR opens the camera. The marker image is what the camera
              recognises—make sure each .mind file was compiled from the exact
              marker you upload.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
export default function MiniProjects({
  minis,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  onAdd,
  onAddMarkers,
  onUpdateEntry,
  onEditEntry,
  onRemoveEntry,
  onDelete,
  projects,
  saveBeforePreview,
  saveState,
}) {
  const [creating, setCreating] = useState(false);
  const mini = minis.find((item) => item.id === selectedId);
  return (
    <>
      {mini ? (
        <MiniDetail
          mini={mini}
          projects={projects}
          onBack={() => onSelect(null)}
          onUpdate={(patch) => onUpdate(mini.id, patch)}
          onAdd={() => onAdd(mini.id)}
          onAddMarkers={(files) => onAddMarkers(mini.id, files)}
          onUpdateEntry={(id, patch) => onUpdateEntry(mini.id, id, patch)}
          onEditEntry={(entry) => onEditEntry(mini.id, entry)}
          onRemoveEntry={(entry) => onRemoveEntry(mini.id, entry)}
          onDelete={() => onDelete(mini)}
          saveBeforePreview={saveBeforePreview}
          saveState={saveState}
        />
      ) : (
        <MiniOverview
          minis={minis}
          saveState={saveState}
          onNew={() => setCreating(true)}
          onSelect={onSelect}
        />
      )}
      {creating && (
        <NewMiniModal
          onClose={() => setCreating(false)}
          onCreate={(title, mode) => {
            onCreate(title, mode);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
