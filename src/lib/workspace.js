import QRCode from "qrcode";
import { publicUrl, fragmentParams } from "./deployment";
import { registerSharedModel } from "./assets";
import {
  combineCardMindTargets,
  isLocalReference,
  localModelId,
  localRecord,
  resolveResourceUrl,
  safeResourceReference,
} from "./local-files";
import { downloadBlob, newScene, slug, validateScene } from "./projects";

export const WORKSPACE_KEY = "wonderlab.webar01.workspace.v1";
export const SCENES_KEY = "wonderlab.webar01.scenes.v1";
export const MAX_FLASHCARDS = 50;
export const DEFAULT_GITHUB_PAGES_URL =
  "https://susanthavfx-art.github.io/WebAR01/";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cleanTitle = (value, fallback) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 70)
    : fallback;

export function filenameStem(name) {
  return String(name || "")
    .replace(/\.(glb|mind|jpe?g|png|webp)$/i, "")
    .trim()
    .normalize("NFKC");
}

export function filenameKey(name) {
  return filenameStem(name).toLocaleLowerCase("en-US");
}

export function entryFileKey(entry) {
  return filenameKey(
    entry?.matchKey ||
      entry?.model?.name ||
      entry?.marker?.name ||
      entry?.sourceMind?.name ||
      entry?.title,
  );
}

export function newEntry(sceneId, title, matchKey, index = 0) {
  return {
    id: crypto.randomUUID(),
    sceneId,
    title: cleanTitle(title, `Model ${index + 1}`),
    matchKey: filenameKey(matchKey || title),
    targetIndex: index,
    model: null,
    modelObjectId: null,
    marker: null,
    sourceMind: null,
    sourceTargetIndex: 0,
  };
}

export function newWorkspace(title = "My AR Creation") {
  return {
    id: crypto.randomUUID(),
    title: cleanTitle(title, "My AR Creation"),
    entries: [],
    selectedEntryId: null,
    sharedTarget: null,
    trackerSignature: "",
    updatedAt: new Date().toISOString(),
  };
}

export function sceneForEntry(entry, scenes) {
  if (!entry) return null;
  return scenes.find((scene) => scene.id === entry.sceneId) || null;
}

export function loadWorkspaceState() {
  let scenes = [];
  try {
    const rawScenes = JSON.parse(localStorage.getItem(SCENES_KEY) || "[]");
    if (Array.isArray(rawScenes)) {
      scenes = rawScenes.flatMap((item) => {
        try {
          return [validateScene(item)];
        } catch {
          return [];
        }
      });
    }
  } catch {
    scenes = [];
  }

  let workspace = null;
  try {
    const raw = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "null");
    if (raw && typeof raw === "object" && Array.isArray(raw.entries)) {
      const entries = raw.entries
        .filter((e) => UUID.test(e?.id || "") && typeof e.sceneId === "string")
        .slice(0, MAX_FLASHCARDS)
        .map((e, index) => {
          const item = {
            id: e.id,
            sceneId: e.sceneId,
            title: cleanTitle(e.title, `Model ${index + 1}`),
            matchKey: entryFileKey(e),
            targetIndex:
              Number.isInteger(e.targetIndex) &&
              e.targetIndex >= 0 &&
              e.targetIndex < 100
                ? e.targetIndex
                : index,
            model: e.model || null,
            modelObjectId:
              typeof e.modelObjectId === "string" ? e.modelObjectId : null,
            marker: e.marker || null,
            sourceMind: e.sourceMind || null,
            sourceTargetIndex:
              Number.isInteger(e.sourceTargetIndex) && e.sourceTargetIndex >= 0
                ? e.sourceTargetIndex
                : 0,
          };
          if (item.model?.id) {
            try {
              registerSharedModel({
                id: `upload-${item.model.id}`,
                name: item.title,
                category: "GLB Model",
                file: `uploads/${item.model.id}.glb`,
                height: 1.5,
                rotation: [0, 0, 0],
                animate: true,
              });
            } catch {
              /* Model asset will be re-validated per scene */
            }
          }
          return item;
        });

      const validEntryIds = new Set(
        entries.filter((e) => sceneForEntry(e, scenes)).map((e) => e.id),
      );
      const selectedEntryId = validEntryIds.has(raw.selectedEntryId)
        ? raw.selectedEntryId
        : entries.find((e) => validEntryIds.has(e.id))?.id || null;

      workspace = {
        id: UUID.test(raw.id || "") ? raw.id : crypto.randomUUID(),
        title: cleanTitle(raw.title, "My AR Creation"),
        entries: entries.filter((e) => validEntryIds.has(e.id)),
        selectedEntryId,
        sharedTarget: raw.sharedTarget || null,
        trackerSignature:
          typeof raw.trackerSignature === "string" &&
          raw.trackerSignature.length < 20000
            ? raw.trackerSignature
            : "",
        updatedAt: raw.updatedAt || new Date().toISOString(),
      };
    }
  } catch {
    workspace = null;
  }

  if (!workspace) workspace = newWorkspace("My AR Creation");

  return {
    workspace,
    scenes,
    scratch: newScene("Empty workspace"),
  };
}

