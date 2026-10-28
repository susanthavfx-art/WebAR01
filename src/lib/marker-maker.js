// Draws a square marker design and compiles it into a MindAR image target in
// the browser. The same JPEG that is compiled is the one that gets printed.
export const MARKER_SIZE = 1024;
export const MY_MARKERS_KEY = "wonderlab.markers.v1";
export const MAX_MY_MARKERS = 40;
export const PHOTO_LIMIT = 20 * 1024 * 1024;

export const BAND_STYLES = [
  { id: "purple", name: "Purple", fill: "#7b61cf", text: "#ffffff" },
  { id: "yellow", name: "Yellow", fill: "#f4c430", text: "#2d2440" },
  { id: "teal", name: "Teal", fill: "#1f9fb6", text: "#ffffff" },
  { id: "white", name: "White", fill: "#ffffff", text: "#2d2440" },
  { id: "dark", name: "Dark", fill: "#2d2440", text: "#ffffff" },
  { id: "none", name: "No band", fill: "", text: "#ffffff" },
];
export const FRAME_COLORS = [
  { id: "none", name: "No frame", color: "" },
  { id: "white", name: "White", color: "#ffffff" },
  { id: "purple", name: "Purple", color: "#7b61cf" },
  { id: "yellow", name: "Yellow", color: "#f4c430" },
  { id: "teal", name: "Teal", color: "#1f9fb6" },
  { id: "dark", name: "Dark", color: "#2d2440" },
];
export const DEFAULT_DESIGN = {
  text: "",
  textPosition: "bottom",
  textSize: 76,
  band: "purple",
  frame: "white",
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

export async function loadPhoto(file) {
  if (!file) throw new Error("Choose a photo first.");
  if (
    !/^image\/(jpeg|png|webp|gif|bmp)$/i.test(file.type || "") &&
    !/\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || "")
  )
    throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > PHOTO_LIMIT)
    throw new Error("This photo is too large. Choose one under 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    if (image.naturalWidth < 300 || image.naturalHeight < 300)
      throw new Error(
        "This photo is too small. Use one at least 600 pixels wide.",
      );
    return image;
  } catch (e) {
    if (e?.message?.startsWith("This photo")) throw e;
    throw new Error("This photo could not be opened. Try a JPG or PNG photo.");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function ensureMarkerFonts() {
  try {
    await Promise.all([
      document.fonts?.load('800 80px "Jakarta"'),
      document.fonts?.load('700 80px "DM Sans"'),
    ]);
  } catch {
    /* System fonts are fine if the web font is unavailable. */
  }
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export function drawMarker(canvas, photo, design) {
  const size = MARKER_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const frame = FRAME_COLORS.find((f) => f.id === design.frame)?.color || "";
  const border = frame ? Math.round(size * 0.045) : 0;
  const inner = size - border * 2;
  if (photo) {
    const scale =
      Math.max(inner / photo.naturalWidth, inner / photo.naturalHeight) *
      design.zoom;
    const w = photo.naturalWidth * scale,
      h = photo.naturalHeight * scale;
    const maxX = Math.max(0, (w - inner) / 2),
      maxY = Math.max(0, (h - inner) / 2);
    const x = border + (inner - w) / 2 + design.offsetX * maxX,
      y = border + (inner - h) / 2 + design.offsetY * maxY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(border, border, inner, inner);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, x, y, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#f2eff7";
    ctx.fillRect(border, border, inner, inner);
  }
  const text = design.text.trim();
  if (text && design.textPosition !== "none") {
    const band =
      BAND_STYLES.find((b) => b.id === design.band) || BAND_STYLES[0];
    const fontSize = Math.max(40, Math.min(120, design.textSize));
    ctx.font = `800 ${fontSize}px "Jakarta", "DM Sans", system-ui, sans-serif`;
    const lines = wrapLines(ctx, text, inner - fontSize * 1.2);
    const lineHeight = fontSize * 1.15;
    const bandHeight = lines.length * lineHeight + fontSize * 0.75;
    const top =
      design.textPosition === "top" ? border : size - border - bandHeight;
    if (band.fill) {
      ctx.fillStyle = band.fill;
      ctx.fillRect(border, top, inner, bandHeight);
    }
    ctx.fillStyle = band.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (!band.fill) {
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = fontSize * 0.25;
    }
    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        size / 2,
        top + fontSize * 0.375 + lineHeight * (i + 0.5),
        inner - fontSize * 0.6,
      );
    });
    ctx.shadowBlur = 0;
  }
  if (frame) {
    ctx.strokeStyle = frame;
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, size - border, size - border);
  }
}

export function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image failed"))),
      "image/jpeg",
      0.92,
    ),
  );
}

// Quality is based on MindAR's own detected feature points. Busy, detailed
// photos score well; plain colours, blur and text-only designs score poorly.
export function markerQuality(data) {
  const matching = (data.matchingData || [])
    .slice(0, 6)
    .reduce((sum, m) => sum + m.maximaPoints.length + m.minimaPoints.length, 0);
  const tracking = (data.trackingData || []).reduce(
    (sum, t) => sum + t.points.length,
    0,
  );
  const score =
    Math.min(1, tracking / 60) * 0.5 + Math.min(1, matching / 2400) * 0.5;
  return {
    score: Math.round(score * 100) / 100,
    label:
      score >= 0.75
        ? "great"
        : score >= 0.45
          ? "good"
          : score >= 0.25
            ? "weak"
            : "poor",
    tracking,
    matching,
  };
}

export async function compileMarker(jpeg, onProgress) {
  const { a: Compiler } = await import("../vendor/controller-mGt1s8dJ.js");
  const url = URL.createObjectURL(jpeg);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const compiler = new Compiler();
    await compiler.compileImageTargets([image], (percent) =>
      onProgress?.(Math.max(0, Math.min(100, percent)) / 100),
    );
    const quality = markerQuality(compiler.data[0]);
    const buffer = await compiler.exportData();
    return {
      target: new Blob([buffer], { type: "application/octet-stream" }),
      quality,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadMyMarkers(validate) {
  try {
    const saved = JSON.parse(localStorage.getItem(MY_MARKERS_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    const ids = new Set();
    return saved.slice(0, MAX_MY_MARKERS).flatMap((m) => {
      const valid = validate(m);
      if (!valid || ids.has(valid.id)) return [];
      ids.add(valid.id);
      return [valid];
    });
  } catch {
    return [];
  }
}
export function saveMyMarkers(markers) {
  try {
    localStorage.setItem(
      MY_MARKERS_KEY,
      JSON.stringify(markers.slice(0, MAX_MY_MARKERS)),
    );
    return true;
  } catch {
    return false;
  }
}
