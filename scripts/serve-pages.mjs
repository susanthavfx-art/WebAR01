// Strict local simulation of a GitHub project Pages deployment.
// There is deliberately NO SPA fallback. Viewer/print fragment links must work.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const prefix = (process.env.APP_BASE_PATH || "/AR-Web-App/").replace(
  /\/?$/,
  "/",
);
const root = path.resolve("site");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};
http
  .createServer((req, res) => {
    let name;
    try {
      name = decodeURIComponent(
        new URL(req.url, "http://static.invalid").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (name === "/") {
      res.writeHead(302, { Location: prefix }).end();
      return;
    }
    if (!name.startsWith(prefix)) {
      res
        .writeHead(404, { "Content-Type": "text/plain" })
        .end("Outside the project base path");
      return;
    }
    const rel = name.slice(prefix.length) || "index.html";
    const file = path.resolve(root, rel);
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res
        .writeHead(404, { "Content-Type": "text/plain" })
        .end("Not found — this server has no SPA fallback");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(process.env.PORT) || 5173, "0.0.0.0", () =>
    console.log(
      `Pages-compatible preview: http://0.0.0.0:${Number(process.env.PORT) || 5173}${prefix}`,
    ),
  );
