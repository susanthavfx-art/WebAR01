// Binary uploads are kept in IndexedDB, not localStorage and not inside QR
// codes. They stay on this device until a publication bundle is exported.
import { publicUrl } from "./deployment";

const DB_NAME = "wonderlab.mini.files.v1";
const STORE = "files";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const LOCAL = new RegExp(`^local:(${UUID})$`, "i");
const PUBLISHED = new RegExp(
  `^published/(${UUID})/files/(${UUID})\\.(glb|mind|jpe?g|png|webp|mp3|m4a|mp4|m4v|mov|wav|ogg|oga|aac|webm)$`,
  "i",
);
const UPLOADED_MODEL = new RegExp(`^uploads/(${UUID})\\.glb$`, "i");
const records = new Map();
const urls = new Map();
let database;
let startup;

function openDatabase() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("This browser does not support local file storage."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open file storage."));
    request.onblocked = () =>
      reject(new Error("File storage is blocked by another open tab."));
  });
  return database;
}

function remember(record) {
  const old = urls.get(record.id);
  if (old) URL.revokeObjectURL(old);
  records.set(record.id, record);
  urls.set(record.id, URL.createObjectURL(record.blob));
}

export function initialiseLocalFiles() {
  if (!startup)
    startup = openDatabase().then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE, "readonly");
          const request = transaction.objectStore(STORE).openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              if (cursor.value?.id && cursor.value.blob instanceof Blob)
                remember(cursor.value);
              cursor.continue();
            }
          };
          transaction.oncomplete = () => resolve();
          transaction.onerror = () =>
            reject(
              transaction.error || new Error("Could not read local files."),
            );
        }),
    );
  return startup;
}

export const localReference = (id) => `local:${id}`;
export const localId = (value) =>
  LOCAL.exec(String(value || ""))?.[1]?.toLowerCase() || "";
export const localModelId = (value) =>
  UPLOADED_MODEL.exec(String(value || ""))?.[1]?.toLowerCase() || "";
export const isLocalReference = (value) => !!localId(value);

