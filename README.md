# Dino Discovery — 4-marker MindAR starter

A mobile-first image-tracking AR web app using MindAR, A-Frame/Three.js, HTML, CSS and JavaScript.

## Marker-to-model mapping

All four marker images are in `assets/`. The order below is significant because it becomes MindAR target indexes 0–3:

| targetIndex | Marker image | GLB model |
|---:|---|---|
| 0 | `assets/marker.jpg` | `assets/model.glb` |
| 1 | `assets/marker1.jpg` | `assets/model1.glb` |
| 2 | `assets/marker2.jpg` | `assets/model2.glb` |
| 3 | `assets/marker3.jpg` | `assets/model3.glb` |

The marker images are included. Add the matching GLB files using the names above; until then the app displays a 3D placeholder for each target.

## Create the MindAR target file

1. Serve the app over HTTPS or localhost. For local development, run `python3 -m http.server 8000` from this folder and open `http://localhost:8000`.
2. Tap **Setup & model instructions → Compile all 4 markers**.
3. The app compiles all four images in the listed order and downloads one file: `targets.mind`.
4. Put/upload that one file as `assets/targets.mind`. If using GitHub Pages, upload it to the repository's `assets` folder and commit.

Do not compile four separate `.mind` files for this version. The four target images are bundled together into one `targets.mind`.

## Add the 3D models

Place the models here:

- `assets/model.glb`
- `assets/model1.glb`
- `assets/model2.glb`
- `assets/model3.glb`

Each GLB is attached to its matching marker. A-Frame Extras plays embedded animation clips in a repeat loop. If a model is static, make sure animation/keyframes were exported into the GLB. Model scale is set in `index.html` in the `createAnchor` function (`scale="0.35 0.35 0.35"`).

## GitHub Pages

1. Upload the contents of this project folder into the root of your GitHub repository (so `index.html` is at the root and marker images are under `assets/`).
2. Open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
3. Open the published HTTPS URL. Compile the markers there, then upload the downloaded `targets.mind` into `assets/` and commit it.
4. Upload the GLB model files to `assets/` and commit them.

The camera starts after the user taps **Start AR camera**, as browsers require a user gesture and camera permission. An internet connection is needed for the CDN libraries.
