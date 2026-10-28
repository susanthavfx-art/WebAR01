// Optional Supabase connection for teacher media uploads and short published
// lesson links. Without configuration, the app continues to work locally and
// shares scenes with the original snapshot links.
import { useEffect, useState } from "react";

export const SESSION_KEY = "wonderlab.teacher-session.v1";
export const AUDIO_LIMIT = 20 * 1024 * 1024;
export const VIDEO_LIMIT = 50 * 1024 * 1024;
export const LESSON_LIMIT = 300 * 1024;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUDIO_TYPES = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  webm: "audio/webm",
};
const VIDEO_TYPES = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function readConfig() {
  // Tests can supply a fake Supabase endpoint. Production uses build variables.
  const test =
    typeof window !== "undefined" ? window.__WONDERLAB_CLOUD__ : undefined;
  const url = String(test?.url ?? import.meta.env.VITE_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const key = String(
    test?.key ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  ).trim();
  const bucket = String(
    test?.bucket ?? import.meta.env.VITE_SUPABASE_BUCKET ?? "lesson-media",
  ).trim();
  if (!url || !key || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(bucket)) return null;
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))
      return null;
  } catch {
    return null;
  }
  return { url, key, bucket };
}
let config;
export function cloudConfig() {
  if (config === undefined) config = readConfig();
  return config;
}
export const cloudEnabled = () => !!cloudConfig();