export function saveWorkspaceState(state) {
  try {
    const activeSceneIds = new Set(
      state.workspace.entries.map((entry) => entry.sceneId),
    );
    const scenesToKeep = state.scenes.filter((scene) =>
      activeSceneIds.has(scene.id),
    );
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenesToKeep));
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state.workspace));
    return true;
  } catch {
    return false;
  }
}

export function entryStatus(entry, scenes) {
  const scene = sceneForEntry(entry, scenes);
  const modelReady = !!(
    scene?.objects?.length &&
    scene.objects.every(
      (o) => !localModelId(o.model?.file) || !!localRecord(o.model.file),
    )
  );
  const markerReady = !!(entry?.marker && localRecord(entry.marker.ref));
  const mindRecord = entry?.sourceMind && localRecord(entry.sourceMind.ref);
  const mindReady = !!(
    mindRecord &&
    mindRecord.kind === "target" &&
    Number.isInteger(entry.sourceTargetIndex) &&
    entry.sourceTargetIndex >= 0 &&
    entry.sourceTargetIndex < mindRecord.targetCount
  );
  return {
    modelReady,
    markerReady,
    mindReady,
    ready: modelReady && markerReady && mindReady,
    targetCount: mindRecord?.targetCount || entry?.sourceMind?.targetCount || 0,
  };
}

export function workspaceProblems(workspace, scenes) {
  if (!workspace?.entries?.length) {
    return [
      "Upload at least one GLB model (Objects tab), marker image, and .mind file (Markers tab).",
    ];
  }
  const issues = [];
  for (const entry of workspace.entries) {
    const scene = sceneForEntry(entry, scenes);
    const stem = entry.matchKey || entry.title;
    if (!scene) {
      issues.push(`${entry.title}: scene is missing.`);
      continue;
    }
    const status = entryStatus(entry, scenes);
    if (!status.modelReady) {
      issues.push(
        `${entry.title}: upload "${stem}.glb" in the Objects tab.`,
      );
    }
    if (!status.markerReady) {
      issues.push(
        `${entry.title}: upload "${stem}.jpg" (or .png) in the Markers tab.`,
      );
    }
    if (!status.mindReady) {
      issues.push(
        `${entry.title}: upload "${stem}.mind" in the Markers tab.`,
      );
    }
    for (const object of scene.objects) {
      for (const action of object.actions || []) {
        if (
          isLocalReference(action.sound?.url) &&
          !localRecord(action.sound.url)
        ) {
          issues.push(
            `${entry.title}: an uploaded play-button sound is missing on this device.`,
          );
        }
      }
    }
    for (const box of scene.cards || []) {
      if (isLocalReference(box.media?.url) && !localRecord(box.media.url)) {
        issues.push(
          `${entry.title}: an uploaded Lesson box media file is missing on this device.`,
        );
      }
    }
  }
  return [...new Set(issues)];
}

export function sourceTrackerSignature(entries) {
  return JSON.stringify(
    entries.map((entry) => [
      entry.id,
      entry.sourceMind?.id || "",
      entry.sourceTargetIndex ?? 0,
    ]),
  );
}

