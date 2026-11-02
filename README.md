# WonderLab Studio — Single-QR Multi-Model WebAR Creator

A focused **Create** workspace for building multi-marker WebAR experiences where **all models share one single QR code**.

## Features

1. **Create Page Only** — Focused WonderLab Create studio without extra project/template dashboards.
2. **Shapes Tab (Ready-Made 3D Objects)** — 20 built-in 3D objects (Cube, Sphere, Tree, Flower, Mushroom, Cactus, Planet, Rocket, UFO, Moon, Robot, Heart, Gift, Snowman, Star…) generated live with Three.js. Tap one to drop it on the marker — **no `.glb` upload and no modelling tool needed**. Stack several shapes to build a whole little world on one marker.
3. **Empty AR Cards** — "Start an empty AR card" creates a scene without any model, so a project can be built entirely from shapes.
4. **Objects Tab (`.glb` Upload)** — Upload one or multiple `.glb` 3D models. Click any model to open and edit its own scene. Uploaded GLBs and ready-made shapes can live in the same scene.
5. **Lesson Tab (Per-Model Annotations)** — Add **Text**, **Audio** (record voice or upload audio), **Video**, **Image**, and **Link** boxes with dashed pointer lines to parts of each 3D scene. Every card keeps its own separate Lesson boxes and scene transforms.
6. **Markers Tab (Marker Image & `.mind` Upload)** — Upload marker images (`.jpg`, `.png`, `.webp`) and compiled MindAR `.mind` files.
7. **Automatic Same-Name Matching** — Upload files with the same base filename in any order (for example `stegosaurus.glb`, `stegosaurus.jpg`, `stegosaurus.mind`) and they link together automatically. For shape-only cards you can simply **select the card and upload any marker + `.mind` file** — the active card picks them up by itself.
8. **Publish & Share — Single QR Code** — Combines all `.mind` targets into one shared tracker and generates **one single QR code** + printable marker/QR PDF + publish ZIP. Scanning that single QR opens the AR camera directly and shows each scene (shapes, models, Lesson boxes and animations) on its matching marker.
9. **Portal Workshop (`#page=portal`)** — Build a glowing **AR doorway** on any marker. The doorway opens into a whole painted world that sits *below* the card, with a 3D resident standing inside, rising sparkles, four frame styles and five worlds. Live 3D preview in the browser, then the same doorway in the camera on a phone — and you can keep changing it while the portal is open.

## Ikman Guide (Singlish)

**A. Ready-made shapes walin AR scene ekak (GLB oni na)**

1. **Shapes** tab ekata gihin shape ekak (uda: `Tree`, `Rocket`, `Robot`) click karanna. Eka scene ekata add wenawa — drag, resize, colour, animation okkoma karanna puluwan.
2. Thawa shapes click karala ekama marker eke podi "world" ekak hadanna.
3. **Markers** tab ekata gihin card eka select karala **marker image** ekak saha **`.mind` file** ekak upload karanna. File name eka monotama one na — select karala thiyena card ekata attach wenawa.
4. **Publish & share** → **Generate Single QR & Download ZIP**. ZIP eke thiyena `public` folder eka GitHub repo root ekata upload karala **Commit changes** obanna. QR eka scan kalahama AR camera ekata gihin oyage scene eka pennanawa.

**B. Oyageම GLB models ekka**

1. **Objects tab** ekata gihin **Upload GLB models** click karala oyage `.glb` models upload karanna (uda: `stegosaurus.glb`, `velociraptor.glb`).
2. Model ekak click karala select karaganna. **Lesson tab** ekata gihin e model ekata adala **Text, Audio, Video, Image, Link** boxes saha pointer lines wena wenama add karanna.
3. **Markers tab** ekata gihin model eke namama thiyena **marker images** (`stegosaurus.jpg`) saha **`.mind` files** (`stegosaurus.mind`) upload karanna. Same name thiyena files auto match wenawa.
4. **Publish & share** click karala **Generate Single QR & Download ZIP** obanna.
5. Download una ZIP file eka Extract (Unzip) karala, eke thiyena **`public`** folder eka GitHub repository root ekata upload karala **Commit changes** obanna.
6. GitHub Pages deploy unata passe, eka **Single QR code** eka scan kalahama kelinma **AR camera** ekata gihin okkoma markers walata adala models saha wistara pennanawa!


