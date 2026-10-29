// Vite substitutes BASE_URL at build time (e.g. /WebAR01/ on GitHub Pages, / locally).
export const APP_BASE = import.meta.env.BASE_URL;

export function publicUrl(path = "") {
  return `${APP_BASE}${path.replace(/^\/+/, "")}`;
}

export function fragmentParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function currentPage() {
  const params = fragmentParams();
  if (params.get("page") === "collection") return "collection";
  return "studio";
}
