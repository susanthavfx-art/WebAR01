// Play buttons: teacher-defined actions that run one GLB animation clip, a
// simple built-in movement, and/or a sound on a single scene object.
import * as THREE from "three";
import { validateMedia } from "./lesson-cards";
import { resolveResourceUrl } from "./local-files";

export const MAX_ACTIONS = 6;
export const ACTION_LABEL_LIMIT = 24;
export const MAX_CLIP_INDEX = 99;
export const EFFECTS = [
  { id: "@jump", name: "Jump", duration: 0.9 },
  { id: "@spin", name: "Spin around", duration: 1.2 },
  { id: "@grow", name: "Grow and shrink", duration: 1.1 },
  { id: "@wiggle", name: "Wiggle", duration: 1 },
];
const EFFECT_IDS = EFFECTS.map((e) => e.id);
const FADE = 0.25;
const ZERO = Object.freeze({ y: 0, rot: 0, tilt: 0, scale: 1 });

const isClipIndex = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_CLIP_INDEX;
export const isEffect = (v) => EFFECT_IDS.includes(v);
export const effectName = (id) => EFFECTS.find((e) => e.id === id)?.name || "";

function newId() {
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- data ---------------- */

export function validIdleClip(value) {
  return value === -1 || isClipIndex(value) ? value : undefined;
}

export function validateAction(input) {
  if (!input || typeof input !== "object") return null;
  const clip =
    isClipIndex(input.clip) || isEffect(input.clip) ? input.clip : null;
  const sound = validateMedia(input.sound, "audio");
  if (clip === null && !sound) return null;
  const label =
    String(typeof input.label === "string" ? input.label : "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ACTION_LABEL_LIMIT) ||
    (sound && clip === null ? "Sound" : effectName(clip) || "Play");
  return {
    id:
      typeof input.id === "string" && /^[\w-]{1,80}$/.test(input.id)
        ? input.id
        : newId(),
    label,
    clip,
    ...(input.loop === true && isClipIndex(clip) ? { loop: true } : {}),
    sound,
  };
}

export function validateActions(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const action = validateAction(raw);
    if (!action) continue;
    if (seen.has(action.id)) action.id = newId();
    seen.add(action.id);
    out.push(action);
    if (out.length >= MAX_ACTIONS) break;
  }
  return out;
}

export function blankAction(clipNames = [], used = []) {
  const free = clipNames.findIndex((_, i) => !used.includes(i));
  if (clipNames.length)
    return {
      id: newId(),
      label: clipNames[Math.max(0, free)].slice(0, ACTION_LABEL_LIMIT),
      clip: Math.max(0, free),
      sound: null,
    };
  return { id: newId(), label: "Jump", clip: "@jump", sound: null };
}

// Compact form for inline (#scene=) links. Object rows stay unchanged; actions
// travel in a separate top-level key so older links keep decoding.
export function encodeObjectActions(objects) {
  const rows = [];
  objects.forEach((o, i) => {
    const idle = validIdleClip(o.idleClip);
    const actions = validateActions(o.actions);
    if (idle === undefined && !actions.length) return;
    rows.push([
      i,
      idle === undefined ? null : idle,
      actions.map((a) => {
        const row = [a.label, a.clip, a.loop ? 1 : 0];
        if (a.sound)
          row.push(
            a.sound.url,
            a.sound.name,
            a.sound.mime || "",
            a.sound.duration ?? null,
            a.sound.recorded ? 1 : 0,
          );
        return row;
      }),
    ]);
  });
  return rows;
}

export function decodeObjectActions(rows, objects) {
  if (!Array.isArray(rows)) return objects;
  const copy = objects.map((o) => ({ ...o }));
  for (const row of rows.slice(0, copy.length)) {
    if (!Array.isArray(row) || !Number.isInteger(row[0]) || !copy[row[0]])
      continue;
    const target = copy[row[0]];
    const idle = validIdleClip(row[1]);
    if (idle !== undefined) target.idleClip = idle;
    if (!Array.isArray(row[2])) continue;
    target.actions = validateActions(
      row[2].slice(0, MAX_ACTIONS).map((a) =>
        Array.isArray(a)
          ? {
              label: a[0],
              clip: a[1],
              loop: a[2] === 1,
              sound:
                typeof a[3] === "string"
                  ? {
                      url: a[3],
                      name: a[4],
                      mime: a[5] || undefined,
                      duration: typeof a[6] === "number" ? a[6] : undefined,
                      recorded: a[7] === 1,
                    }
                  : null,
            }
          : null,
      ),
    );
  }
  return copy;
}

/* ---------------- runtime ---------------- */

const liveSounds = new Set();

function stateOf(group) {
  if (!group.userData.actionState)
    group.userData.actionState = {
      effect: null,
      clipAction: null,
      current: null,
      sound: null,
      listener: null,
    };
  return group.userData.actionState;
}

function refreshActing(group) {
  const s = stateOf(group);
  group.userData.acting = !!(s.effect || s.clipAction);
}

// True while a play button is moving the model, plus a short settle time so
// cross-fades back to the main animation finish even when the scene is paused.
export function isActing(group) {
  const s = group?.userData.actionState;
  if (!s) return false;
  return !!(
    s.effect ||
    s.clipAction ||
    (s.settleUntil && performance.now() / 1000 < s.settleUntil)
  );
}

function wantedIdleIndex(group) {
  const wanted = group.userData.idleWanted;
  if (wanted === undefined) return group.userData.autoAnimate ? 0 : -1;
  return wanted;
}

// Called by createGLBModel when the model is ready and whenever the teacher
// changes the main (looping) animation.
export function applyIdleClip(group) {
  const { mixer, clips } = group.userData;
  if (!mixer || !clips?.length) return;
  const index = wantedIdleIndex(group);
  const clip = index >= 0 ? clips[index] || null : null;
  const current = group.userData.idleAction || null;
  if (current && current.getClip() === clip) return;
  const s = stateOf(group);
  if (current && current !== s.clipAction) current.fadeOut(FADE);
  if (!clip) {
    group.userData.idleAction = null;
    return;
  }
  const action = mixer.clipAction(clip);
  group.userData.idleAction = action;
  if (s.clipAction) return; // a play button is running; idle resumes after it
  action.reset().setLoop(THREE.LoopRepeat, Infinity);
  if (current) action.fadeIn(FADE);
  action.play();
}

export function setIdleClip(group, idle) {
  if (!group) return;
  if (group.userData.idleWanted === idle && group.userData.idleApplied) return;
  group.userData.idleWanted = idle;
  group.userData.idleApplied = true;
  applyIdleClip(group);
}

function returnToIdle(group) {
  const s = stateOf(group);
  const idle = group.userData.idleAction;
  const running = s.clipAction;
  s.clipAction = null;
  s.settleUntil = performance.now() / 1000 + FADE + 0.1;
  if (s.current && !s.effect) s.current = null;
  if (running && running !== idle) running.fadeOut(FADE);
  if (idle) {
    idle.reset().setLoop(THREE.LoopRepeat, Infinity);
    if (running && running !== idle) idle.fadeIn(FADE);
    idle.play();
  }
  refreshActing(group);
}

function stopSound(s) {
  if (!s.sound) return;
  try {
    s.sound.pause();
  } catch {
    /* ignore */
  }
  liveSounds.delete(s.sound);
  s.sound = null;
}

/**
 * Plays a teacher action on a model group. Returns "loop" when a looping clip
 * started, "once" for one-shot actions and "stopped" when a looping action was
 * tapped again.
 */
export function playAction(group, action, onSoundError) {
  if (!group || !action) return "none";
  const s = stateOf(group);
  if (s.current?.loop && s.current.id === action.id) {
    stopActions(group);
    return "stopped";
  }
  stopSound(s);
  const url = resolveResourceUrl(action.sound?.url);
  if (url) {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.addEventListener("ended", () => {
      liveSounds.delete(audio);
      if (s.sound === audio) s.sound = null;
    });
    liveSounds.add(audio);
    s.sound = audio;
    const playing = audio.play();
    if (playing?.catch)
      playing.catch((error) => {
        liveSounds.delete(audio);
        if (error?.name !== "AbortError") onSoundError?.(error);
      });
  }
  const loop = !!action.loop && isClipIndex(action.clip);
  if (isEffect(action.clip)) {
    s.effect = { type: action.clip, start: performance.now() / 1000 };
  } else if (isClipIndex(action.clip)) {
    const { mixer, clips } = group.userData;
    const clip = clips?.[action.clip];
    if (mixer && clip) {
      const idle = group.userData.idleAction;
      const next = mixer.clipAction(clip);
      if (s.clipAction && s.clipAction !== next && s.clipAction !== idle)
        s.clipAction.fadeOut(0.15);
      if (idle && idle !== next) idle.fadeOut(0.2);
      next.reset();
      next.setLoop(
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
        loop ? Infinity : 1,
      );
      next.clampWhenFinished = false;
      next.fadeIn(0.2).play();
      s.clipAction = next;
      if (!s.listener) {
        s.listener = (event) => {
          if (event.action === s.clipAction && !s.current?.loop)
            returnToIdle(group);
        };
        mixer.addEventListener("finished", s.listener);
      }
    }
  }
  s.current = { id: action.id, loop };
  refreshActing(group);
  return loop ? "loop" : "once";
}

export function stopActions(group) {
  if (!group?.userData.actionState) return;
  const s = stateOf(group);
  stopSound(s);
  s.effect = null;
  s.current = null;
  if (s.clipAction) returnToIdle(group);
  refreshActing(group);
}

export function disposeActions(group) {
  const s = group?.userData.actionState;
  if (!s) return;
  stopSound(s);
  if (s.listener && group.userData.mixer)
    group.userData.mixer.removeEventListener("finished", s.listener);
  group.userData.actionState = null;
  group.userData.acting = false;
}

export function stopAllSounds() {
  for (const audio of liveSounds) {
    try {
      audio.pause();
    } catch {
      /* ignore */
    }
  }
  liveSounds.clear();
}

export function loopingActionId(group) {
  const current = group?.userData.actionState?.current;
  return current?.loop ? current.id : null;
}

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

// Transform offsets for the built-in movements; called every frame.
export function actionOffsets(group, now = performance.now() / 1000) {
  const s = group?.userData.actionState;
  const effect = s?.effect;
  if (!effect) return ZERO;
  const info = EFFECTS.find((e) => e.id === effect.type);
  const p = (now - effect.start) / (info?.duration || 1);
  if (p >= 1 || p < 0) {
    s.effect = null;
    if (s.current && !s.clipAction) s.current = null;
    refreshActing(group);
    return ZERO;
  }
  switch (effect.type) {
    case "@jump":
      return { ...ZERO, y: Math.sin(p * Math.PI) * 0.7 };
    case "@spin":
      return { ...ZERO, rot: ease(p) * Math.PI * 2 };
    case "@grow":
      return { ...ZERO, scale: 1 + Math.sin(p * Math.PI) * 0.35 };
    case "@wiggle":
      return { ...ZERO, tilt: Math.sin(p * Math.PI * 6) * 0.28 * (1 - p) };
    default:
      return ZERO;
  }
}
