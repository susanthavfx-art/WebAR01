import React, { useState } from "react";
import {
  BookOpen,
  Box,
  Check,
  ChevronDown,
  FileImage,
  FileScan,
  ImagePlus,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { ASSETS, getAsset } from "../lib/assets";
import { localRecord, resolveResourceUrl } from "../lib/local-files";
import { sceneForEntry } from "../lib/mini-projects";
import { hasIndividualMindFiles } from "../lib/flashcards";
import { LessonToolsPanel } from "./CardEditor";
import AssetImage from "./AssetImage";
import { IconButton } from "./UI";

const INPUTS = [
  {
    kind: "model",
    label: "GLB models",
    icon: Box,
    accept: ".glb,model/gltf-binary",
    aria: "Upload GLB models",
  },
  {
    kind: "marker",
    label: "Marker images",
    icon: FileImage,
    accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
    aria: "Upload marker images",
  },
  {
    kind: "target",
    label: ".mind files",
    icon: FileScan,
    accept: ".mind,application/octet-stream",
    aria: "Upload mind files",
  },
];

export default function FlashcardLibrary({
  mini,
  projects,
  activeEntry,
  selectedId,
  cards,
  busy,
  onFiles,
  onSelectEntry,
  onRemoveEntry,
  onRenameEntry,
  onSourceIndex,
  onLegacyIndex,
  onAddCard,
  onSelectCard,
  onAddObject,
  onSignIn,
  onClose,
}) {
  const [tab, setTab] = useState("models");
  const [search, setSearch] = useState("");
  const legacy = !!mini.sharedTarget && !hasIndividualMindFiles(mini);
  const extras = ASSETS.filter((asset) =>
    `${asset.name} ${asset.category}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <aside className="library-panel flash-library">
      <div className="flash-library-heading">
        <div>
          <span className="eyebrow">ONE SET, ONE CAMERA</span>
          <h2>
            Model library <span>{mini.entries.length}</span>
          </h2>
          <p>Upload matching files once. Choose a model to edit its scene.</p>
        </div>
        <IconButton
          className="drawer-close"
          label="Close model library"
          onClick={onClose}
        >
          <X size={18} />
        </IconButton>
      </div>
      <div
        className="library-tabs flash-library-tabs"
        role="tablist"
        aria-label="Workspace tools"
      >
        <button
          role="tab"
          aria-selected={tab === "models"}
          className={tab === "models" ? "active" : ""}
          onClick={() => setTab("models")}
        >
          <Box size={15} /> Models <span>{mini.entries.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "lesson"}
          className={tab === "lesson" ? "active" : ""}
          onClick={() => setTab("lesson")}
        >
          <BookOpen size={15} /> Lesson boxes{" "}
          {cards.length > 0 && <span>{cards.length}</span>}
        </button>
      </div>
      {tab === "lesson" ? (
        activeEntry ? (
          <LessonToolsPanel
            cards={cards}
            selectedId={selectedId}
            onAdd={onAddCard}
            onSelect={onSelectCard}
            onSignIn={onSignIn}
          />
        ) : (
          <div className="flash-empty-note">
            <BookOpen size={22} />
            <strong>Select a model first</strong>
            <p>Then add text, audio, video, links and images to its scene.</p>
          </div>
        )
      ) : (
        <div className="flash-library-scroll">
          <div className="flash-upload-title">
            <span>ADD YOUR FILES</span>
            <small>Select several at once</small>
          </div>
          <div className="flash-uploads">
            {INPUTS.map(({ kind, label, icon: Icon, accept, aria }) => (
              <label
                key={kind}
                className={`flash-upload-control ${busy ? "disabled" : ""}`}
              >
                {busy === kind ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Icon size={15} />
                )}
                <span>Upload {label}</span>
                <Upload size={13} />
                <input
                  type="file"
                  className="visually-hidden"
                  aria-label={aria}
                  accept={accept}
                  multiple
                  disabled={!!busy}
                  onChange={(event) => onFiles(kind, event)}
                />
              </label>
            ))}
          </div>
          <div className="flash-match-hint">
            <strong>Files with the same name match automatically</strong>
            <span>e.g. lion.glb + lion.jpg + lion.mind</span>
          </div>
          {legacy && (
            <div className="flash-legacy-note">
              <Check size={14} />
              <span>
                Existing combined tracker is preserved. Re-upload matching .mind
                files only if you want to rebuild it.
              </span>
            </div>
          )}
          <div className="flash-list-heading">
            <span>YOUR FLASHCARDS</span>
            <small>{mini.entries.length} / 50</small>
          </div>
          {mini.entries.length ? (
            <div className="flash-card-list">
              {mini.entries.map((entry, index) => {
                const scene = sceneForEntry(entry, projects);
                const image =
                  entry.marker && resolveResourceUrl(entry.marker.ref);
                const modelReady = !!scene?.objects?.length;
                const markerReady =
                  !!entry.marker && !!localRecord(entry.marker.ref);
                const mindReady = entry.sourceMind
                  ? !!localRecord(entry.sourceMind.ref) &&
                    Number.isInteger(entry.sourceTargetIndex)
                  : legacy &&
                    !entry.requiresLegacyIndex &&
                    Number.isInteger(entry.targetIndex) &&
                    entry.targetIndex < mini.sharedTarget.targetCount;
                const ready = modelReady && markerReady && mindReady;
                return (
                  <div
                    className={`flash-card-item ${entry.id === activeEntry?.id ? "active" : ""}`}
                    key={entry.id}
                  >
                    <button
                      className="flash-card-main"
                      aria-label={`Edit card ${entry.title}`}
                      aria-pressed={entry.id === activeEntry?.id}
                      onClick={() => onSelectEntry(entry)}
                    >
                      <span className="flash-card-thumb">
                        {image ? <img src={image} alt="" /> : <Box size={18} />}
                      </span>
                      <span className="flash-card-copy">
                        <small>
                          MODEL {String(index + 1).padStart(2, "0")}
                        </small>
                        <strong>{entry.title}</strong>
                        <em>
                          {ready ? "Ready to use" : "Needs matching files"}
                        </em>
                      </span>
                    </button>
                    <button
                      className="flash-card-remove"
                      aria-label={`Remove card ${entry.title}`}
                      title="Remove card"
                      onClick={() => onRemoveEntry(entry)}
                    >
                      <Trash2 size={14} />
                    </button>
                    <div
                      className="flash-file-badges"
                      aria-label={`Files for ${entry.title}`}
                    >
                      <span className={modelReady ? "done" : ""}>
                        {modelReady && <Check size={10} />} GLB
                      </span>
                      <span className={markerReady ? "done" : ""}>
                        {markerReady && <Check size={10} />} Marker
                      </span>
                      <span className={mindReady ? "done" : ""}>
                        {mindReady && <Check size={10} />} .mind
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flash-empty-note">
              <ImagePlus size={22} />
              <strong>Your library is empty</strong>
              <p>
                Start with one or more GLB files, markers or .mind files above.
              </p>
            </div>
          )}
          {activeEntry && (
            <div className="flash-card-settings">
              <label htmlFor="flash-card-title">SELECTED CARD NAME</label>
              <input
                id="flash-card-title"
                className="text-input"
                aria-label="Card title"
                value={activeEntry.title}
                maxLength={70}
                onChange={(event) =>
                  onRenameEntry(activeEntry, event.target.value)
                }
                onBlur={() => {
                  if (!activeEntry.title.trim())
                    onRenameEntry(activeEntry, "Untitled card");
                }}
              />
              <small>Renaming does not change filename matching.</small>
            </div>
          )}
          {legacy && activeEntry && (
            <div className="flash-target-choice">
              <label htmlFor="legacy-target-index">
                INDEX IN EXISTING COMBINED TRACKER
              </label>
              <p>
                Keep the original compile order. This set contains{" "}
                {mini.sharedTarget.targetCount} targets.
              </p>
              <select
                id="legacy-target-index"
                className="text-input"
                aria-label={`Combined target index for ${activeEntry.title}`}
                value={
                  activeEntry.requiresLegacyIndex ? "" : activeEntry.targetIndex
                }
                onChange={(event) => {
                  if (event.target.value !== "")
                    onLegacyIndex(activeEntry, Number(event.target.value));
                }}
              >
                {activeEntry.requiresLegacyIndex && (
                  <option value="">Choose the correct existing index…</option>
                )}
                {Array.from(
                  { length: mini.sharedTarget.targetCount },
                  (_, index) => (
                    <option key={index} value={index}>
                      Index {index} · target {index + 1}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}
          {activeEntry?.sourceMind?.targetCount > 1 && (
            <div className="flash-target-choice">
              <label htmlFor="source-target-index">
                TARGET INSIDE {activeEntry.sourceMind.name}
              </label>
              <p>
                This .mind file contains {activeEntry.sourceMind.targetCount}{" "}
                targets. Choose the index of this card's marker.
              </p>
              <select
                id="source-target-index"
                className="text-input"
                aria-label={`Mind target in file for ${activeEntry.title}`}
                value={
                  Number.isInteger(activeEntry.sourceTargetIndex)
                    ? activeEntry.sourceTargetIndex
                    : ""
                }
                onChange={(event) =>
                  onSourceIndex(
                    activeEntry,
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="">Choose target index…</option>
                {Array.from(
                  { length: activeEntry.sourceMind.targetCount },
                  (_, index) => (
                    <option key={index} value={index}>
                      Index {index} · target {index + 1}
                    </option>
                  ),
                )}
              </select>
              <small>
                Use the original compile order; the app cannot verify which
                image matches.
              </small>
            </div>
          )}
          <details className="flash-extra-objects">
            <summary>
              <Plus size={14} /> Add another object to this scene{" "}
              <ChevronDown size={14} />
            </summary>
            <p>
              Original built-in objects are still available for the selected
              model's scene.
            </p>
            <label className="search-field">
              <Search size={14} />
              <input
                aria-label="Search extra objects"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search objects"
              />
            </label>
            <div className="flash-extra-grid">
              {extras.map((asset) => (
                <button
                  key={asset.id}
                  disabled={!activeEntry}
                  onClick={() => onAddObject(asset.id)}
                  draggable={!!activeEntry}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("wonderlab/asset", asset.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  aria-label={`Add ${asset.name} to the scene`}
                >
                  <AssetImage
                    assetId={asset.id}
                    alt=""
                    style={{ background: getAsset(asset.id).bg }}
                  />
                  <span>{asset.name}</span>
                  <Plus size={12} />
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
    </aside>
  );
}
