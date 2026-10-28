# WonderLab — Mini WebAR Studio

A focused version of the WonderLab “Bring it to life” studio for individual AR cards and flash-card sets. It includes the existing 3D scene editor, lesson boxes, marker-based MindAR viewer and two ways to create QR codes.

## Quick guide / Ikman guide

1. **New mini project** click karala project name ekak denna.
2. QR mode eka thoraganna:
   - **A QR on every card** — birthday, Christmas, Vesak wage cards walata. Hema card ekatama wenama QR ekak saha `.mind` file ekak thiyenawa.
   - **One QR for a whole set** — dinosaurs, animals, alphabet flash cards wage set ekakata. Eka QR ekakin camera eka open karala set eke ona card ekak scan karanna puluwan.
3. **Add card** use karanna, nathnam **Upload markers** walin marker images godak ekawara add karanna. Hema card ekata matching marker image saha `.glb` model eka upload karanna.
4. **.mind target eka**:
   - Individual mode eke card ekata adala `.mind` file eka upload karanna. Eka image ekak witharak thiyana `.mind` file ekaka target index eka `0`.
   - Shared mode eke okkoma markers thiyana **combined `.mind`** file eka upload karanna. Nethnam **Choose files** walin kalin hadapu wen wenama `.mind` files thorala, order eka hadala **Combine and use these files** click karanna. Aluthin markers compile karanna one na.
   - Card eke **MindAR target index** eka `.mind` file eke marker order ekata galapanna. Count eka `0` walin patan ganne: 25-card set ekakata samanyayen `0`–`24`. Combined file eka hadapu order eka wenas nam index manually wenas karanna.
5. **Edit scene & boxes** walin model eka arrange karanna, text, audio, video, link saha aluth **Image box** add karanna. Image box ekata JPG/PNG/WebP upload karanna ho direct HTTPS image link ekak denna.
Original standalone editor eka open karanna dashboard eke **Create** click karanna, nathnam studio URL ekata `?studio=1` add karanna.

6. Same device eke test karanna **Test this set on this device first** (shared) ho card eke **Preview** use karanna. Camera access requires HTTPS (or localhost on that same device).
7. **Deployed studio URL** ekata permanent website URL eka denna. **Prepare publication package** click karama ZIP, QR PNG(s) saha printable PDF hadenawa. ZIP folder eka website ekata upload/deploy kalata passe thamai QR wena phone ekakin wada karanne. Details below.

> **Important:** QR code eka camera/viewer eka open karanawa. Camera eken scan karanne **marker image** eka, QR eka nemei. `.mind` file eka compile karapu image ekama upload/print karanna; matching image ekakda kiyala app ekata confirm karanna ba.

## Publishing so another phone can scan the QR

Uploads and drafts are initially stored **only in this browser on this device**. The application does not silently upload them to a server. A QR pointing to local browser data would not work on someone else's phone, so each export makes a portable public snapshot.

1. Deploy this studio to a stable HTTPS address. For this repository's GitHub Pages site the address will normally be `https://susanthavfx-art.github.io/WebAR01/` **after** the updated application has actually been deployed. In repository **Settings → Pages**, select **GitHub Actions** as the source. The included workflow builds and deploys when changes reach `main`, or can be run manually.
2. Enter that exact studio address under **Deployed studio URL**, then prepare the publication package.
3. Unzip it. Copy the whole `public/published/<publication-id>/` folder into the **same path** in this repository. Do not put the ZIP itself in the repository. On a different static host, copy that folder's contents to `published/<publication-id>/` underneath the deployed studio's public root.
4. Deploy the site again and wait for the build to finish. Only then scan the QR on a different phone. Print `printable-marker-sheets.pdf` in colour at 100%; in shared mode the PDF has one QR on the cover and one marker per card. In individual mode each card sheet has its own QR.

The ZIP also contains the individual QR PNG(s), the manifest and the files needed by the project. Keep the studio and the published folder online. GitHub's browser upload has a lower per-file limit than the app's file limits (currently 25 MB); use an appropriate Git workflow or static host for larger files. Respect GitHub's repository/file limits and avoid committing unnecessarily large models.

**Preview addresses are temporary.** Generate the final QR using the stable deployed URL, not the Arena preview URL. Publishing again creates a new snapshot, folder and QR; editing a draft does not change an older QR. Files and scenes in a published package are public to anyone with its link; there is no access control or revocation built in.

## Local data, files and limits

- Draft project metadata is saved in localStorage; uploaded binaries are saved in IndexedDB. Clearing browser/site data, private browsing or a storage quota error can remove/prevent saves. Keep your original models, markers and `.mind` files separately. The publication ZIP is **not an editable project backup/import**.
- A mini project supports up to **50 cards**, including 25-card sets. The `.mind` reader accepts up to 100 targets; only target indices assigned to cards are shown. Shared mode tracks one card at a time and loads a card's model when that marker is found. Real phone performance depends on target complexity, device and file sizes.
- Models: self-contained **GLB 2.0**, up to 40 MB each; embed textures and buffers. Draco and Meshopt are supported; external textures and KTX2 are not. Markers and image boxes: JPG/PNG/WebP up to 20 MB each. `.mind`: up to 100 MB. A publication's uploaded files are limited to 250 MB in total; smaller assets are strongly recommended for mobile.
- Local audio (up to 20 MB), video (up to 50 MB), model play-button sounds and image boxes are included in mini-project exports. The existing optional teacher cloud integration still works when configured, but no cloud project is required for local authoring or static exports.
- Deleting a card or project removes its draft and scenes, not necessarily the underlying local binary files; clearing site data removes all drafts and files. There is no automatic cloud backup.
- Use well-lit, flat, detailed, unaltered markers. A separate `.mind` file can contain several targets; set each card's index accordingly. If two shared cards have the same index, or an index exceeds the target count, export is blocked.

## Running and deploying

Requires Node.js 20.19+ or Node 22.

```bash
npm ci
npm run dev
```

The development server binds to `0.0.0.0:5173` and accepts Arena preview hosts. Open the provided preview URL. For a production build under the GitHub Pages project subfolder:

```bash
VITE_BASE_PATH=/WebAR01/ npm run build
APP_BASE_PATH=/WebAR01/ node scripts/serve-pages.mjs
```

`site/` is the built output. The workflow obtains the Pages base path automatically and deploys that output; it does not deploy the unbuilt source. The old Jurassic Kingdom page from this repository is preserved at `jurassic.html` with its original assets; its pre-existing missing optional models/markers are not added by this update.

For tests, run `npx playwright install chromium`, start the dev server, and execute `npm test` (some operating systems also need Playwright’s system dependencies). `tests/mini-projects.spec.mjs` covers 25-card setup, target index 24 in a 25-entry synthetic target file, both QR modes, file persistence, multi-target `.mind` combination and real MindAR tracking against synthetic camera images, as well as published image/video/audio boxes. The 25-entry tracking fixture repeats one marker and uses a second distinct marker at index 24; it does not test 25 different printed images. Synthetic tests do not replace physical iPhone/Android tests: check camera permissions, printed marker quality, lighting, reacquisition, file sizes and performance on the intended phones.

## Source

The 3D editor and viewer build on the user's `susanthavfx-art/AR-Web-App` studio (reference commit `be0255076ed6627de5517d10fb3e1e915a84a199`); the mini-project workflow, local uploads, publication packaging and multi-target viewer live in `src/components/MiniProjects.jsx`, `src/components/CollectionViewer.jsx`, `src/lib/mini-projects.js` and `src/lib/local-files.js`. See `THIRD_PARTY_NOTICES.md` for bundled dependencies and licences.
