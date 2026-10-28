// Vite substitutes this at build time. GitHub project Pages uses /AR-Web-App/,
// while local development and a root-domain deployment normally use /.
export const APP_BASE = import.meta.env.BASE_URL;

export function publicUrl(path = "") {
  return `${APP_BASE}${path.replace(/^\/+/, "")}`;
}

export function fragmentParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

export function currentPage() {
  const params = fragmentParams();
  const page = params.get("page");
  if (page === "view" || page === "print" || page === "collection") return page;

  // Preserve existing /view and /print links on hosts with SPA fallback.
  // New links use fragments so they also work on GitHub Pages, without a 404.
  const basePath = new URL(APP_BASE, window.location.origin).pathname;
  let pathname = window.location.pathname;
  if (basePath !== "/" && pathname.startsWith(basePath)) {
    pathname = `/${pathname.slice(basePath.length)}`;
  }
  if (/^\/view(?:\/|$)/.test(pathname)) return "view";
  if (/^\/print(?:\/|$)/.test(pathname)) return "print";
  if (params.has("scene") || params.has("lesson")) return "view";
  return "studio";
}