// These references are deliberately constrained: never accept javascript:,
// arbitrary relative paths, data: URLs or an origin-supplied blob: URL in a
// saved/shared project.
export function safeResourceReference(value) {
  if (typeof value !== "string" || value.length > 1200) return "";
  if (LOCAL.test(value) || PUBLISHED.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function resolveResourceUrl(value) {
  const id = localId(value);
  if (id) return urls.get(id) || "";
  if (PUBLISHED.test(String(value || ""))) return publicUrl(value);
  return safeResourceReference(value);
}
export function resolveModelFile(value) {
  const id = localModelId(value);
  if (id) return urls.get(id) || "";
  if (PUBLISHED.test(String(value || ""))) return publicUrl(value);
  return "";
}
export function localRecord(value) {
  const id = localId(value) || localModelId(value);
  return id ? records.get(id) || null : null;
}

const FILE_TYPES = {
  marker: {
    extensions: ["jpg", "jpeg", "png", "webp"],
    max: 20,
    label: "marker image",
  },
  image: {
    extensions: ["jpg", "jpeg", "png", "webp"],
    max: 20,
    label: "image",
  },
  model: { extensions: ["glb"], max: 40, label: "3D model" },
  target: { extensions: ["mind"], max: 100, label: "MindAR target" },
  audio: {
    extensions: ["mp3", "m4a", "mp4", "wav", "ogg", "oga", "webm", "aac"],
    max: 20,
    label: "audio",
  },
  video: { extensions: ["mp4", "m4v", "webm", "mov"], max: 50, label: "video" },
};
function extension(name) {
  return /\.([a-z0-9]+)$/i.exec(name || "")?.[1]?.toLowerCase() || "";
}
function imageMime(ext) {
  return ext === "png"
    ? "image/png"
    : ext === "webp"
      ? "image/webp"
      : "image/jpeg";
}
async function checkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
  } catch {
    throw new Error(
      "This image could not be opened. Choose a valid JPG, PNG or WebP file.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function checkModel(file) {
  const header = new DataView(await file.slice(0, 20).arrayBuffer());
  if (
    file.size < 20 ||
    header.getUint32(0, true) !== 0x46546c67 ||
    header.getUint32(4, true) !== 2 ||
    header.getUint32(8, true) !== file.size ||
    header.getUint32(16, true) !== 0x4e4f534a
  ) {
    throw new Error(
      "Choose a valid, self-contained GLB 2.0 model (not a renamed FBX or OBJ). ",
    );
  }
}
async function readTarget(file) {
  if (
    !file ||
    extension(file.name) !== "mind" ||
    !file.size ||
    file.size > FILE_TYPES.target.max * 1024 * 1024
  )
    throw new Error("Choose a non-empty .mind file under 100 MB.");
  try {
    const { decode } = await import("@msgpack/msgpack");
    const target = decode(new Uint8Array(await file.arrayBuffer()));
    if (
      target?.v !== 2 ||
      !Array.isArray(target.dataList) ||
      !target.dataList.length ||
      target.dataList.length > 100 ||
      target.dataList.some(
        (item) =>
          !item?.targetImage?.width ||
          !item?.targetImage?.height ||
          !Array.isArray(item.trackingData) ||
          !Array.isArray(item.matchingData),
      )
    )
      throw new Error();
    return target;
  } catch {
    throw new Error(
      "This is not a readable MindAR .mind target file. Upload a compiled MindAR file (up to 100 targets).",
    );
  }
}
export async function inspectMindFile(file) {
  const target = await readTarget(file);
  return target.dataList.length;
}
// MindAR v2 stores independent target descriptors in dataList. Concatenating
// these precompiled entries retains each target's tracking data and order; no
// image recompilation is needed. The displayed order is the resulting index.
export async function combineMindFiles(files, onProgress = () => {}) {
  if (!Array.isArray(files) || !files.length || files.length > 50)
    throw new Error("Choose between 1 and 50 .mind files.");
  if (files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
    throw new Error("The combined target files must be under 100 MB.");
  const list = [];
  for (const [index, file] of files.entries()) {
    onProgress(`Reading target ${index + 1} of ${files.length}…`);
    const target = await readTarget(file);
    list.push(...target.dataList);
    if (list.length > 100)
      throw new Error("The combined file can contain at most 100 targets.");
  }
  onProgress("Saving combined target file…");
  const { encode } = await import("@msgpack/msgpack");
  const bytes = encode({ v: 2, dataList: list });
  return saveLocalFile(
    new File([bytes], "combined-targets.mind", {
      type: "application/octet-stream",
    }),
    "target",
  );
}

export async function saveLocalFile(file, kind) {
  const config = FILE_TYPES[kind];
  if (!file || !config) throw new Error("Choose a file first.");
  const ext = extension(file.name);
  if (!config.extensions.includes(ext))
    throw new Error(
      `Choose a ${config.label} file: ${config.extensions.map((e) => `.${e}`).join(", ")}.`,
    );
  if (!file.size || file.size > config.max * 1024 * 1024)
    throw new Error(
      `Keep each ${config.label} under ${config.max} MB and make sure it is not empty.`,
    );
  let targetCount;
  if (kind === "marker" || kind === "image") await checkImage(file);
  if (kind === "model") await checkModel(file);
  if (kind === "target") targetCount = (await readTarget(file)).dataList.length;
  const id = crypto.randomUUID();
  const mediaTypes = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: kind === "audio" ? "audio/mp4" : "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    webm: kind === "audio" ? "audio/webm" : "video/webm",
    aac: "audio/aac",
  };
  const type =
    kind === "image" || kind === "marker"
      ? imageMime(ext)
      : kind === "model"
        ? "model/gltf-binary"
        : kind === "target"
          ? "application/octet-stream"
          : mediaTypes[ext];
  const record = {
    id,
    kind,
    name: String(file.name).slice(0, 120),
    ext: ext === "jpeg" ? "jpg" : ext,
    type,
    size: file.size,
    blob: new Blob([file], { type }),
    ...(targetCount ? { targetCount } : {}),
  };
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    remember(record);
    return {
      id,
      ref: localReference(id),
      name: record.name,
      size: record.size,
      ext: record.ext,
      type: record.type,
      ...(targetCount ? { targetCount } : {}),
    };
  } catch (error) {
    throw new Error(
      error?.name === "QuotaExceededError"
        ? "This device is out of storage. Free space or use smaller files, then try again."
        : "Could not save the file on this device. Check browser storage permissions and try again.",
    );
  }
}

export function projectHasLocalFiles(project) {
  return !!(
    isLocalReference(project?.marker?.image) ||
    isLocalReference(project?.marker?.target) ||
    project?.objects?.some(
      (o) =>
        localModelId(o.model?.file) ||
        o.actions?.some((a) => isLocalReference(a.sound?.url)),
    ) ||
    project?.cards?.some((card) => isLocalReference(card.media?.url))
  );
}