// ---------- teacher session ----------
const listeners = new Set();
let session = loadSession();
function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (
      saved &&
      typeof saved.access_token === "string" &&
      typeof saved.refresh_token === "string" &&
      ID.test(saved.user?.id || "")
    )
      return saved;
  } catch {
    /* Ignore unreadable sessions. */
  }
  return null;
}
function setSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Storage may be blocked; the session remains for this page only. */
  }
  listeners.forEach((listener) => listener(next));
}
export function currentSession() {
  return cloudEnabled() ? session : null;
}
export function useTeacherSession() {
  const [value, setValue] = useState(currentSession);
  useEffect(() => {
    const listener = () => setValue(currentSession());
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  return value;
}

function requireConfig() {
  const c = cloudConfig();
  if (!c)
    throw new Error(
      "Media uploads are not switched on for this website yet. Ask your library provider.",
    );
  return c;
}
async function authRequest(path, body, token) {
  const c = requireConfig();
  let response;
  try {
    response = await fetch(`${c.url}/auth/v1/${path}`, {
      method: "POST",
      headers: {
        apikey: c.key,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Could not reach the sign-in service. Check your internet.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(
      data.msg || data.message || data.error_description || data.error || "",
    );
    if (response.status === 429)
      throw new Error("Please wait a minute before asking for another code.");
    if (/signup|not allowed|not found/i.test(message))
      throw new Error(
        "This email is not on the teacher list. Ask your library provider to add it.",
      );
    if (/expired|invalid/i.test(message))
      throw new Error("That code is incorrect or expired. Request a new code.");
    throw new Error(message || "Sign-in did not work. Please try again.");
  }
  return data;
}
function sessionFrom(data) {
  if (
    !data.access_token ||
    !data.refresh_token ||
    !ID.test(data.user?.id || "")
  )
    throw new Error("Sign-in did not return a teacher session.");
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at:
      Number(data.expires_at) ||
      Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
    user: { id: data.user.id, email: String(data.user.email || "") },
  };
}
export const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()) &&
  String(email).length < 255;
export async function sendSignInCode(email) {
  if (!validEmail(email)) throw new Error("Enter a valid email address.");
  await authRequest("otp", {
    email: email.trim().toLowerCase(),
    create_user: false,
  });
}
export async function verifySignInCode(email, code) {
  const token = String(code).replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token))
    throw new Error("Enter the number code from your email.");
  const data = await authRequest("verify", {
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });
  setSession(sessionFrom(data));
  return session;
}
export async function signOut() {
  const token = session?.access_token;
  setSession(null);
  if (token) await authRequest("logout", {}, token).catch(() => {});
}
async function accessToken() {
  if (!currentSession())
    throw new Error("Sign in with your teacher email to upload media.");
  if (session.expires_at - 90 > Date.now() / 1000) return session.access_token;
  try {
    const c = requireConfig();
    const response = await fetch(
      `${c.url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: c.key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      },
    );
    if (!response.ok) throw new Error("refresh");
    setSession(sessionFrom(await response.json()));
    return session.access_token;
  } catch {
    setSession(null);
    throw new Error("Your sign-in has expired. Please sign in again.");
  }
}

// ---------- uploads ----------
function extension(name = "") {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}
export function mediaType(file, kind) {
  const table = kind === "audio" ? AUDIO_TYPES : VIDEO_TYPES;
  const declared = String(file?.type || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (declared.startsWith(`${kind}/`)) return declared;
  // Some phones label recordings as video/webm or leave the type blank.
  if (kind === "audio" && declared === "video/webm") return "audio/webm";
  if (kind === "audio" && declared === "video/mp4") return "audio/mp4";
  return table[extension(file?.name)] || "";
}
export function checkMediaFile(file, kind) {
  if (!file) throw new Error("Choose a file first.");
  const type = mediaType(file, kind);
  if (!type)
    throw new Error(
      kind === "audio"
        ? "Choose an MP3, M4A, WAV, OGG or WebM audio file."
        : "Choose an MP4, WebM or MOV video file.",
    );
  const limit = kind === "audio" ? AUDIO_LIMIT : VIDEO_LIMIT;
  if (file.size > limit)
    throw new Error(
      `This file is too large. Keep ${kind} files under ${limit / 1024 / 1024} MB.`,
    );
  if (file.size < 64)
    throw new Error("This file looks empty. Try another file.");
  return type;
}
const EXTENSIONS = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/json": "json",
};
export function publicFileUrl(path) {
  const c = requireConfig();
  return `${c.url}/storage/v1/object/public/${c.bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
function sendFile(path, body, type, token, onProgress, signal) {
  const c = requireConfig();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${c.url}/storage/v1/object/${c.bucket}/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
    );
    xhr.setRequestHeader("apikey", c.key);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 401 || xhr.status === 403)
        reject(
          new Error(
            "This teacher account is not allowed to upload. Sign in again or ask your library provider.",
          ),
        );
      else if (xhr.status === 413)
        reject(
          new Error("This file is larger than the library storage allows."),
        );
      else if (xhr.status === 415 || xhr.status === 422)
        reject(
          new Error("The library storage does not accept this file type."),
        );
      else reject(new Error("The upload did not finish. Please try again."));
    };
    xhr.onerror = () =>
      reject(
        new Error("The upload stopped. Check your internet and try again."),
      );
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}
export async function uploadMedia(file, kind, { onProgress, signal } = {}) {
  const type = checkMediaFile(file, kind);
  const token = await accessToken();
  const path = `${session.user.id}/${kind}/${crypto.randomUUID()}.${
    EXTENSIONS[type] || extension(file.name) || "bin"
  }`;
  await sendFile(path, file, type, token, onProgress, signal);
  onProgress?.(1);
  return {
    url: publicFileUrl(path),
    name: (file.name || (kind === "audio" ? "Voice recording" : "Video"))
      .replace(/\.[^.]+$/, "")
      .slice(0, 90),
    mime: type,
    size: file.size,
  };
}

// ---------- teacher-made markers ----------
// The printed image and the compiled MindAR target are stored together so a
// student's phone can download both from the published lesson.
export async function uploadMarker(image, target, { onProgress, signal } = {}) {
  if (!(image instanceof Blob) || image.type !== "image/jpeg")
    throw new Error("The marker image could not be prepared.");
  if (!(target instanceof Blob) || target.size < 1000)
    throw new Error("The tracking data could not be prepared.");
  if (image.size + target.size > 15 * 1024 * 1024)
    throw new Error("This marker is too large. Try a simpler photo.");
  const token = await accessToken();
  const id = crypto.randomUUID();
  const base = `${session.user.id}/markers/${id}`;
  const total = image.size + target.size;
  try {
    await sendFile(
      `${base}.jpg`,
      image,
      "image/jpeg",
      token,
      (part) => onProgress?.((part * image.size) / total),
      signal,
    );
    await sendFile(
      `${base}.mind`,
      target,
      "application/octet-stream",
      token,
      (part) => onProgress?.((image.size + part * target.size) / total),
      signal,
    );
  } catch (e) {
    if (e?.name === "AbortError" || /internet/.test(e?.message)) throw e;
    throw new Error(
      "The marker could not be saved. If this is the first custom marker on this website, the owner needs to run the marker storage update (MARKER-MAKER.md).",
    );
  }
  onProgress?.(1);
  return {
    id: `custom:${id}`,
    image: publicFileUrl(`${base}.jpg`),
    target: publicFileUrl(`${base}.mind`),
  };
}

// ---------- published lessons ----------
export async function publishLesson(project) {
  const token = await accessToken();
  const id = crypto.randomUUID();
  const body = JSON.stringify({
    format: "wonderlab-lesson",
    version: 1,
    publishedAt: new Date().toISOString(),
    project,
  });
  if (body.length > LESSON_LIMIT)
    throw new Error("This lesson is too large to publish. Shorten some text.");
  await sendFile(
    `${session.user.id}/lessons/${id}.json`,
    new Blob([body], { type: "application/json" }),
    "application/json",
    token,
  );
  return `${session.user.id}/${id}`;
}
export function validLessonKey(key) {
  const parts = String(key || "").split("/");
  return parts.length === 2 && parts.every((part) => ID.test(part));
}
export async function fetchLesson(key) {
  if (!validLessonKey(key)) throw new Error("This lesson link is not valid.");
  if (!cloudEnabled())
    throw new Error("Online lessons are not available on this website.");
  const [owner, id] = key.split("/");
  let response;
  try {
    response = await fetch(publicFileUrl(`${owner}/lessons/${id}.json`), {
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "This lesson could not load. Check your internet and try again.",
    );
  }
  if (response.status === 400 || response.status === 404)
    throw new Error(
      "This lesson was not found. Ask your teacher for a new link.",
    );
  if (!response.ok)
    throw new Error("This lesson could not load. Please try again later.");
  const raw = await response.text();
  if (raw.length > LESSON_LIMIT)
    throw new Error("This lesson file is too large.");
  const data = JSON.parse(raw);
  if (data?.format !== "wonderlab-lesson" || data.version !== 1)
    throw new Error("This lesson uses an unsupported format.");
  return data.project;
}
