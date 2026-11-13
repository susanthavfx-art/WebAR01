import * as THREE from "three";
import { resolveResourceUrl, safeResourceReference } from "./local-files";

export function validateVideo(value) {
  const url = safeResourceReference(value?.url);
  if (!url) return null;
  const aspect = Number(value?.aspect);
  return {
    url,
    aspect: Number.isFinite(aspect) ? Math.max(0.1, Math.min(8, aspect)) : 1,
  };
}

export function createVideoObject(data) {
  const group = new THREE.Group();
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(data.aspect, 1),
    material,
  );
  mesh.position.y = 0.5;
  group.add(mesh);
  group.userData.video = video;
  group.userData.videoTexture = texture;
  const url = resolveResourceUrl(data.url);
  group.userData.ready = new Promise((resolve) => {
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener("loadeddata", loaded);
      video.removeEventListener("error", failed);
      if (error && !group.userData.disposed) group.userData.loadError = error;
      resolve(group);
    };
    const loaded = () => finish();
    const failed = () =>
      finish("This WebM could not be played by the browser.");
    const timer = setTimeout(() => finish("Video loading timed out."), 15000);
    group.userData.cancelVideoLoad = () => finish();
    if (!url) {
      finish("Video file is missing. Please upload it again.");
      return;
    }
    video.addEventListener("loadeddata", loaded);
    video.addEventListener("error", failed);
    video.src = url;
    video
      .play()
      .catch(() =>
        finish("Video playback was blocked or is unsupported in this browser."),
      );
  });
  return group;
}

// Check that the selected browser can at least decode the uploaded video.
export function inspectWebM(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const timer = setTimeout(
      () => finish(new Error("Could not read the WebM video.")),
      15000,
    );
    function finish(error) {
      clearTimeout(timer);
      video.onloadedmetadata = video.onerror = null;
      const aspect = video.videoWidth / video.videoHeight;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (error || !Number.isFinite(aspect) || !aspect)
        reject(error || new Error("The WebM has no video track."));
      else resolve(Math.max(0.1, Math.min(8, aspect)));
    }
    video.onloadedmetadata = () => finish();
    video.onerror = () =>
      finish(
        new Error(
          "This WebM cannot be decoded by your browser. Try VP8 or VP9.",
        ),
      );
    video.preload = "metadata";
    video.src = url;
  });
}
