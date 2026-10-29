import { safeResourceReference } from "./local-files";

// Lesson boxes are teacher-written cards placed beside 3D models. They are
// stored with the project and published inside the same scene snapshot.

export const MAX_CARDS = 12;
export const CARD_TITLE_LIMIT = 60;
export const CARD_TEXT_LIMIT = 600;
export const LINK_LABEL_LIMIT = 40;
// Keep the original type order for existing QR links. New types are appended.
export const CARD_TYPES = ["text", "audio", "video", "link", "image"];

export const CARD_COLORS = [
  { id: "#8b6ee8", name: "Purple" },
  { id: "#f0bf2e", name: "Yellow" },
  { id: "#36b7cf", name: "Teal" },
  { id: "#7cc443", name: "Green" },
  { id: "#e86aa6", name: "Pink" },
  { id: "#4f86f0", name: "Blue" },
];

export const CARD_DEFAULTS = {
  text: {
    title: "Nucleus",
    text: "Write a short explanation about this part.",
    color: "#f0bf2e",
  },
  audio: {
    title: "Listen and learn",
    text: "Press play to hear your teacher explain this part.",
    color: "#e86aa6",
  },
  video: {
    title: "Watch this part",
    text: "Watch a short video about this part.",
    color: "#36b7cf",
  },
  image: {
    title: "Look closer",
    text: "Take a closer look at this picture.",
    color: "#7cc443",
  },
  link: {
    title: "Learn more",
    text: "Open this website to find out more.",
    color: "#4f86f0",
  },
};

export const CARD_TYPE_NAMES = {
  text: "Text box",
  audio: "Audio box",
  video: "Video box",
  image: "Image box",
  link: "Link box",
};

const finite = (value, fallback, min, max) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
const text = (value, limit, fallback = "") =>
  typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").slice(0, limit)
    : fallback;
const round = (value) => Math.round(value * 1000) / 1000;

export function safeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 1200) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

// Teachers often paste "example.com/page". Accept that, but only produce
// normal web links. Script, data and file links are always rejected.
export function normaliseWebLink(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1200 || /\s/.test(trimmed)) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes(".")
    )
      return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function linkHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function validateMedia(media, type) {
  if (!media || typeof media !== "object") return null;
  const url = safeResourceReference(media.url);
  if (!url) return null;
  const mime = text(media.mime, 80).toLowerCase();
  if (mime && !mime.startsWith(`${type}/`)) return null;
  return {
    url,
    name: text(
      media.name,
      90,
      type === "audio" ? "Voice" : type === "image" ? "Image" : "Video",
    ),
    ...(mime ? { mime } : {}),
    ...(typeof media.size === "number" && Number.isFinite(media.size)
      ? { size: Math.max(0, Math.round(media.size)) }
      : {}),
    ...(typeof media.duration === "number" && Number.isFinite(media.duration)
      ? { duration: Math.max(0, Math.round(media.duration * 10) / 10) }
      : {}),
    ...(media.recorded === true ? { recorded: true } : {}),
  };
}

export function validateCard(input, objectIds = new Set()) {
  if (!input || typeof input !== "object" || !CARD_TYPES.includes(input.type))
    return null;
  const defaults = CARD_DEFAULTS[input.type];
  const color = CARD_COLORS.some((c) => c.id === input.color)
    ? input.color
    : defaults.color;
  const target =
    input.target &&
    typeof input.target.objectId === "string" &&
    objectIds.has(input.target.objectId)
      ? {
          objectId: input.target.objectId,
          point: [0, 1, 2].map((i) =>
            round(finite(input.target.point?.[i], 0, -20, 20)),
          ),
        }
      : null;
  const card = {
    id:
      typeof input.id === "string" &&
      input.id.length > 0 &&
      input.id.length < 80
        ? input.id
        : crypto.randomUUID(),
    type: input.type,
    title: text(input.title, CARD_TITLE_LIMIT, defaults.title),
    text: text(input.text, CARD_TEXT_LIMIT),
    color,
    position: [0, 1, 2].map((i) =>
      round(
        finite(input.position?.[i], i === 1 ? 1.5 : 0, i === 1 ? -0.5 : -6, 6),
      ),
    ),
    target,
    visible: input.visible !== false,
  };
  if (["audio", "video", "image"].includes(input.type)) {
    card.media = validateMedia(input.media, input.type);
  }
  if (input.type === "link") {
    const url = normaliseWebLink(input.link?.url);
    card.link = {
      url,
      label: text(input.link?.label, LINK_LABEL_LIMIT, "Open link"),
    };
  }
  return card;
}

