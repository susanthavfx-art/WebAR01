// Supabase Storage publishing.
//
// Every time the Publish button is pressed the app creates a brand new folder
// inside the `ar-published` bucket (published/<publication-id>/) and uploads the
// whole AR bundle there, so a QR can be shared without uploading anything to
// GitHub. The Storage REST API is used directly with fetch, so no extra
// dependency is needed and the bundle stays small.

const SETTINGS_KEY = "wonderlab.webar01.supabase.v1";

// Fallback anon (publishable) key. Supabase anon keys are designed to be public:
// row/object level security is what actually protects the database.
const ANON_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdGZjdGNzamF1b2JuY3Zlbm5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NTM2NjEsImV4cCI6MjEwODUyOTY2MX0.U3j4XIiK2HWEX_O4ZPT7RTJo9E8HpI7kBe_Cs5KKSCM";

export const SUPABASE_DEFAULTS = Object.freeze({
  url: String(
    import.meta.env?.VITE_SUPABASE_URL ||
      "https://zptfctcsjauobncvenne.supabase.co",
  ),
  anonKey: String(import.meta.env?.VITE_SUPABASE_ANON_KEY || ANON_FALLBACK),
  bucket: String(import.meta.env?.VITE_SUPABASE_BUCKET || "ar-published"),
});

export const MAX_OBJECT_BYTES = 50 * 1024 * 1024;

export function publicationFolder(publicationId) {
  return `published/${publicationId}`;
}

export function normaliseProjectUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Enter your Supabase project URL.");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "Enter your Supabase project URL, for example https://abcdefgh.supabase.co.",
    );
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password
  ) {
    throw new Error("The Supabase project URL must start with https://.");
  }
  if (url.search || url.hash) {
    throw new Error("Enter just the Supabase project URL, without ? or #.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function normaliseBucket(value) {
  const bucket = String(value || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(bucket)) {
    throw new Error(
      "Bucket names use letters, numbers, dots, dashes or underscores.",
    );
  }
  return bucket;
}

function readStored() {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadSupabaseSettings() {
  const stored = readStored();
  const pick = (key, fallback) => {
    const value = stored[key];
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  };
  return {
    enabled: stored.enabled === false ? false : true,
    url: pick("url", SUPABASE_DEFAULTS.url),
    anonKey: pick("anonKey", SUPABASE_DEFAULTS.anonKey),
    bucket: pick("bucket", SUPABASE_DEFAULTS.bucket),
  };
}

export function saveSupabaseSettings(patch = {}) {
  const next = { ...loadSupabaseSettings(), ...patch };
  const clean = {
    enabled: next.enabled !== false,
    url: normaliseProjectUrl(next.url),
    anonKey: String(next.anonKey || "").trim(),
    bucket: normaliseBucket(next.bucket),
  };
  if (!clean.anonKey) {
    throw new Error("Paste the anon (publishable) key for your project.");
  }
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(clean));
  } catch {
    /* Settings still apply for this session. */
  }
  return clean;
}

export function resetSupabaseSettings() {
  try {
    globalThis.localStorage?.removeItem(SETTINGS_KEY);
  } catch {
    /* Nothing to clear. */
  }
  return loadSupabaseSettings();
}

export function isSupabaseConfigured(settings = loadSupabaseSettings()) {
  return !!(
    settings?.enabled &&
    /^https:\/\//i.test(settings.url || "") &&
    String(settings.anonKey || "").length > 20 &&
    settings.bucket
  );
}

export function bucketBase(settings = loadSupabaseSettings()) {
  return `${normaliseProjectUrl(settings.url)}/storage/v1/object/public/${normaliseBucket(
    settings.bucket,
  )}/`;
}

export function publishedObjectUrl(path, settings) {
  const clean = String(path || "").replace(/^\/+/, "");
  return `${bucketBase(settings)}${clean}`;
}

export function storageInfo(settings, publicationId) {
  return {
    provider: "supabase",
    bucket: normaliseBucket(settings.bucket),
    base: bucketBase(settings),
    folder: publicationFolder(publicationId),
    projectUrl: normaliseProjectUrl(settings.url),
  };
}

const CONTENT_TYPES = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  mind: "application/octet-stream",
  json: "application/json",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  webm: "video/webm",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/mp4",
  pdf: "application/pdf",
  txt: "text/plain;charset=utf-8",
};

