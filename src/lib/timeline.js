// Transform keyframes are absolute poses. Between keys, interpolate each channel.
export function validateKeyframes(value) {
  if (!Array.isArray(value)) return [];
  const keys = new Map();
  for (const key of value.slice(0, 100)) {
    if (!key || !Number.isFinite(key.time) || key.time < 0 || key.time > 300 ||
        !Array.isArray(key.position) || !Array.isArray(key.rotation) ||
        key.position.length !== 3 || key.rotation.length !== 3 ||
        ![...key.position, ...key.rotation, key.scale].every(Number.isFinite)) continue;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const time = Math.round(key.time * 100) / 100;
    keys.set(time, { time, position: key.position.map((v, i) => clamp(v, i === 1 ? 0 : -4, 4)), rotation: key.rotation.map(v => clamp(v, -360, 360)), scale: clamp(key.scale, 0.15, 2.5) });
  }
  return [...keys.values()].sort((a, b) => a.time - b.time);
}

export function sampleKeyframes(keys, time, loop = true) {
  if (!keys?.length) return null;
  const end = keys[keys.length - 1].time;
  const t = loop && end > 0 ? Math.max(0, time) % end : Math.max(0, time);
  if (t <= keys[0].time) return keys[0];
  const next = keys.findIndex(key => key.time >= t);
  if (next < 0) return keys[keys.length - 1];
  const a = keys[next - 1], b = keys[next];
  const f = (t - a.time) / (b.time - a.time);
  const lerp = (x, y) => x + (y - x) * f;
  return { position: a.position.map((v, i) => lerp(v, b.position[i])), rotation: a.rotation.map((v, i) => lerp(v, b.rotation[i])), scale: lerp(a.scale, b.scale) };
}
