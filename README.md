# WonderLab Studio — Single-QR Multi-Model WebAR Creator

A focused **Create** workspace for building multi-marker WebAR experiences where **all models share one single QR code**.

## Features

1. **Create Page Only** — Focused WonderLab Create studio without extra project/template dashboards.
2. **Objects Tab (`.glb` Upload)** — Upload one or multiple `.glb` 3D models. Click any model to open and edit its own scene.
3. **Lesson Tab (Per-Model Annotations)** — Add **Text**, **Audio** (record voice or upload audio), **Video**, **Image**, and **Link** boxes with dashed pointer lines to parts of each 3D model. Every model keeps its own separate Lesson boxes and scene transforms.
4. **Markers Tab (Marker Image & `.mind` Upload)** — Upload marker images (`.jpg`, `.png`, `.webp`) and compiled MindAR `.mind` files.
5. **Automatic Same-Name Matching** — Upload files with the same base filename in any order (for example `stegosaurus.glb`, `stegosaurus.jpg`, `stegosaurus.mind`) and they link together automatically.
6. **Publish & Share — Single QR Code** — Combines all `.mind` targets into one shared tracker and generates **one single QR code** + printable marker/QR PDF + publish ZIP. Scanning that single QR opens the AR camera directly and shows each model (with its Lesson boxes and animations) on its matching marker.

## Ikman Guide (Singlish)

1. **Objects tab** ekata gihin **Upload GLB models** click karala oyage `.glb` models upload karanna (uda: `stegosaurus.glb`, `velociraptor.glb`).
2. Model ekak click karala select karaganna. **Lesson tab** ekata gihin e model ekata adala **Text, Audio, Video, Image, Link** boxes saha pointer lines wena wenama add karanna.
3. **Markers tab** ekata gihin model eke namama thiyena **marker images** (`stegosaurus.jpg`) saha **`.mind` files** (`stegosaurus.mind`) upload karanna. Same name thiyena files auto match wenawa.
4. **Publish & share** click karala **Generate Single QR & Download ZIP** obanna.
5. Download una ZIP file eka Extract (Unzip) karala, eke thiyena **`public`** folder eka GitHub repository root ekata upload karala **Commit changes** obanna.
6. GitHub Pages deploy unata passe, eka **Single QR code** eka scan kalahama kelinma **AR camera** ekata gihin okkoma markers walata adala models saha wistara pennanawa!

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
