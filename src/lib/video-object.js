import * as THREE from "three";
import { resolveResourceUrl, safeResourceReference } from "./local-files";

export function validateVideo(value) {
  const url = safeResourceReference(value?.url);
  if (!url) return null;
  const aspect = Number(value?.aspect);
  return {
    url,
    aspect: Number.isFinite(aspect) ? Math.max(0.1, Math.min(8, aspect)) : 1,
    ...(value?.layout === "side-by-side-alpha"
      ? { layout: "side-by-side-alpha" }
      : {}),
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
  texture.colorSpace =
    data.layout === "side-by-side-alpha"
      ? THREE.NoColorSpace
      : THREE.SRGBColorSpace;
  const material =
    data.layout === "side-by-side-alpha"
      ? new THREE.ShaderMaterial({
          uniforms: {
            videoMap: { value: texture },
            halfTexel: { value: 0.00026 },
          },
          vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `uniform sampler2D videoMap; uniform float halfTexel; varying vec2 vUv; void main() {
          float x = mix(halfTexel, 0.5 - halfTexel, vUv.x);
          vec3 colour = texture2D(videoMap, vec2(x, vUv.y)).rgb;
          float alpha = texture2D(videoMap, vec2(0.5 + x, vUv.y)).r;
          gl_FragColor = vec4(colour, alpha);
        }`,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        })
      : new THREE.MeshBasicMaterial({
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
    const loaded = () => {
      if (material.uniforms?.halfTexel && video.videoWidth)
        material.uniforms.halfTexel.value = 0.5 / video.videoWidth;
      finish();
    };
    const failed = () =>
      finish("This video could not be played by the browser.");
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
export function inspectWebM(file, packedAlpha = false) {
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
      else
        resolve(Math.max(0.1, Math.min(8, packedAlpha ? aspect / 2 : aspect)));
    }
    video.onloadedmetadata = () => finish();
    video.onerror = () =>
      finish(
        new Error(
          "This video cannot be decoded by your browser. Check its format and codec.",
        ),
      );
    video.preload = "metadata";
    video.src = url;
  });
}
