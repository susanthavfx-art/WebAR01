# Elasmo AR — MindAR image-tracking starter

A small mobile-first web AR app. It tracks the included book page using MindAR and displays a GLB model at the image target using A-Frame/Three.js.

## Your files

- Marker source: `assets/marker.jpg` (already copied from the uploaded image)
- Compiled MindAR target (create once): `assets/targets.mind`
- Your 3D model: `assets/model.glb`

## Publish with GitHub Pages

1. Create a GitHub repository (Public is simplest for Pages on free accounts).
2. Unzip this project and upload the **contents** of the `elasmosaura-ar` folder into the repository root. The root should contain `index.html` and the `assets` folder (do not leave them nested inside another folder).
3. In GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Wait for GitHub Pages to publish, then open the URL shown there. It will use HTTPS, which supports camera access.
5. On your published site, choose **Setup & model instructions → Compile marker image**. The browser downloads `targets.mind`. Upload that file into the repository's `assets` folder and commit the change.
6. Reload the published site and tap **Start AR camera**. Allow camera access.

Camera access requires HTTPS or localhost and browser camera permission. A tap is necessary to start the camera because of browser permission/autoplay rules.

## One-time marker setup (local development)

1. Serve this folder using a local web server (do not open `index.html` as a `file://` URL). For example, run `python3 -m http.server 8000` from this folder and open `http://localhost:8000`.
2. Select **Setup & model instructions → Compile marker image**. This downloads `targets.mind`.
3. Copy the downloaded file to `assets/targets.mind`, then reload the page.

## Add your 3D model

Copy your web-ready `.glb` to exactly `assets/model.glb`. Refresh the app. The built-in teal creature preview is automatically hidden when the GLB loads. The model is attached to target index 0 in `index.html` under `#targetAnchor`.

For GLB animation, `index.html` loads the A-Frame Extras animation-mixer and plays all embedded animation clips in a repeat loop. The GLB must actually contain animation clips (keyframes/rig animation exported into the GLB); a static GLB cannot be animated by the web page alone. In Blender, enable animation export when exporting glTF/GLB, then verify that the exported file includes animation actions/clips.

To adjust model size, edit `scale="0.35 0.35 0.35"` on `#uploadedModel`. Adjust its position/rotation there too if needed. If your model is `.gltf`, it may need its `.bin` and texture files alongside it; GLB is recommended.

## Stack

HTML, CSS, JavaScript, MindAR image tracking and A-Frame (Three.js renderer). Libraries are loaded from CDN, so an internet connection is required.