## AR Portal Workshop (`#page=portal`)

An **AR doorway**: a frame lying on your printed marker with a painted world sunk
into the card behind it, a little 3D resident standing inside the doorway and
sparkles drifting up out of it. Everything is **drawn by the app itself**, so
apart from the marker picture there is nothing to upload or model.

Open it from the **Portal** button in the studio header, or go straight to:

```
https://<your-site>/WebAR01/#page=portal
```

### How it works

1. **Marker** — upload the picture you want to print (`.jpg`, `.png`, `.webp`).
   The workshop grades it (resolution, contrast, detail) and tells you what to
   improve before you print. If you already published a set from the studio,
   paste that **Publish & share QR link** instead: the marker image *and* its
   compiled `.mind` tracker are imported together.
2. **Tracker** — the `.mind` file compiled for that marker. It arrives with an
   imported published set, or you can upload one directly. Multi-target files
   let you choose which target belongs to this marker.
3. **Make it yours** — frame style (Sunken runes, Crystal gate, Jungle arch,
   Neon ring), the world behind the frame (Aurora valley, Hidden jungle, Deep
   space, Sunset dunes, Cloud candy), doorway width/height, how deep the world
   sinks, light strength, a resident (Crystal, Planet, Tree, Rocket, Robot, UFO,
   Flower) and rising sparkles.
4. **Open portal in AR** — on a phone the camera starts, tracks the printed
   marker and drops the doorway onto it. The sliders and swatches stay available
   while the camera runs, so you can tune the portal without restarting.
5. **Copy portal link** — the address bar already holds every setting
   (`#page=portal&m=…&tg=…&s=…&w=…`), so the link can be shared, put behind a QR
   code or opened on another phone.

The published-set viewer also has a **Make a portal on this marker** button that
carries the marker, tracker and target index straight into the workshop.

### Notes

- Camera AR needs **HTTPS** (or `localhost`) and Chrome/Safari on a phone.
- Marker and tracker picked from a published set are normal web URLs, so they
  work on any device. Files uploaded from your computer stay in this browser's
  storage (`local:` references) — perfect for testing, but share links only
  open them on the same device.
- Print on matte paper, keep the frame of the artwork visible and avoid glossy
  laminates: tracking follows the printed picture's detail.
- The camera session runs on MindAR (`src/vendor/mindar-image-three.prod.js`);
  the doorway itself is built in `src/lib/portal-scene.js` and painted in
  `src/lib/portal-paint.js`, which is why the preview and the camera always look
  identical.

## Portal Guide (Singlish)

1. Studio header eke **Portal** button eka click karanna (nathnam `#page=portal` link eka open karanna).
2. **Your marker** eke **Upload image** eken oyage card/box photo eka danna. Kalin publish karala thiyenawa nam, e QR link eka **Already published a marker…** eke paste karala **Import** karanna — marker image ekai `.mind` tracker ekai dekama enawa.
3. **Tracker** eke `.mind` file eka thiyenawada balanna (import ekak idala nam automatic). Nathnam **Upload .mind file** eken danna.
4. **Make it yours** eken frame style, world eka, size, depth, light saha inside eke 3D shape eka thoranna. Live preview eken drag karala hariyata balanna puluwan.
5. **Copy portal link** eken link eka copy karala phone eken open karanna, nathnam **Open portal in AR** eken e device ekenma camera eka open karanna.
6. Marker eka print karala (matte paper hondai) phone eken camera eka eka digata balanna — portal eka card eke Idiren penenawa. AR eke thiyena **sliders** eken camera eka run wenakota poddak adjust karanna puluwan.

## Local Development & Build

```bash
npm ci
npm run dev
```

Production build (for GitHub Pages subfolder `/WebAR01/`):

```bash
VITE_BASE_PATH=/WebAR01/ npm run build
```

Built static output is generated in `site/` and deployed automatically by `.github/workflows/static.yml`.
