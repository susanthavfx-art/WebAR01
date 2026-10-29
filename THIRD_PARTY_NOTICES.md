# Third-party notices and demo asset provenance

## Bundled tracking runtime

The browser bundles in `src/vendor/` are from **MindAR 1.2.5** by hiukim and contributors, originally distributed at https://github.com/hiukim/mind-ar-js and via the `mind-ar` npm package. The upstream MIT licence is included as `src/vendor/LICENSE.mind-ar`.

Bundled TensorFlow.js code retains its Apache 2.0 licence comments. Other embedded third-party notices in the distributed bundles are retained. See the upstream project and dependency source for their complete licence materials.

Three small local browser-only adaptations are made to the distributed bundles:

1. Save the bound resize handler as `_boundResize` so the viewer can remove it on exit.
2. Forward errors from the asynchronous AR setup into the outer promise rather than leaving it unresolved.
3. Replace the unreachable Node-only `node-fetch` fallback reference with the browser's global fetch to avoid Vite scanning an unneeded server dependency.

The viewer supplies its own camera-start wrapper to preserve permission errors, handle cancellation and stop pending streams safely. It cleans up rendering and tracking on exit. These changes do not replace the marker detector with simulated tracking.

## Fonts

- DM Sans — Google Fonts, SIL Open Font License 1.1. See `public/fonts/dm-sans-OFL.txt`.
- Plus Jakarta Sans — Google Fonts, SIL Open Font License 1.1. See `public/fonts/jakarta-OFL.txt`.
- Noto Sans Sinhala — The Noto Project Authors, SIL Open Font License 1.1. The Sinhala 400 subset is from `@fontsource/noto-sans-sinhala` 5.3.0; see `public/fonts/noto-sans-sinhala-OFL.txt`.

Fonts are self-hosted. No Google Fonts request occurs at app runtime.

## Other application dependencies

React, React DOM, Three.js, Lucide React, LZ-String, node-qrcode, jsPDF, fflate, @msgpack/msgpack, Vite and its React plugin are installed through npm. Their licences remain in their npm packages and are recorded in `package-lock.json`. jsPDF's optional internal HTML-related dependencies are bundled by the package, but this app generates PDFs with explicit drawing, image and text APIs, not untrusted HTML.

Playwright, Sharp and Prettier are development tools. They are not used for tracking on the user's phone.

## Original demo assets

- The twelve demo 3D models are built procedurally in `src/lib/assets.js` for this prototype; they are not downloaded from Assemblr or a third-party model catalogue.
- `public/markers/space-explorer.jpg` and `forest-friends.jpg` are AI-generated original demo illustrations created for this app. They are not photographs or reproductions of Assemblr content. Usage is subject to applicable image-generation/platform terms.
- Optimised runtime JPEGs are in `public/markers/`. Their `.mind` files were compiled from those exact runtime JPEGs using MindAR's browser compiler.
- Wonderlab's interface and logo in this prototype are newly created for this task.

No affiliation with Assemblr is claimed. Production branding and content licensing should be reviewed before commercial release.

## GLB model support update

- `public/models/wonder-bot.glb` is an original model made for Wonderlab, generated from mesh primitives by `scripts/create-sample-model.mjs`. It contains one original looping arm animation and no downloaded model or texture.
- The four tiny models under `tests/fixtures/` are original generated boxes/a skinned stem for compression, embedded-texture and animation tests. They are not a user content catalogue. `scripts/create-test-models.mjs` rebuilds them. The generator uses the pinned Three-distributed Draco encoder and downloads a pinned Meshopt encoder module for development only; neither encoder is requested by the application at runtime.
- `public/vendor/draco/` contains the unmodified glTF decoder files copied from `three@0.160.1`'s `examples/jsm/libs/draco/gltf/` distribution. Draco is by Google and contributors, under the Apache License 2.0 and included upstream third-party notices; see `public/vendor/draco/LICENSE.draco.txt`. The Three.js distribution licence is retained as `LICENSE.three.txt`. Draco's upstream project is https://github.com/google/draco.
- GLTFLoader, DRACOLoader and SkeletonUtils come from the pinned Three.js npm package. The Meshopt decoder is imported from Three's `examples/jsm/libs/meshopt_decoder.module.js`, whose upstream licence comments are retained in the bundled distribution. Meshoptimizer is by Arseny Kapoulkine and contributors, under the MIT licence.
- User-added GLBs, textures and thumbnails are not licensed by the application. The repository owner must have publication rights and retain any required attribution/licence materials. Catalogue `credit` is metadata, not a licence grant or automatic compliance review.

## Imported catalogue assets

`public/models/jw_alive_blue.glb`, `public/models/stegasaurus.glb` and `public/markers/Stegosaurus.*` came from the repository owner’s AR-Web-App reference project. Their independent licensing has not been verified; the owner should confirm permission and attribution before publishing them.
