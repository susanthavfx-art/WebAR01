import React, { useState } from "react";
import { sampleKeyframes } from "../lib/timeline";
import {
  ArrowUpRight,
  Box,
  Check,
  Copy,
  Eye,
  EyeOff,
  Move3D,
  Palette,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  ScanLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import AssetImage from "./AssetImage";
import { ActionEditor } from "./ModelActions";
import { CARD_ICONS } from "./LessonCards";
import { EmptyState, IconButton } from "./UI";
import { CARD_TYPE_NAMES, MAX_CARDS } from "../lib/lesson-cards";
import { MAX_OBJECTS } from "../lib/projects";
import { getAsset, MARKER_PLACEHOLDER } from "../lib/assets";

export function ObjectProperties({
  object,
  update,
  onDelete,
  onDuplicate,
  onTestAction,
  notify,
}) {
  const a = getAsset(object.assetId, object.model);
  const [time, setTime] = useState(0);
  const keys = object.keyframes || [];
  const duration = Math.max(5, keys.at(-1)?.time || 0, time);
  function seek(value) {
    setTime(value);
    const pose = sampleKeyframes(keys, value, false);
    if (pose) update({ position: pose.position, rotation: pose.rotation, scale: pose.scale });
  }
  function addKey() {
    const key = { time, position: [...object.position], rotation: [...object.rotation], scale: object.scale };
    update({ keyframes: [...keys.filter(k => k.time !== time), key].sort((a, b) => a.time - b.time) });
  }

  function vector(field, i, value) {
    if (value === "") return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const v = [...object[field]];
    const limit = field === "rotation" ? 360 : 4;
    v[i] = Math.max(
      i === 1 && field === "position" ? 0 : -limit,
      Math.min(limit, num),
    );
    update({ [field]: v });
  }

  return (
    <>
      <div className="selected-object-card">
        <span className="selected-object-art" style={{ background: a.bg }}>
          <AssetImage assetId={a.id} model={object.model} alt="" />
        </span>
        <div>
          <span>{a.category.toUpperCase()} OBJECT</span>
          <input
            aria-label="Object name"
            value={object.name}
            onChange={(e) => update({ name: e.target.value.slice(0, 35) })}
          />
          <small>Let’s make it a little more you.</small>
        </div>
      </div>
      <div className="object-action-row">
        <button onClick={onDuplicate}>
          <Copy size={13} />
          Duplicate
        </button>
        <span />
        <button onClick={onDelete}>
          <Trash2 size={13} />
          Remove
        </button>
      </div>
      <section className="property-section">
        <div className="property-section-heading">
          <h3>
            <Move3D size={14} />
            Transform
          </h3>
          <button
            onClick={() =>
              update({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 })
            }
            title="Reset object transform"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
        <label className="field-label">POSITION</label>
        <div className="vector-fields">
          {["X", "Y", "Z"].map((axis, i) => (
            <label key={axis}>
              <span className={`axis-${axis.toLowerCase()}`}>{axis}</span>
              <input
                aria-label={`Position ${axis}`}
                type="number"
                step="0.1"
                min={i === 1 ? 0 : -4}
                max="4"
                value={object.position[i]}
                onChange={(e) => vector("position", i, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="field-label">ROTATION</label>
        <div className="vector-fields">
          {["X", "Y", "Z"].map((axis, i) => (
            <label key={axis}>
              <span className={`axis-${axis.toLowerCase()}`}>{axis}</span>
              <input
                aria-label={`Rotation ${axis}`}
                type="number"
                step="5"
                min="-360"
                max="360"
                value={object.rotation[i]}
                onChange={(e) => vector("rotation", i, e.target.value)}
              />
              <small>°</small>
            </label>
          ))}
        </div>
        <div className="scale-label">
          <label className="field-label" htmlFor="object-scale">
            SIZE
          </label>
          <span>{Math.round(object.scale * 100)}%</span>
        </div>
        <div className="scale-slider">
          <Box size={13} />
          <input
            id="object-scale"
            aria-label="Object size"
            type="range"
            min="0.15"
            max="2.5"
            step="0.05"
            value={object.scale}
            onChange={(e) => update({ scale: Number(e.target.value) })}
          />
          <Box size={18} />
        </div>
      </section>
      <section className="property-section color-section">
        <div className="property-section-heading">
          <h3>
            <Palette size={14} />A splash of colour
          </h3>
          <button onClick={() => update({ color: undefined })}>Original</button>
        </div>
        <div className="color-swatches">
          {["#a397dc", "#92c7ae", "#edaa8f", "#edcc7d", "#9dbbdc"].map((c) => (
            <button
              key={c}
              style={{ background: c }}
              className={object.color === c ? "active" : ""}
              aria-label={`Set object colour ${c}`}
              onClick={() => update({ color: c })}
            >
              {object.color === c && <Check size={14} />}
            </button>
          ))}
          <label className="custom-color" title="Choose a custom colour">
            <Plus size={15} />
            <input
              type="color"
              aria-label="Custom object colour"
              value={object.color || a.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
        </div>
      </section>
      <section className="property-section animation-section">
        <div className="property-section-heading">
          <h3>
            <Sparkles size={14} />A little life
          </h3>
          <span className="tiny-pill">ANIMATE</span>
        </div>
        <div className="animation-options">
          {[
            { id: "none", icon: Box, label: "Still" },
            { id: "float", icon: ArrowUpRight, label: "Float" },
            { id: "spin", icon: RotateCw, label: "Spin" },
          ].map((x) => (
            <button
              key={x.id}
              className={object.animation === x.id ? "active" : ""}
              onClick={() => update({ animation: x.id })}
            >
              <x.icon size={17} />
              <span>{x.label}</span>
            </button>
          ))}
        </div>
        <p className="animation-hint">
          <Play size={10} />
          Hit play below your canvas to see the magic.
        </p>
      </section>
      <section className="property-section timeline-section">
        <div className="property-section-heading"><h3><span>◆</span> Animation timeline</h3><span className="tiny-pill">KEYFRAMES</span></div>
        <p className="animation-hint">Set a time, adjust the transform, then save a keyframe. Press play below the canvas to preview the loop.</p>
        <div className="timeline-controls">
          <label>Time (seconds)<input aria-label="Keyframe time in seconds" type="number" min="0" max="300" step="0.1" value={time} onChange={e => setTime(Math.round(Math.max(0, Math.min(300, Number(e.target.value) || 0)) * 100) / 100)} /></label>
          <button type="button" onClick={addKey} disabled={keys.length >= 100 && !keys.some(k => k.time === time)}>◆ Save keyframe</button>
        </div>
        <input className="timeline-range" aria-label="Scrub animation timeline" type="range" min="0" max={duration} step="0.01" value={time} onChange={e => seek(Number(e.target.value))} />
        <div className="timeline-key-list">{keys.length ? keys.map(key => <div key={key.time}><button type="button" onClick={() => seek(key.time)}>◆ {key.time.toFixed(2)}s</button><button type="button" aria-label={`Delete keyframe at ${key.time} seconds`} onClick={() => update({ keyframes: keys.filter(k => k.time !== key.time) })}><Trash2 size={13} /></button></div>) : <small>No keyframes yet. Save at least two poses to animate.</small>}</div>
      </section>
      <ActionEditor
        object={object}
        update={update}
        onTest={onTestAction}
        notify={notify}
      />
    </>
  );
}

export function SceneObjects({
  project,
  selectedId,
  markerImage,
  markerName,
  onSelect,
  onSelectCard,
  updateCard,
  updateObject,
  onDelete,
}) {
  const cards = project.cards || [];
  return (
    <div className="scene-object-panel">
      <div className="scene-list-heading">
        <span>YOUR LITTLE WORLD</span>
        <strong>
          {project.objects.length}/{MAX_OBJECTS}
        </strong>
      </div>
      {project.objects.length ? (
        project.objects.map((o) => (
          <div
            className={`scene-object ${o.id === selectedId ? "active" : ""} ${o.visible === false ? "object-hidden" : ""}`}
            key={o.id}
          >
            <button
              className="scene-object-select"
              onClick={() => onSelect(o.id)}
            >
              <AssetImage
                assetId={o.assetId}
                model={o.model}
                alt=""
                style={{ background: getAsset(o.assetId, o.model).bg }}
              />
              <span>
                <strong>{o.name}</strong>
                <small>
                  {getAsset(o.assetId, o.model).category}
                  {o.animation !== "none" ? ` · ${o.animation}` : ""}
                  {o.actions?.length
                    ? ` · ${o.actions.length} play button${o.actions.length === 1 ? "" : "s"}`
                    : ""}
                  {o.joystick ? " · Joystick" : ""}
                </small>
              </span>
            </button>
            <IconButton
              label={`${o.visible === false ? "Show" : "Hide"} ${o.name}`}
              onClick={() =>
                updateObject(o.id, { visible: o.visible === false })
              }
            >
              {o.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconButton>
            <IconButton
              label={`Remove ${o.name}`}
              onClick={() => onDelete(o.id)}
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        ))
      ) : (
        <EmptyState icon={Box} title="A world waiting to happen">
          Upload a GLB model in the Objects tab to start editing this scene.
        </EmptyState>
      )}
      {cards.length > 0 && (
        <>
          <div className="scene-list-heading lesson-list-heading">
            <span>LESSON BOXES</span>
            <strong>
              {cards.length}/{MAX_CARDS}
            </strong>
          </div>
          {cards.map((c) => {
            const Icon = CARD_ICONS[c.type];
            return (
              <div
                className={`scene-object ${c.id === selectedId ? "active" : ""} ${c.visible ? "" : "object-hidden"}`}
                key={c.id}
              >
                <button
                  className="scene-object-select"
                  onClick={() => onSelectCard(c.id)}
                >
                  <span
                    className="scene-card-icon"
                    style={{ "--card-color": c.color }}
                  >
                    <Icon size={15} />
                  </span>
                  <span>
                    <strong>{c.title || "Untitled box"}</strong>
                    <small>{CARD_TYPE_NAMES[c.type]}</small>
                  </span>
                </button>
                <IconButton
                  label={`${c.visible ? "Hide" : "Show"} ${c.title || "box"}`}
                  onClick={() => updateCard(c.id, { visible: !c.visible })}
                >
                  {c.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </IconButton>
                <IconButton
                  label={`Remove ${c.title || "box"}`}
                  onClick={() => onDelete(c.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
            );
          })}
        </>
      )}
      <div className="scene-marker-note">
        <img
          src={markerImage || MARKER_PLACEHOLDER}
          alt="Scene tracking marker"
        />
        <span>
          <small>ANCHORED TO</small>
          <strong>{markerName || "Upload matching marker"}</strong>
        </span>
        <ScanLine size={17} />
      </div>
      <p className="small-note">
        Hidden objects won’t appear in your AR viewer. Keep scenes simple for
        the smoothest mobile experience.
      </p>
    </div>
  );
}
