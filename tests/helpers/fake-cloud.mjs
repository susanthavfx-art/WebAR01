// In-memory stand-in for the Supabase Auth and Storage REST endpoints used by
// lesson-box uploads and short published lesson links.
export const CLOUD_URL = "https://lesson-test.supabase.co";
export const TEACHER_ID = "5b8f0a52-3c1e-4f7a-9d2b-6e4c1a7f9b30";
export const TEACHER_EMAIL = "teacher@school.example";
const ACCESS_TOKEN = "test-teacher-access-token";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers":
    "apikey, authorization, content-type, x-upsert, cache-control",
};

export function createCloudStore() {
  // Mirrors the bucket policy in LESSON-BOXES.md plus the marker upgrade.
  return {
    files: new Map(),
    requests: [],
    folders: ["audio", "video", "lessons", "markers"],
  };
}

export async function useFakeCloud(context, store) {
  await context.addInitScript((url) => {
    window.__WONDERLAB_CLOUD__ = {
      url,
      key: "sb_publishable_test_key",
      bucket: "lesson-media",
    };
  }, CLOUD_URL);
  await context.route(`${CLOUD_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (method === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    const headers = request.headers();
    const entry = { method, path: url.pathname, headers };
    store.requests.push(entry);
    const json = (status, body) =>
      route.fulfill({
        status,
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    if (url.pathname === "/auth/v1/otp") {
      entry.body = request.postDataJSON();
      if (headers.apikey !== "sb_publishable_test_key" || headers.authorization)
        return json(401, { msg: "bad key use" });
      if (entry.body.email !== TEACHER_EMAIL)
        return json(422, { msg: "Signups not allowed for otp" });
      return json(200, {});
    }
    if (url.pathname === "/auth/v1/verify") {
      entry.body = request.postDataJSON();
      if (entry.body.token !== "123456" || entry.body.type !== "email")
        return json(403, { msg: "Token has expired or is invalid" });
      return json(200, {
        access_token: ACCESS_TOKEN,
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: TEACHER_ID, email: TEACHER_EMAIL },
      });
    }
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers: cors });
    const upload = /^\/storage\/v1\/object\/lesson-media\/(.+)$/.exec(
      url.pathname,
    );
    if (method === "POST" && upload) {
      const path = decodeURIComponent(upload[1]);
      if (
        headers.authorization !== `Bearer ${ACCESS_TOKEN}` ||
        headers.apikey !== "sb_publishable_test_key" ||
        !path.startsWith(`${TEACHER_ID}/`)
      )
        return json(403, { message: "new row violates row-level security" });
      if (!store.folders.includes(path.split("/")[1]))
        return json(400, {
          statusCode: "403",
          error: "Unauthorized",
          message: "new row violates row-level security policy",
        });
      store.files.set(path, {
        type: headers["content-type"],
        body: request.postDataBuffer(),
      });
      return json(200, { Key: `lesson-media/${path}` });
    }
    const download = /^\/storage\/v1\/object\/public\/lesson-media\/(.+)$/.exec(
      url.pathname,
    );
    if (method === "GET" && download) {
      const file = store.files.get(decodeURIComponent(download[1]));
      if (!file) return json(400, { statusCode: "404", error: "not_found" });
      return route.fulfill({
        status: 200,
        headers: { ...cors, "content-type": file.type },
        body: file.body,
      });
    }
    return json(404, { message: "Unknown fake endpoint" });
  });
}

// A tone generator replaces the microphone so MediaRecorder captures audio.
export async function useFakeMicrophone(context) {
  await context.addInitScript(() => {
    window.__micStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (constraints) => {
        if (!constraints?.audio || constraints.video)
          return original(constraints);
        const audio = new AudioContext();
        await audio.resume();
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        gain.gain.value = 0.2;
        const output = audio.createMediaStreamDestination();
        tone.connect(gain).connect(output);
        tone.start();
        window.__micStreams.push(output.stream);
        return output.stream;
      },
    });
  });
}