export function validateCards(cards, objectIds) {
  if (cards === undefined || cards === null) return [];
  if (!Array.isArray(cards)) throw new Error("Lesson boxes could not be read.");
  if (cards.length > MAX_CARDS)
    throw new Error(`Keep each scene to ${MAX_CARDS} lesson boxes.`);
  const ids = new Set();
  return cards.flatMap((card) => {
    const valid = validateCard(card, objectIds);
    if (!valid) return [];
    if (ids.has(valid.id)) valid.id = crypto.randomUUID();
    ids.add(valid.id);
    return [valid];
  });
}

export function newCard(type, project, selectedObjectId) {
  const defaults = CARD_DEFAULTS[type];
  const objects = project.objects || [];
  const anchor =
    objects.find((o) => o.id === selectedObjectId && o.visible !== false) ||
    objects.find((o) => o.visible !== false);
  const index = (project.cards || []).length;
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2) % 3;
  const base = anchor?.position || [0, 0, 0];
  return {
    id: crypto.randomUUID(),
    type,
    title: defaults.title,
    text: defaults.text,
    color: defaults.color,
    position: [
      round(Math.max(-5.5, Math.min(5.5, base[0] + side * 2.1))),
      round(1.9 + row * 0.7 - (row === 2 ? 2.1 : 0)),
      round(Math.max(-5.5, Math.min(5.5, base[2]))),
    ],
    target: anchor
      ? {
          objectId: anchor.id,
          point: [0, round(0.75 + row * 0.15), 0],
        }
      : null,
    visible: true,
    ...(["audio", "video", "image"].includes(type) ? { media: null } : {}),
    ...(type === "link" ? { link: { url: "", label: "Open link" } } : {}),
  };
}

// Compact rows keep QR links small when the project is shared without cloud
// publishing: [type, title, text, colour, x, y, z, objectIndex, px, py, pz,
// visible, mediaOrLink].
export function encodeCards(cards, objects) {
  const indices = new Map(objects.map((o, i) => [o.id, i]));
  return cards.map((card) => {
    const target = card.target ? indices.get(card.target.objectId) : undefined;
    const row = [
      CARD_TYPES.indexOf(card.type),
      card.title,
      card.text,
      CARD_COLORS.findIndex((c) => c.id === card.color),
      ...card.position.map((v) => Math.round(v * 100) / 100),
      target === undefined ? -1 : target,
      ...(target === undefined
        ? [0, 0, 0]
        : card.target.point.map((v) => Math.round(v * 100) / 100)),
      card.visible ? 1 : 0,
    ];
    if (card.media)
      row.push([
        card.media.url,
        card.media.name,
        card.media.mime || "",
        card.media.duration || 0,
        card.media.recorded ? 1 : 0,
      ]);
    else if (card.link) row.push([card.link.url, card.link.label]);
    else row.push(0);
    return row;
  });
}

export function decodeCards(rows, objectIds) {
  if (rows === undefined) return [];
  if (!Array.isArray(rows) || rows.length > MAX_CARDS)
    throw new Error("Lesson boxes in this link could not be read.");
  return rows.map((row) => {
    if (!Array.isArray(row)) throw new Error("A lesson box could not be read.");
    const type = CARD_TYPES[row[0]];
    const extra = Array.isArray(row[12]) ? row[12] : null;
    const objectId = Number.isInteger(row[7]) ? objectIds[row[7]] : undefined;
    return {
      type,
      title: row[1],
      text: row[2],
      color: CARD_COLORS[row[3]]?.id,
      position: row.slice(4, 7),
      target: objectId ? { objectId, point: row.slice(8, 11) } : null,
      visible: row[11] !== 0,
      ...(["audio", "video", "image"].includes(type)
        ? {
            media: extra
              ? {
                  url: extra[0],
                  name: extra[1],
                  mime: extra[2],
                  duration: extra[3] || undefined,
                  recorded: extra[4] === 1,
                }
              : null,
          }
        : {}),
      ...(type === "link"
        ? { link: { url: extra?.[0] || "", label: extra?.[1] || "Open link" } }
        : {}),
    };
  });
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function cardIsReady(card) {
  if (["audio", "video", "image"].includes(card.type)) return !!card.media?.url;
  if (card.type === "link") return !!card.link?.url;
  return !!(card.title.trim() || card.text.trim());
}