export async function prepareWorkspaceTracker(
  workspace,
  scenes,
  onProgress = () => {},
) {
  const issues = workspaceProblems(workspace, scenes);
  if (issues.length) throw new Error(issues[0]);
  const signature = sourceTrackerSignature(workspace.entries);
  if (
    workspace.trackerSignature === signature &&
    workspace.sharedTarget &&
    localRecord(workspace.sharedTarget.ref)
  ) {
    return {
      ...workspace,
      entries: workspace.entries.map((entry, index) => ({
        ...entry,
        targetIndex: index,
      })),
    };
  }
  const sharedTarget = await combineCardMindTargets(
    workspace.entries,
    onProgress,
  );
  return {
    ...workspace,
    sharedTarget,
    trackerSignature: signature,
    entries: workspace.entries.map((entry, index) => ({
      ...entry,
      targetIndex: index,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function defaultPublicBase() {
  try {
    const url = new URL(publicUrl(""), window.location.origin);
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      /(^|\.)e2b\.app$/i.test(host)
    ) {
      return DEFAULT_GITHUB_PAGES_URL;
    }
    return url.href;
  } catch {
    return DEFAULT_GITHUB_PAGES_URL;
  }
}

export function normalisePublicBase(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error(
      "Enter your full website URL starting with https:// (for example https://susanthavfx-art.github.io/WebAR01/).",
    );
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password
  ) {
    throw new Error("Use a public HTTPS website URL.");
  }
  if (url.search || url.hash) {
    throw new Error("Enter just the base website address without ? or #.");
  }
  if (url.pathname.endsWith("/index.html")) {
    url.pathname = url.pathname.slice(0, -10);
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

export function collectionUrl(base, publicationId, options = {}) {
  const url = new URL(normalisePublicBase(base));
  url.hash = new URLSearchParams({
    page: "collection",
    p: publicationId,
    ...(options.cameraDirect !== false ? { camera: "1" } : {}),
  }).toString();
  return url.href;
}

export function draftCollectionUrl(options = {}) {
  const url = new URL(publicUrl(""), window.location.origin);
  url.hash = new URLSearchParams({
    page: "collection",
    draft: "1",
    ...(options.cameraDirect !== false ? { camera: "1" } : {}),
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
    const img = new Image();
    const url = URL.createObjectURL(record.blob);
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

function pdfTitle(pdf, title, x, y, width) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 110;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not draw printable title.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#3c2e55";
  context.font = '600 60px "Noto Sans Sinhala", "DM Sans", sans-serif';
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

export async function generatePrintablePdf(workspace, qrDataUrl) {
  const { jsPDF } = await import("jspdf");
  if (document.fonts?.load) {
    await document.fonts.load('600 60px "Noto Sans Sinhala"', "සිංහල");
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });

  // Cover page: Single QR code for all models
  pdf.setTextColor(60, 46, 85);
  pdfTitle(pdf, workspace.title, 20, 18, 170);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `Single QR Code for all ${workspace.entries.length} AR ${workspace.entries.length === 1 ? "model" : "models"}`,
    20,
    47,
  );
  pdf.addImage(qrDataUrl, "PNG", 52, 60, 106, 106);
  pdf.setFontSize(11.5);
  pdf.text(
    [
      "1. Scan this single QR code on your phone to open the AR camera.",
      "2. Allow camera permission when asked.",
      "3. Point the camera at any printed marker image on the next pages.",
    ],
    20,
    182,
  );

  // One full printable page per marker image
  for (const entry of workspace.entries) {
    pdf.addPage();
    const image = await jpegForPdf(localRecord(entry.marker.ref));
    pdf.setTextColor(60, 46, 85);
    pdfTitle(pdf, entry.title, 18, 14, 174);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`AR Marker · Target #${entry.targetIndex + 1}`, 18, 32);
    const maxW = 174;
    const maxH = 215;
    const ratio = Math.min(maxW / image.width, maxH / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    pdf.addImage(image.data, "JPEG", (210 - width) / 2, 40, width, height);
    pdf.setFontSize(10);
    pdf.text(
      "Scan the single QR code on the cover page, then point your camera at this marker.",
      18,
      276,
    );
  }

  return new Uint8Array(pdf.output("arraybuffer"));
}

export async function createWorkspacePublication(
  workspace,
  scenes,
  base,
  onProgress = () => {},
) {
  const issues = workspaceProblems(workspace, scenes);
  if (issues.length) throw new Error(issues[0]);
  if (!workspace.sharedTarget || !localRecord(workspace.sharedTarget.ref)) {
    throw new Error("Combined tracking file is not ready yet.");
  }

  const publicBase = normalisePublicBase(base);
  const id = crypto.randomUUID();
  const files = {};
  const refs = new Map();

  async function include(reference) {
    const record = localRecord(reference);
    if (!record) {
      throw new Error(
        "An uploaded file is missing on this device. Please upload it again.",
      );
    }
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
  collect(workspace.sharedTarget.ref);
  for (const entry of workspace.entries) {
    collect(entry.marker?.ref);
    const scene = sceneForEntry(entry, scenes);
    scene.objects.forEach((o) => {
      collect(o.model?.file);
      (o.actions || []).forEach((action) => collect(action.sound?.url));
    });
    (scene.cards || []).forEach((c) => collect(c.media?.url));
  }
  if (bytes > 250 * 1024 * 1024) {
    throw new Error(
      "Total uploaded files exceed 250 MB. Please optimise large GLB or video files.",
    );
  }

  onProgress("Bundling combined .mind tracker…");
  const target = await include(workspace.sharedTarget.ref);

  const cards = [];
  for (const [index, entry] of workspace.entries.entries()) {
    onProgress(
      `Bundling model ${index + 1} of ${workspace.entries.length} (${entry.title})…`,
    );
    const original = sceneForEntry(entry, scenes);
    const scene = JSON.parse(JSON.stringify(original));
    for (const object of scene.objects) {
      if (localModelId(object.model?.file)) {
        object.model.file = await include(object.model.file);
      }
      for (const action of object.actions || []) {
        if (isLocalReference(action.sound?.url)) {
          action.sound.url = await include(action.sound.url);
        }
      }
    }
    for (const box of scene.cards || []) {
      if (isLocalReference(box.media?.url)) {
        box.media.url = await include(box.media.url);
      }
    }
    cards.push({
      id: entry.id,
      title: entry.title,
      targetIndex: entry.targetIndex,
      marker: await include(entry.marker.ref),
      scene,
    });
  }

  const manifest = {
    version: 1,
    id,
    title: workspace.title,
    mode: "shared",
    target,
    cards,
  };
  files[`public/published/${id}/manifest.json`] = textBytes(
    JSON.stringify(manifest, null, 2),
  );

  onProgress("Generating single QR code & printable PDF…");
  const qrLink = collectionUrl(publicBase, id, { cameraDirect: true });
  const qrDataUrl = await QRCode.toDataURL(qrLink, {
    width: 640,
    margin: 3,
    errorCorrectionLevel: "M",
    color: { dark: "#2d2440", light: "#ffffff" },
  });
  const qrBytes = dataUrlBytes(qrDataUrl);
  const pdfBytes = await generatePrintablePdf(workspace, qrDataUrl);

  files["QR-and-Printable-Sheets/single-qr-code.png"] = qrBytes;
  files["QR-and-Printable-Sheets/printable-markers-and-qr.pdf"] = pdfBytes;
  files["READ-ME.txt"] = textBytes(
    `WONDERLAB AR — SINGLE QR PUBLICATION (${workspace.title})\n\n` +
      `Single QR Link:\n${qrLink}\n\n` +
      `HOW TO MAKE THIS QR WORK ON PHONES (GitHub Pages):\n` +
      `1. Extract (Unzip) this downloaded ZIP file on your computer.\n` +
      `2. Open your GitHub repository root page (e.g. https://github.com/susanthavfx-art/WebAR01).\n` +
      `3. Click "Add file" -> "Upload files", drag the extracted "public" folder onto the page, and click "Commit changes".\n` +
      `   (For individual files over 25 MB, push using Git or GitHub Desktop.)\n` +
      `4. Wait ~1 minute for GitHub Actions Pages deployment to turn green.\n` +
      `5. Scan QR-and-Printable-Sheets/single-qr-code.png on any phone — it opens the AR camera directly and recognizes all ${workspace.entries.length} markers!\n`,
  );

  onProgress("Creating ZIP package…");
  const { zip } = await import("fflate");
  const archive = await new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
  const zipBlob = new Blob([archive], { type: "application/zip" });
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const qrBlob = new Blob([qrBytes], { type: "image/png" });
  const filename = `${slug(workspace.title)}-publish.zip`;
  downloadBlob(zipBlob, filename);

  return {
    id,
    filename,
    zipBlob,
    pdfBlob,
    qrBlob,
    qrLink,
    qrDataUrl,
    publicBase,
    cardCount: workspace.entries.length,
  };
}

function validateCollection(input, publicationId) {
  if (
    !input ||
    input.version !== 1 ||
    !UUID.test(input.id || "") ||
    input.id !== publicationId ||
    !Array.isArray(input.cards) ||
    !input.cards.length ||
    input.cards.length > MAX_FLASHCARDS
  ) {
    throw new Error(
      "This published AR project is invalid or uses an unsupported format.",
    );
  }
  const expectedPrefix = `published/${publicationId}/files/`;
  const ownFile = (value) =>
    typeof value === "string" &&
    value.startsWith(expectedPrefix) &&
    safeResourceReference(value);
  if (!ownFile(input.target)) {
    throw new Error("The combined .mind tracking file is missing.");
  }
  const seenIds = new Set();
  const seenIndices = new Set();
  const cards = input.cards.map((card) => {
    if (
      !UUID.test(card?.id || "") ||
      seenIds.has(card.id) ||
      !Number.isInteger(card.targetIndex) ||
      card.targetIndex < 0 ||
      card.targetIndex > 99 ||
      !ownFile(card.marker) ||
      seenIndices.has(card.targetIndex)
    ) {
      throw new Error("A card in this published project is invalid.");
    }
    seenIds.add(card.id);
    seenIndices.add(card.targetIndex);
    return {
      id: card.id,
      title: cleanTitle(card.title, "AR Model"),
      targetIndex: card.targetIndex,
      marker: card.marker,
      target: input.target,
      scene: validateScene(card.scene),
    };
  });
  return {
    id: input.id,
    title: cleanTitle(input.title, "AR Collection"),
    mode: "shared",
    target: input.target,
    cards,
  };
}

export async function loadCollectionFromLocation() {
  const params = fragmentParams();
  const isDraft = params.get("draft") === "1";
  const id = params.get("p");
  let collection;

  if (isDraft) {
    const { workspace, scenes } = loadWorkspaceState();
    const issues = workspaceProblems(workspace, scenes);
    if (issues.length) throw new Error(issues[0]);
    if (!workspace.sharedTarget || !localRecord(workspace.sharedTarget.ref)) {
      throw new Error(
        "Tracking preview is not prepared yet. Open Create and click Preview again.",
      );
    }
    collection = {
      id: workspace.id,
      title: workspace.title,
      mode: "shared",
      isDraft: true,
      target: workspace.sharedTarget.ref,
      cards: workspace.entries.map((entry, index) => ({
        id: entry.id,
        title: entry.title,
        targetIndex: Number.isInteger(entry.targetIndex)
          ? entry.targetIndex
          : index,
        marker: entry.marker.ref,
        target: workspace.sharedTarget.ref,
        scene: sceneForEntry(entry, scenes),
      })),
    };
  } else {
    if (!id || !UUID.test(id)) {
      throw new Error(
        "This QR link is incomplete. Generate a fresh QR from Publish & share.",
      );
    }
    const response = await fetch(publicUrl(`published/${id}/manifest.json`), {
      cache: "no-cache",
    });
    if (
      !response.ok ||
      (response.headers.get("content-type") || "").includes("text/html")
    ) {
      throw new Error(
        "This published set is not online at this URL yet. Upload the extracted 'public' folder from your publish ZIP to your GitHub repository and wait for GitHub Pages to finish deploying.",
      );
    }
    const text = await response.text();
    if (text.length > 2_000_000) {
      throw new Error("This published manifest is too large to open.");
    }
    collection = validateCollection(JSON.parse(text), id);
  }

  if (!resolveResourceUrl(collection.target)) {
    throw new Error("The .mind tracking file is unavailable on this device.");
  }

  return {
    ...collection,
    autoStartCamera: params.get("camera") !== "0",
  };
}
