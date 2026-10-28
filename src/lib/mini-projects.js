import { publicUrl, fragmentParams } from "./deployment";
import { loadProjects, validateProject, slug, downloadBlob } from "./projects";
import {
  localModelId,
  localRecord,
  isLocalReference,
  resolveResourceUrl,
  safeResourceReference,
} from "./local-files";
import QRCode from "qrcode";

export const MINI_KEY = "wonderlab.mini-projects.v1";
export const MAX_MINIS = 40;
export const MAX_FLASHCARDS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanTitle = (value, fallback) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 70)
    : fallback;

export function loadMiniProjects() {
  try {
    const list = JSON.parse(localStorage.getItem(MINI_KEY) || "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => UUID.test(p?.id || "") && Array.isArray(p.entries))
      .slice(0, MAX_MINIS)
      .map((p) => ({
        id: p.id,
        title: cleanTitle(p.title, "My mini project"),
        mode: p.mode === "individual" ? "individual" : "shared",
        sharedTarget: p.sharedTarget || null,
        entries: p.entries
          .filter(
            (e) => UUID.test(e?.id || "") && typeof e.sceneId === "string",
          )
          .slice(0, MAX_FLASHCARDS)
          .map((e, index) => ({
            ...e,
            title: cleanTitle(e.title, `Card ${index + 1}`),
            targetIndex:
              Number.isInteger(e.targetIndex) &&
              e.targetIndex >= 0 &&
              e.targetIndex < 100
                ? e.targetIndex
                : index,
          })),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}
export function saveMiniProjects(projects) {
  try {
    localStorage.setItem(
      MINI_KEY,
      JSON.stringify(projects.slice(0, MAX_MINIS)),
    );
    return true;
  } catch {
    return false;
  }
}
export function newMiniProject(title, mode) {
  return {
    id: crypto.randomUUID(),
    title: cleanTitle(title, "My mini project"),
    mode: mode === "individual" ? "individual" : "shared",
    sharedTarget: null,
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}
export function newMiniEntry(sceneId, title, index) {
  return {
    id: crypto.randomUUID(),
    sceneId,
    title: cleanTitle(title, `Card ${index + 1}`),
    targetIndex: index,
    marker: null,
    target: null,
    model: null,
    modelObjectId: null,
  };
}
export function nextTargetIndex(entries) {
  const used = new Set(entries.map((entry) => entry.targetIndex));
  for (let i = 0; i < 100; i++) if (!used.has(i)) return i;
  return entries.length;
}
export function sceneForEntry(entry, projects) {
  return projects.find((project) => project.id === entry.sceneId);
}

export function miniProblems(mini, projects) {
  const issues = [];
  if (!mini?.entries?.length) return ["Add at least one card."];
  if (mini.entries.length > MAX_FLASHCARDS)
    issues.push(`Keep a project to ${MAX_FLASHCARDS} cards.`);
  if (mini.mode === "shared" && !mini.sharedTarget)
    issues.push("Upload one combined .mind file for the whole set.");
  else if (mini.mode === "shared" && !localRecord(mini.sharedTarget.ref))
    issues.push(
      "The combined .mind file is missing from this browser. Upload it again.",
    );
  const indices = new Set();
  for (const entry of mini.entries) {
    const scene = sceneForEntry(entry, projects);
    const name = entry.title || "A card";
    if (!scene) {
      issues.push(`${name}: the scene is missing.`);
      continue;
    }
    if (!entry.marker || !localRecord(entry.marker.ref))
      issues.push(`${name}: upload the matching marker image.`);
    const target = mini.mode === "shared" ? mini.sharedTarget : entry.target;
    if (mini.mode === "individual" && (!target || !localRecord(target.ref)))
      issues.push(`${name}: upload its .mind file.`);
    if (
      target &&
      (!Number.isInteger(entry.targetIndex) ||
        entry.targetIndex < 0 ||
        entry.targetIndex >= target.targetCount)
    )
      issues.push(
        `${name}: target index ${entry.targetIndex} is outside the ${target.targetCount}-target .mind file.`,
      );
    if (mini.mode === "shared") {
      if (indices.has(entry.targetIndex))
        issues.push(
          `${name}: target index ${entry.targetIndex} is already used by another card.`,
        );
      indices.add(entry.targetIndex);
    }
    if (!scene.objects.length && !scene.cards?.length)
      issues.push(`${name}: add a model or a lesson box to its scene.`);
    for (const object of scene.objects) {
      if (localModelId(object.model?.file) && !localRecord(object.model.file))
        issues.push(`${name}: a local 3D model is missing. Upload it again.`);
      for (const action of object.actions || [])
        if (
          isLocalReference(action.sound?.url) &&
          !localRecord(action.sound.url)
        )
          issues.push(
            `${name}: an uploaded sound is missing. Upload it again.`,
          );
    }
    for (const card of scene.cards || []) {
      if (isLocalReference(card.media?.url) && !localRecord(card.media.url))
        issues.push(
          `${name}: an uploaded media file is missing. Upload it again.`,
        );
    }
  }
  return [...new Set(issues)];
}

export function defaultPublicBase() {
  const url = new URL(publicUrl(""), window.location.origin);
  // Arena preview hosts expire with the session; never silently put one in a
  // printable QR code. The creator must enter their permanent deployed URL.
  return /(^|\.)e2b\.app$/i.test(url.hostname) ? "" : url.href;
}
export function normalisePublicBase(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error(
      "Enter the full public website URL, beginning with https://.",
    );
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Use a public HTTPS studio URL (localhost is only for testing on this device).",
    );
  if (url.search || url.hash)
    throw new Error(
      "Enter just the studio address, without a query or # link.",
    );
  if (url.pathname.endsWith("/index.html"))
    url.pathname = url.pathname.slice(0, -10);
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}
export function collectionUrl(base, publicationId, cardId = "") {
  const url = new URL(normalisePublicBase(base));
  url.hash = new URLSearchParams({
    page: "collection",
    p: publicationId,
    ...(cardId ? { c: cardId } : {}),
  }).toString();
  return url.href;
}
export function draftUrl(mini, cardId = "") {
  const url = new URL(publicUrl(""), window.location.origin);
  url.hash = new URLSearchParams({
    page: "collection",
    draft: mini.id,
    ...(cardId ? { c: cardId } : {}),
  }).toString();
  return url.href;
}

function publishedPath(id, record) {
  return `published/${id}/files/${record.id}.${record.ext}`;
}
function dataUrlBytes(dataUrl) {
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function textBytes(value) {
  return new TextEncoder().encode(value);
}
function jpegForPdf(record) {
  return new Promise((resolve, reject) => {
    const img = new Image(),
      url = URL.createObjectURL(record.blob);
    img.onload = () => {
      try {
        const factor = Math.min(
          1,
          1600 / Math.max(img.naturalWidth, img.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * factor));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * factor));
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          data: canvas.toDataURL("image/jpeg", 0.88),
          width: canvas.width,
          height: canvas.height,
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not prepare ${record.name} for printing.`));
    };
    img.src = url;
  });
}
// Browser canvas shapes Sinhala (and other complex scripts) before embedding
// the result in a PDF; jsPDF's built-in Helvetica cannot render these titles.
function pdfTitle(pdf, title, x, y, width) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 110;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw the printable title.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3c2e55";
  context.font = '400 64px "Noto Sans Sinhala", "DM Sans", sans-serif';
  context.textBaseline = "middle";
  context.fillText(title.slice(0, 70), 2, canvas.height / 2, canvas.width - 4);
  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    x,
    y,
    width,
    (width * canvas.height) / canvas.width,
  );
}
async function printablePdf(mini, qrList) {
  const { jsPDF } = await import("jspdf");
  // The Sinhala subset is self-hosted and loaded before drawing even if the
  // UI title itself hasn't caused the browser to request it yet.
  if (document.fonts?.load)
    await document.fonts.load('400 64px "Noto Sans Sinhala"', "සිංහල");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let page = 0;
  const addPage = () => {
    if (page++) pdf.addPage();
  };
  if (mini.mode === "shared") {
    addPage();
    pdf.setTextColor(60, 46, 85);
    pdfTitle(pdf, mini.title, 20, 19, 170);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "normal");
    pdf.text("One QR for the whole card set", 20, 49);
    pdf.addImage(qrList[0].data, "PNG", 55, 65, 100, 100);
    pdf.setFontSize(12);
    pdf.text(
      [
        "Scan this QR on your phone, then start the AR camera.",
        "Point the camera at any printed card in this set.",
        "Publish the exported project before testing the QR.",
      ],
      20,
      183,
    );
  }
  for (const entry of mini.entries) {
    addPage();
    const image = await jpegForPdf(localRecord(entry.marker.ref));
    pdf.setTextColor(60, 46, 85);
    pdfTitle(pdf, entry.title, 18, 14, 174);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Tracking image · target index ${entry.targetIndex}`, 18, 32);
    const maxW = 174,
      maxH = mini.mode === "individual" ? 164 : 215;
    const ratio = Math.min(maxW / image.width, maxH / image.height);
    const width = image.width * ratio,
      height = image.height * ratio;
    pdf.addImage(image.data, "JPEG", (210 - width) / 2, 40, width, height);
    if (mini.mode === "individual") {
      const qr = qrList.find((item) => item.cardId === entry.id);
      pdf.addImage(qr.data, "PNG", 18, 224, 48, 48);
      pdf.setFontSize(11);
      pdf.text(
        [
          "1. Scan this card's QR code.",
          "2. Start the AR camera.",
          "3. Point at the full image above.",
        ],
        75,
        238,
      );
    } else {
      pdf.setFontSize(10);
      pdf.text(
        "Use the one QR code on the cover page to open the camera.",
        18,
        276,
      );
    }
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}

export async function createPublication(
  mini,
  projects,
  base,
  onProgress = () => {},
) {
  const problems = miniProblems(mini, projects);
  if (problems.length) throw new Error(problems[0]);
  const publicBase = normalisePublicBase(base),
    id = crypto.randomUUID(),
    files = {},
    refs = new Map();
  async function include(reference) {
    const record = localRecord(reference);
    if (!record)
      throw new Error(
        "An uploaded file is no longer available. Please upload it again.",
      );
    if (!refs.has(record.id)) {
      refs.set(record.id, publishedPath(id, record));
      files[`public/${publishedPath(id, record)}`] = new Uint8Array(
        await record.blob.arrayBuffer(),
      );
    }
    return refs.get(record.id);
  }
  let bytes = 0;
  const required = new Set();
  const collect = (reference) => {
    const r = localRecord(reference);
    if (r && !required.has(r.id)) {
      required.add(r.id);
      bytes += r.size;
    }
  };
  if (mini.mode === "shared") collect(mini.sharedTarget?.ref);
  for (const entry of mini.entries) {
    collect(entry.marker?.ref);
    if (mini.mode === "individual") collect(entry.target?.ref);
    const scene = sceneForEntry(entry, projects);
    scene.objects.forEach((o) => {
      collect(o.model?.file);
      (o.actions || []).forEach((action) => collect(action.sound?.url));
    });
    (scene.cards || []).forEach((c) => collect(c.media?.url));
  }
  if (bytes > 250 * 1024 * 1024)
    throw new Error(
      "This project is over 250 MB. Optimise the models or publish smaller sets to keep phone downloads manageable.",
    );
  onProgress("Preparing your uploaded files…");
  const target =
    mini.mode === "shared" ? await include(mini.sharedTarget.ref) : null;
  const cards = [];
  for (const [index, entry] of mini.entries.entries()) {
    onProgress(`Preparing card ${index + 1} of ${mini.entries.length}…`);
    const original = sceneForEntry(entry, projects);
    const scene = JSON.parse(JSON.stringify(original));
    // Collection tracking is controlled by the entry, not by the old scene marker.
    scene.markerId = "space-explorer";
    delete scene.marker;
    for (const object of scene.objects) {
      if (localModelId(object.model?.file))
        object.model.file = await include(object.model.file);
      for (const action of object.actions || [])
        if (isLocalReference(action.sound?.url))
          action.sound.url = await include(action.sound.url);
    }
    for (const box of scene.cards || []) {
      if (isLocalReference(box.media?.url))
        box.media.url = await include(box.media.url);
    }
    cards.push({
      id: entry.id,
      title: entry.title,
      targetIndex: entry.targetIndex,
      marker: await include(entry.marker.ref),
      ...(mini.mode === "individual"
        ? { target: await include(entry.target.ref) }
        : {}),
      scene,
    });
  }
  const manifest = {
    version: 1,
    id,
    title: mini.title,
    mode: mini.mode,
    ...(target ? { target } : {}),
    cards,
  };
  files[`public/published/${id}/manifest.json`] = textBytes(
    JSON.stringify(manifest, null, 2),
  );
  onProgress("Making QR codes and printable sheets…");
  const qrList = [];
  const qrEntries =
    mini.mode === "shared"
      ? [{ title: mini.title, cardId: "" }]
      : mini.entries.map((e) => ({ title: e.title, cardId: e.id }));
  for (const item of qrEntries) {
    const link = collectionUrl(publicBase, id, item.cardId);
    const data = await QRCode.toDataURL(link, {
      width: 600,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#2d2440", light: "#ffffff" },
    });
    const file = item.cardId
      ? `qr/${slug(item.title)}-${item.cardId.slice(0, 8)}.png`
      : "qr/one-qr-for-the-set.png";
    files[file] = dataUrlBytes(data);
    qrList.push({ ...item, link, data, file });
  }
  files["printable-marker-sheets.pdf"] = await printablePdf(mini, qrList);
  files["READ-ME-FIRST.txt"] = textBytes(
    `WONDERLAB MINI PROJECT: ${mini.title}\n\n1. Upload the included public/published/${id}/ folder into the SAME location in your WebAR01 repository.\n2. Deploy the studio using its GitHub Pages workflow. Wait for the build to finish.\n3. Your QR codes then open the studio at: ${publicBase}\n4. Print printable-marker-sheets.pdf at 100% and test on a phone over HTTPS.\n\nThe QR opens the viewer; the illustration is the tracking marker.\nTarget indices must match the image order used when compiling the .mind file.\nThis package is a snapshot. Exporting again creates a new publication and new QR codes.\nAnyone with a QR link can access these public files.\n`,
  );
  onProgress("Packing your project…");
  const { zip } = await import("fflate");
  const archive = await new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  const blob = new Blob([archive], { type: "application/zip" });
  const filename = `${slug(mini.title)}-publication.zip`;
  downloadBlob(blob, filename);
  return { id, blob, filename, qrList, publicBase };
}

function validateCollection(input, publicationId) {
  if (
    !input ||
    input.version !== 1 ||
    !UUID.test(input.id || "") ||
    input.id !== publicationId ||
    !["individual", "shared"].includes(input.mode) ||
    !Array.isArray(input.cards) ||
    !input.cards.length ||
    input.cards.length > MAX_FLASHCARDS
  )
    throw new Error(
      "This published project is invalid or uses an unsupported format.",
    );
  const expectedPrefix = `published/${publicationId}/files/`;
  const ownFile = (value) =>
    typeof value === "string" &&
    value.startsWith(expectedPrefix) &&
    safeResourceReference(value);
  if (input.mode === "shared" && !ownFile(input.target))
    throw new Error("The tracking target is missing from this project.");
  const seenIds = new Set(),
    seenIndices = new Set();
  const cards = input.cards.map((card) => {
    if (
      !UUID.test(card?.id || "") ||
      seenIds.has(card.id) ||
      !Number.isInteger(card.targetIndex) ||
      card.targetIndex < 0 ||
      card.targetIndex > 99 ||
      !ownFile(card.marker) ||
      (input.mode === "individual" && !ownFile(card.target)) ||
      (input.mode === "shared" && seenIndices.has(card.targetIndex))
    )
      throw new Error("A card in this project is invalid.");
    seenIds.add(card.id);
    seenIndices.add(card.targetIndex);
    return {
      id: card.id,
      title: cleanTitle(card.title, "Card"),
      targetIndex: card.targetIndex,
      marker: card.marker,
      target: card.target || input.target,
      scene: validateProject(card.scene),
    };
  });
  return {
    id: input.id,
    title: cleanTitle(input.title, "Mini project"),
    mode: input.mode,
    target: input.target,
    cards,
  };
}
export async function loadCollectionFromLocation() {
  const params = fragmentParams(),
    draft = params.get("draft"),
    id = params.get("p"),
    cardId = params.get("c");
  let collection;
  if (draft) {
    if (!UUID.test(draft))
      throw new Error("This local preview link is invalid.");
    const mini = loadMiniProjects().find((item) => item.id === draft);
    if (!mini)
      throw new Error(
        "This draft is saved on its creator's device only. Export and publish it for another phone.",
      );
    const projects = loadProjects(),
      draftEntries =
        mini.mode === "individual" && cardId
          ? mini.entries.filter((entry) => entry.id === cardId)
          : mini.entries,
      problems = miniProblems({ ...mini, entries: draftEntries }, projects);
    if (problems.length) throw new Error(problems[0]);
    collection = {
      id: mini.id,
      title: mini.title,
      mode: mini.mode,
      target: mini.sharedTarget?.ref,
      cards: draftEntries.map((e) => ({
        id: e.id,
        title: e.title,
        targetIndex: e.targetIndex,
        marker: e.marker.ref,
        target: mini.mode === "shared" ? mini.sharedTarget.ref : e.target.ref,
        scene: sceneForEntry(e, projects),
      })),
    };
  } else {
    if (!id || !UUID.test(id))
      throw new Error(
        "This project link is incomplete. Ask the creator for a new QR code.",
      );
    const response = await fetch(publicUrl(`published/${id}/manifest.json`), {
      cache: "no-cache",
    });
    if (
      !response.ok ||
      (response.headers.get("content-type") || "").includes("text/html")
    )
      throw new Error(
        "This project is not published at this address yet. Upload the exported publication folder and wait for the website to deploy.",
      );
    const text = await response.text();
    if (text.length > 2_000_000)
      throw new Error("This project file is too large to open.");
    collection = validateCollection(JSON.parse(text), id);
  }
  if (cardId) {
    const card = collection.cards.find((c) => c.id === cardId);
    if (!card) throw new Error("This card is not in the published project.");
    collection = { ...collection, cards: [card], target: card.target };
  } else if (collection.mode === "individual") {
    throw new Error(
      "Each card in this project has its own QR code. Scan the QR printed on the card.",
    );
  }
  if (!resolveResourceUrl(collection.target))
    throw new Error("The tracking target is unavailable on this device.");
  return collection;
}
