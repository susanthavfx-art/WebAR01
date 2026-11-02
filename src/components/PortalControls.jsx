import React from "react";
import { Gem, Globe2, Sparkles, Wand2 } from "lucide-react";
import {
  PORTAL_RESIDENTS,
  PORTAL_STYLES,
  PORTAL_WORLDS,
  portalStyle,
  portalWorld,
} from "../lib/portal";

export function StylePicker({ portal, onChange }) {
  return (
    <div
      className="portal-swatches"
      role="radiogroup"
      aria-label="Portal frame"
    >
      {PORTAL_STYLES.map((style) => (
        <button
          key={style.id}
          type="button"
          role="radio"
          aria-checked={portal.style === style.id}
          className={`portal-swatch ${portal.style === style.id ? "active" : ""}`}
          onClick={() => onChange({ style: style.id })}
        >
          <span
            className="portal-swatch-dot"
            style={{
              "--frame": style.frame,
              "--trim": style.trim,
              "--glow": style.glow,
            }}
          />
          <span className="portal-swatch-text">
            <strong>{style.name}</strong>
            <small>{style.blurb}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

export function WorldPicker({ portal, onChange }) {
  return (
    <div
      className="portal-swatches worlds"
      role="radiogroup"
      aria-label="World inside"
    >
      {PORTAL_WORLDS.map((world) => (
        <button
          key={world.id}
          type="button"
          role="radio"
          aria-checked={portal.world === world.id}
          className={`portal-swatch ${portal.world === world.id ? "active" : ""}`}
          onClick={() => onChange({ world: world.id })}
        >
          <span
            className="portal-swatch-dot world"
            style={{
              "--a": world.palette[0],
              "--b": world.palette[1],
              "--c": world.palette[2],
              "--d": world.palette[3],
            }}
          />
          <span className="portal-swatch-text">
            <strong>{world.name}</strong>
            <small>{world.blurb}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <label className="portal-slider">
      <span>
        {label}
        <output>{format ? format(value) : value.toFixed(2)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function PortalControls({ portal, onChange, compact = false }) {
  const style = portalStyle(portal.style);
  const world = portalWorld(portal.world);

  return (
    <div className={`portal-controls ${compact ? "compact" : ""}`}>
      <section>
        <header className="portal-control-heading">
          <Gem size={15} />
          <h3>Frame</h3>
          <span>{style.name}</span>
        </header>
        <StylePicker portal={portal} onChange={onChange} />
      </section>

      <section>
        <header className="portal-control-heading">
          <Globe2 size={15} />
          <h3>The other world</h3>
          <span>{world.name}</span>
        </header>
        <WorldPicker portal={portal} onChange={onChange} />
      </section>

      <section>
        <header className="portal-control-heading">
          <Wand2 size={15} />
          <h3>Doorway shape</h3>
        </header>
        <div className="portal-slider-grid">
          <Slider
            label="Width"
            value={portal.width}
            min={0.35}
            max={0.99}
            step={0.01}
            onChange={(width) => onChange({ width })}
            format={(value) => `${Math.round(value * 100)}% of card`}
          />
          <Slider
            label="Height"
            value={portal.height}
            min={0.4}
            max={1.6}
            step={0.01}
            onChange={(height) => onChange({ height })}
            format={(value) => value.toFixed(2)}
          />
          <Slider
            label="World depth"
            value={portal.depth}
            min={0.2}
            max={1.6}
            step={0.01}
            onChange={(depth) => onChange({ depth })}
            format={(value) => `${value.toFixed(2)}×`}
          />
          <Slider
            label="Light strength"
            value={portal.glow}
            min={0}
            max={1}
            step={0.01}
            onChange={(glow) => onChange({ glow })}
            format={(value) => `${Math.round(value * 100)}%`}
          />
        </div>
      </section>

      <section>
        <header className="portal-control-heading">
          <Sparkles size={15} />
          <h3>Inside the doorway</h3>
        </header>
        <div className="portal-row">
          <label className="portal-select">
            <span>Something to find</span>
            <select
              value={portal.resident}
              onChange={(event) => onChange({ resident: event.target.value })}
            >
              {PORTAL_RESIDENTS.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.name}
                </option>
              ))}
            </select>
          </label>
          <label className="portal-toggle">
            <input
              type="checkbox"
              checked={portal.sparkles}
              onChange={(event) => onChange({ sparkles: event.target.checked })}
            />
            <span className="portal-toggle-track" aria-hidden="true" />
            <span>Rising sparkles</span>
          </label>
          <label className="portal-toggle">
            <input
              type="checkbox"
              checked={portal.flip}
              onChange={(event) => onChange({ flip: event.target.checked })}
            />
            <span className="portal-toggle-track" aria-hidden="true" />
            <span>Turn it half a turn</span>
          </label>
        </div>
      </section>
    </div>
  );
}