export function contentTypeFor(name) {
  const ext = String(name || "")
    .toLowerCase()
    .split(".")
    .pop();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

function authHeaders(settings) {
  return {
    apikey: settings.anonKey,
    Authorization: `Bearer ${settings.anonKey}`,
  };
}

async function uploadObject(key, bytes, contentType, settings) {
  const url = `${normaliseProjectUrl(settings.url)}/storage/v1/object/${encodeURIComponent(
    normaliseBucket(settings.bucket),
  )}/${key.split("/").map(encodeURIComponent).join("/")}`;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...authHeaders(settings),
          "cache-control": "public, max-age=31536000",
          "content-type": contentType,
          "x-upsert": "false",
        },
        body: bytes,
      });
      if (response.ok) return;
      const detail = await response.text().catch(() => "");
      const message = (() => {
        try {
          return JSON.parse(detail)?.message || detail;
        } catch {
          return detail;
        }
      })();
      // A retried upload of an identical file is as good as a fresh one.
      if (
        response.status === 409 ||
        /already exists|duplicate/i.test(String(message || ""))
      ) {
        return;
      }
      if (response.status === 413) {
        throw new Error(
          `${key.split("/").pop()} is larger than Supabase's ${Math.round(
            MAX_OBJECT_BYTES / (1024 * 1024),
          )} MB per-file limit.`,
        );
      }
      if ([400, 401, 403, 404].includes(response.status)) {
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Supabase rejected the upload. Check the anon key and the ar-published bucket policies."
            : `Supabase could not store ${key.split("/").pop()}: ${
                message || `HTTP ${response.status}`
              }`,
        );
      }
      lastError = new Error(
        `Supabase upload failed (HTTP ${response.status}) ${message || ""}`.trim(),
      );
    } catch (error) {
      if (error?.message?.includes("larger than Supabase")) throw error;
      if (error?.message?.includes("rejected the upload")) throw error;
      if (error?.message?.startsWith("Supabase could not store")) throw error;
      lastError = error;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 500 * (attempt + 1) + Math.random() * 250),
    );
  }
  throw lastError || new Error("Supabase upload failed.");
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
}

export function cloudFileList(files, publicationId) {
  const prefix = `public/${publicationFolder(publicationId)}/`;
  return Object.keys(files)
    .filter((path) => path.startsWith(prefix))
    .map((path) => ({
      path,
      key: path.slice("public/".length),
      bytes: files[path],
    }));
}

/**
 * Uploads a publish bundle into a brand new Supabase folder.
 * `files` uses the same "public/..." keys as the ZIP package.
 */
export async function uploadPublication({
  publicationId,
  files,
  title = "",
  cardCount = 0,
  settings = loadSupabaseSettings(),
  onProgress = () => {},
}) {
  if (!isSupabaseConfigured(settings)) {
    throw new Error(
      "Supabase is not connected yet. Add your project URL and anon key first.",
    );
  }
  const list = cloudFileList(files, publicationId);
  if (!list.length) throw new Error("There is nothing to upload.");

  const totalBytes = list.reduce(
    (sum, item) => sum + (item.bytes?.length || 0),
    0,
  );
  const folder = publicationFolder(publicationId);
  let done = 0;
  let sentBytes = 0;
  onProgress(`Creating Supabase folder ${folder}…`);

  await mapLimit(list, 3, async (item) => {
    await uploadObject(
      item.key,
      item.bytes,
      contentTypeFor(item.key),
      settings,
    );
    done += 1;
    sentBytes += item.bytes?.length || 0;
    const percent = Math.round(
      ((sentBytes || done) / (totalBytes || list.length)) * 100,
    );
    onProgress(
      `Saving to Supabase ${done}/${list.length} files (${percent}%)…`,
    );
  });

  const info = storageInfo(settings, publicationId);
  onProgress("Registering publication…");
  registerPublication({
    id: publicationId,
    bucket: info.bucket,
    folder: info.folder,
    publicBase: info.base,
    cardCount,
    sizeBytes: totalBytes,
    settings,
    title,
  }).catch(() => {});

  return {
    ...info,
    fileCount: list.length,
    sizeBytes: totalBytes,
    manifestUrl: `${info.base}${folder}/manifest.json`,
    dashboardUrl: dashboardFolderUrl(info, folder),
  };
}

export function dashboardFolderUrl(info, folder = info?.folder || "") {
  const ref = projectRef(info?.projectUrl);
  const bucket = info?.bucket || "";
  if (!ref) return "https://supabase.com/dashboard/projects";
  return `https://supabase.com/dashboard/project/${ref}/storage/buckets/${bucket}?path=${encodeURIComponent(
    folder,
  )}`;
}

function projectRef(projectUrl) {
  try {
    return new URL(normaliseProjectUrl(projectUrl)).hostname.split(".")[0];
  } catch {
    return "";
  }
}

/** Optional index row so every publication is visible in the Supabase table. */
export async function registerPublication({
  id,
  title,
  bucket,
  folder,
  publicBase,
  cardCount = 0,
  sizeBytes = 0,
  settings = loadSupabaseSettings(),
}) {
  const url = `${normaliseProjectUrl(settings.url)}/rest/v1/publications`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(settings),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify([
      {
        id,
        title: String(title || "AR publication").slice(0, 70),
        bucket,
        folder,
        public_base: publicBase,
        card_count: cardCount,
        size_bytes: sizeBytes,
      },
    ]),
  });
  if (!response.ok) {
    throw new Error(
      `Could not register the publication (HTTP ${response.status}).`,
    );
  }
}

/** Downloads a published manifest straight from Supabase Storage. */
export async function fetchPublishedManifest(
  publicationId,
  settings = loadSupabaseSettings(),
) {
  if (!isSupabaseConfigured(settings)) return "";
  const url = publishedObjectUrl(
    `${publicationFolder(publicationId)}/manifest.json`,
    settings,
  );
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return "";
    const text = await response.text();
    if (text.length > 2_000_000) return "";
    if ((response.headers.get("content-type") || "").includes("text/html"))
      return "";
    return text;
  } catch {
    return "";
  }
}
