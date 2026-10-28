import React, { useEffect, useState } from "react";
import {
  Clapperboard,
  Play,
  Plus,
  Repeat,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { getAsset } from "../lib/assets";
import { modelClipNames } from "../lib/model-library";
import {
  ACTION_LABEL_LIMIT,
  EFFECTS,
  MAX_ACTIONS,
  blankAction,
  effectName,
  isEffect,
} from "../lib/model-actions";
import { MediaField } from "./CardEditor";

/** Buttons students tap to play a model's animations and sounds. */
export function ActionBar({ objects, looping = {}, onPlay, className = "" }) {
  const groups = (objects || []).filter(
    (o) => o.visible !== false && o.actions?.length,
  );
  if (!groups.length) return null;
  const many = groups.length > 1;
  return (
    <div
      className={`action-bar ${className}`}
      role="toolbar"
      aria-label="Play buttons"
    >
      {groups.map((o) => (
        <div className="action-group" key={o.id}>
          {many && <span className="action-group-name">{o.name}</span>}
          {o.actions.map((a) => {
            const on = looping[o.id] === a.id;
            const Icon = on ? Square : a.clip === null ? Volume2 : Play;
            return (
              <button
                type="button"
                key={a.id}
                className={`action-chip ${on ? "active" : ""}`}
                aria-label={many ? `${a.label} – ${o.name}` : a.label}
                aria-pressed={a.loop ? on : undefined}
                title={on ? "Tap again to stop" : a.label}
                onClick={() => onPlay(o, a)}
              >
                <Icon size={14} fill={on ? "currentColor" : "none"} />
                <span>{a.label}</span>
                {a.sound && a.clip !== null && (
                  <Volume2 size={11} className="action-chip-sound" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function useClipNames(object) {
  const asset = getAsset(object.assetId, object.model);
  const url = asset.kind === "glb" ? asset.modelUrl : "";
  const [state, setState] = useState({ url: "", names: [], loading: false });
  useEffect(() => {
    if (!url) {
      setState({ url: "", names: [], loading: false });
      return;
    }
    let live = true;
    setState({ url, names: [], loading: true });
    modelClipNames(asset)
      .then((names) => live && setState({ url, names, loading: false }))
      .catch(() => live && setState({ url, names: [], loading: false }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return { asset, names: state.url === url ? state.names : [], loading: state.loading };
}

function movementValue(clip) {
  if (clip === null || clip === undefined) return "none";
  return typeof clip === "number" ? `clip:${clip}` : clip;
}
function parseMovement(value) {
  if (value === "none") return null;
  if (value.startsWith("clip:")) return Number(value.slice(5));
  return isEffect(value) ? value : null;
}

/** Inspector section where teachers build the play buttons for one object. */
export function ActionEditor({ object, update, onTest, onSignIn, notify }) {
  const { asset, names, loading } = useClipNames(object);
  const actions = object.actions || [];
  const isGlb = asset.kind === "glb";
  const fallback = names.length ? 0 : "@jump";
  function setActions(next) {
    update({ actions: next });
  }
  function patch(index, change) {
    setActions(
      actions.map((a, i) => {
        if (i !== index) return a;
        const next = { ...a, ...change };
        // A button must do something: without a sound it needs a movement.
        if (next.clip === null && !next.sound?.url) next.clip = fallback;
        if (typeof next.clip !== "number") delete next.loop;
        return next;
      }),
    );
  }
  function movementLabel(clip) {
    if (typeof clip === "number") return names[clip] || `Animation ${clip + 1}`;
    return effectName(clip);
  }
  return (
    <section className="property-section actions-section">
      <div className="property-section-heading">
        <h3>
          <Clapperboard size={14} />
          Play buttons
        </h3>
        <span className="tiny-pill">
          {actions.length}/{MAX_ACTIONS}
        </span>
      </div>
      {isGlb && names.length > 0 && (
        <>
          <label className="field-label" htmlFor="idle-clip">
            MAIN ANIMATION (PLAYS ALL THE TIME)
          </label>
          <select
            id="idle-clip"
            className="text-input"
            value={object.idleClip === undefined ? "auto" : String(object.idleClip)}
            onChange={(e) => {
              const v = e.target.value;
              update({ idleClip: v === "auto" ? undefined : Number(v) });
            }}
          >
            <option value="auto">
              Automatic ({asset.model.animate ? names[0] : "stand still"})
            </option>
            {names.map((n, i) => (
              <option key={i} value={i}>
                {n}
              </option>
            ))}
            <option value="-1">Stand still</option>
          </select>
        </>
      )}
      <p className="actions-hint">
        {isGlb && loading
          ? "Reading this model’s animations…"
          : isGlb && names.length > 1
            ? `This model has ${names.length} animations. Give each one its own button, and add a sound if you like.`
            : isGlb && names.length === 1
              ? "This model has 1 animation. Add buttons for it, simple movements or sounds."
              : "Add buttons that make this object jump, spin or play a sound (an animal call, a voice…)."}
      </p>
      {actions.map((a, i) => {
        const n = i + 1;
        return (
          <div className="action-card" key={a.id}>
            <div className="action-card-head">
              <span className="action-number">{n}</span>
              <input
                className="text-input"
                aria-label={`Play button ${n} name`}
                value={a.label}
                maxLength={ACTION_LABEL_LIMIT}
                placeholder="Button name"
                onChange={(e) =>
                  patch(i, { label: e.target.value.slice(0, ACTION_LABEL_LIMIT) })
                }
              />
              <button
                type="button"
                className="action-icon-button"
                aria-label={`Test play button ${n}`}
                title="Test"
                onClick={() => onTest(a)}
              >
                <Play size={14} />
              </button>
              <button
                type="button"
                className="action-icon-button danger"
                aria-label={`Remove play button ${n}`}
                title="Remove"
                onClick={() => setActions(actions.filter((_, j) => j !== i))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <label className="field-label" htmlFor={`action-move-${a.id}`}>
              MOVEMENT
            </label>
            <select
              id={`action-move-${a.id}`}
              className="text-input"
              aria-label={`Play button ${n} movement`}
              value={movementValue(a.clip)}
              onChange={(e) => {
                const clip = parseMovement(e.target.value);
                const old = movementLabel(a.clip);
                const label =
                  !a.label || a.label === old || a.label === "Sound"
                    ? (clip === null ? "Sound" : movementLabel(clip)).slice(
                        0,
                        ACTION_LABEL_LIMIT,
                      )
                    : a.label;
                patch(i, { clip, label });
              }}
            >
              {names.length > 0 && (
                <optgroup label="Model animations">
                  {names.map((name, c) => (
                    <option key={c} value={`clip:${c}`}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
              {typeof a.clip === "number" && a.clip >= names.length && (
                <option value={`clip:${a.clip}`}>
                  {loading ? "Loading…" : `Animation ${a.clip + 1} (missing)`}
                </option>
              )}
              <optgroup label="Simple movements">
                {EFFECTS.map((fx) => (
                  <option key={fx.id} value={fx.id}>
                    {fx.name}
                  </option>
                ))}
              </optgroup>
              {a.sound?.url && <option value="none">No movement – sound only</option>}
            </select>
            {typeof a.clip === "number" && (
              <label className="action-check">
                <input
                  type="checkbox"
                  aria-label={`Play button ${n} keeps playing`}
                  checked={!!a.loop}
                  onChange={(e) => patch(i, { loop: e.target.checked })}
                />
                <Repeat size={13} />
                Keep playing until tapped again
              </label>
            )}
            <MediaField
              kind="audio"
              media={a.sound}
              title="Sound (optional)"
              previewLabel={`Play button ${n} sound preview`}
              doneMessage="Sound added to your play button."
              note="Plays when students tap this button."
              onChange={(sound) => patch(i, { sound })}
              onSignIn={onSignIn}
              notify={notify}
            />
          </div>
        );
      })}
      {actions.length < MAX_ACTIONS && (
        <button
          type="button"
          className="button secondary full add-action"
          onClick={() =>
            setActions([
              ...actions,
              blankAction(
                names,
                actions.map((a) => a.clip).filter((c) => typeof c === "number"),
              ),
            ])
          }
        >
          <Plus size={15} />
          Add play button
        </button>
      )}
      {actions.length > 0 && (
        <p className="animation-hint">
          <Play size={10} />
          Students see these buttons in 3D and AR. Tapping the model plays
          button 1.
        </p>
      )}
    </section>
  );
}
