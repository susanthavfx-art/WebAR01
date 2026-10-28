import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  ArrowUpRight,
  AudioLines,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Mic,
  Play,
  Type,
  Video,
  X,
} from "lucide-react";
import { formatDuration, linkHost } from "../lib/lesson-cards";
import { resolveResourceUrl } from "../lib/local-files";

export const CARD_ICONS = {
  text: Type,
  audio: AudioLines,
  video: Video,
  image: ImageIcon,
  link: Link2,
};

function MediaChip({ card }) {
  if (card.type === "audio")
    return card.media ? (
      <span className="lesson-chip">
        {card.media.recorded ? <Mic size={12} /> : <Play size={12} />}
        Listen
        {card.media.duration ? ` · ${formatDuration(card.media.duration)}` : ""}
      </span>
    ) : (
      <span className="lesson-chip missing">Add a voice or audio file</span>
    );
  if (card.type === "video")
    return card.media ? (
      <span className="lesson-chip">
        <Play size={12} />
        Watch video
      </span>
    ) : (
      <span className="lesson-chip missing">Add a video file</span>
    );
  if (card.type === "image")
    return card.media ? (
      <span className="lesson-chip">
        <ImageIcon size={12} /> View image
      </span>
    ) : (
      <span className="lesson-chip missing">Add an image</span>
    );
  if (card.type === "link")
    return card.link?.url ? (
      <span className="lesson-chip">
        <ArrowUpRight size={12} />
        {card.link.label || "Open link"}
        <small>{linkHost(card.link.url)}</small>
      </span>
    ) : (
      <span className="lesson-chip missing">Add a web link</span>
    );
  return null;
}

export function LessonCardFace({ card, compact }) {
  const Icon = CARD_ICONS[card.type];
  return (
    <>
      <span className="lesson-card-title">
        <span className="lesson-card-icon">
          <Icon size={compact ? 13 : 14} />
        </span>
        <strong>{card.title || "Untitled box"}</strong>
      </span>
      {!compact &&
        card.type === "image" &&
        card.media &&
        resolveResourceUrl(card.media.url) && (
          <img
            className="lesson-card-image"
            src={resolveResourceUrl(card.media.url)}
            alt=""
          />
        )}
      {!compact && card.text && (
        <span className="lesson-card-text">{card.text}</span>
      )}
      {!compact && <MediaChip card={card} />}
    </>
  );
}

// Cards are HTML so audio, video and links remain accessible and readable on
// phones. Their positions are updated imperatively from the 3D camera.
export function CardOverlay({
  cards,
  registry,
  mode = "view",
  compact = false,
  selectedId,
  onCardPointerDown,
  onOpen,
  hidden = false,
}) {
  const shown = mode === "edit" ? cards : cards.filter((c) => c.visible);
  registry.current.cards = shown;
  if (!registry.current.elements) {
    registry.current.elements = new Map();
    registry.current.lines = new Map();
    registry.current.dots = new Map();
  }
  return (
    <div
      className={`lesson-layer ${mode} ${compact ? "compact" : ""} ${hidden ? "layer-hidden" : ""}`}
      aria-hidden={hidden}
    >
      <svg className="lesson-lines" aria-hidden="true">
        {shown.map((card) => (
          <g key={card.id}>
            <line
              ref={(el) =>
                el
                  ? registry.current.lines.set(card.id, el)
                  : registry.current.lines.delete(card.id)
              }
              stroke={card.color}
              strokeWidth={card.id === selectedId ? 3 : 2.4}
              strokeDasharray="7 6"
              strokeLinecap="round"
              style={{ display: "none" }}
            />
            <circle
              ref={(el) =>
                el
                  ? registry.current.dots.set(card.id, el)
                  : registry.current.dots.delete(card.id)
              }
              r="5"
              fill="#fff"
              stroke={card.color}
              strokeWidth="3"
              style={{ display: "none" }}
            />
          </g>
        ))}
      </svg>
      {shown.map((card) => (
        <div
          key={card.id}
          ref={(el) =>
            el
              ? registry.current.elements.set(card.id, el)
              : registry.current.elements.delete(card.id)
          }
          role="button"
          tabIndex={hidden ? -1 : 0}
          data-card-id={card.id}
          aria-label={
            mode === "edit"
              ? `Edit lesson box ${card.title || "Untitled"}`
              : `Open lesson box ${card.title || "Untitled"}`
          }
          className={`lesson-card type-${card.type} ${card.id === selectedId ? "selected" : ""} ${card.visible ? "" : "is-hidden"}`}
          style={{ "--card-color": card.color, visibility: "hidden" }}
          onPointerDown={(event) => {
            if (mode === "edit" && event.button === 0)
              onCardPointerDown?.(card, event);
          }}
          onClick={() => {
            if (mode !== "edit") onOpen?.(card);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              mode === "edit"
                ? onCardPointerDown?.(card, null)
                : onOpen?.(card);
            }
          }}
        >
          <LessonCardFace card={card} compact={compact} />
        </div>
      ))}
    </div>
  );
}

const cardPoint = new THREE.Vector3(),
  anchorPoint = new THREE.Vector3();
function toScreen(vector, camera, width, height) {
  vector.project(camera);
  if (vector.z < -1 || vector.z > 1) return null;
  return [((vector.x + 1) / 2) * width, ((1 - vector.y) / 2) * height];
}
// resolve.card(card, vector) and resolve.anchor(card, vector) write world
// positions and return false when the point should not be drawn. Cards are
// kept inside the visible area (minus optional insets for toolbars), while
// their pointer lines still reach the exact model point.
export function positionCards(
  registry,
  camera,
  width,
  height,
  resolve,
  insets = {},
) {
  const r = registry.current;
  if (!r?.elements || !width || !height) return;
  camera.updateMatrixWorld();
  const margin = 8,
    top = (insets.top || 0) + margin,
    bottom = height - (insets.bottom || 0) - margin;
  const items = (r.cards || []).flatMap((card) => {
    const el = r.elements.get(card.id);
    return el ? [{ card, el, w: el.offsetWidth, h: el.offsetHeight }] : [];
  });
  const clamp = (value, min, max) =>
    min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value));
  const placed = [];
  for (const item of items) {
    const { card, el, w, h } = item;
    const cardOk = resolve.card(card, cardPoint);
    const screen = cardOk ? toScreen(cardPoint, camera, width, height) : null;
    if (!screen) {
      el.style.visibility = "hidden";
      hideLine(r, card.id);
      continue;
    }
    item.x = clamp(screen[0], margin + w / 2, width - margin - w / 2);
    item.y = clamp(screen[1], top + h / 2, bottom - h / 2);
    placed.push(item);
  }
  // Gently separate overlapping boxes so every box stays tappable.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i],
          b = placed[j];
        const ox = (a.w + b.w) / 2 + 6 - Math.abs(a.x - b.x),
          oy = (a.h + b.h) / 2 + 6 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox < oy) {
          const dir = a.x <= b.x ? 1 : -1;
          a.x = clamp(
            a.x - (dir * ox) / 2,
            margin + a.w / 2,
            width - margin - a.w / 2,
          );
          b.x = clamp(
            b.x + (dir * ox) / 2,
            margin + b.w / 2,
            width - margin - b.w / 2,
          );
        } else {
          const dir = a.y <= b.y ? 1 : -1;
          a.y = clamp(a.y - (dir * oy) / 2, top + a.h / 2, bottom - a.h / 2);
          b.y = clamp(b.y + (dir * oy) / 2, top + b.h / 2, bottom - b.h / 2);
        }
      }
    if (!moved) break;
  }
  for (const { card, el, x, y } of placed) {
    const line = r.lines.get(card.id),
      dot = r.dots.get(card.id);
    el.style.visibility = "visible";
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    const anchorOk = card.target && resolve.anchor(card, anchorPoint);
    const target = anchorOk
      ? toScreen(anchorPoint, camera, width, height)
      : null;
    if (target && line && dot) {
      line.setAttribute("x1", x.toFixed(1));
      line.setAttribute("y1", y.toFixed(1));
      line.setAttribute("x2", target[0].toFixed(1));
      line.setAttribute("y2", target[1].toFixed(1));
      dot.setAttribute("cx", target[0].toFixed(1));
      dot.setAttribute("cy", target[1].toFixed(1));
      line.style.display = "";
      dot.style.display = "";
    } else hideLine(r, card.id);
  }
}
function hideLine(r, id) {
  const line = r.lines.get(id),
    dot = r.dots.get(id);
  if (line) line.style.display = "none";
  if (dot) dot.style.display = "none";
}

export function LessonCardSheet({ card, onClose }) {
  const close = useRef(null);
  const Icon = CARD_ICONS[card.type];
  useEffect(() => {
    close.current?.focus();
    const key = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="lesson-sheet-wrap" onClick={onClose}>
      <section
        className="lesson-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={card.title || "Lesson box"}
        style={{ "--card-color": card.color }}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <span className="lesson-card-icon">
            <Icon size={16} />
          </span>
          <h2>{card.title || "Lesson box"}</h2>
          <button
            ref={close}
            className="icon-button"
            aria-label="Close lesson box"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {card.text && <p className="lesson-sheet-text">{card.text}</p>}
        {card.type === "image" &&
          card.media &&
          resolveResourceUrl(card.media.url) && (
            <img
              className="lesson-sheet-image"
              src={resolveResourceUrl(card.media.url)}
              alt={card.media.name || card.title || "Lesson image"}
            />
          )}
        {card.type === "audio" && card.media && (
          <audio
            className="lesson-sheet-audio"
            controls
            preload="metadata"
            src={resolveResourceUrl(card.media.url)}
          >
            Your browser cannot play this audio.
          </audio>
        )}
        {card.type === "video" && card.media && (
          <video
            className="lesson-sheet-video"
            controls
            playsInline
            preload="metadata"
            src={resolveResourceUrl(card.media.url)}
          >
            Your browser cannot play this video.
          </video>
        )}
        {card.type === "link" && card.link?.url && (
          <a
            className="button primary full lesson-sheet-link"
            href={card.link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            {card.link.label || "Open link"}
            <small>{linkHost(card.link.url)}</small>
          </a>
        )}
        {(["audio", "video", "image"].includes(card.type) && !card.media) ||
        (card.type === "link" && !card.link?.url) ? (
          <p className="lesson-sheet-empty">
            Your teacher has not added this media yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
