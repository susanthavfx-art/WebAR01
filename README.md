# WonderLab Flashcard Studio

A focused Create workspace for making a set of AR flashcards: match your existing GLB models, marker images and compiled MindAR files by filename, edit each card's scene, and publish **one QR for the whole set**. One camera recognizes the cards one at a time. The earlier individual/event-card tools and already-published viewer links are retained separately.

## Quick guide / Ikman guide

1. Open the studio. **Create** is the main workspace; the model library is for the current flashcard set.
2. Upload your files in any order using **Upload GLB models**, **Upload marker images** and **Upload .mind files**. Each button can take several files. Give the three files belonging to a card the same basename, for example `lion.glb`, `lion.jpg` and `lion.mind`. Upper/lowercase and the file extension do not matter; spaces and punctuation in the basename do. The matching name stays fixed even if you rename the card in the editor.
3. Select a card in the library. Move, rotate or scale its model, edit its object properties and play buttons, and use **Lesson boxes** to add text, audio, video, images or links. Each card has its **own** scene and boxes; switching cards does not replace another card's edits. Built-in objects can also be added to a selected scene.
4. Each `.mind` file normally contains one target, so index `0` is selected automatically. If it contains multiple targets, **choose the matching source index explicitly** using its original compile order. The app cannot verify that an image visually matches its target. Identical target descriptors are rejected because they cannot reliably distinguish two cards.
5. Click **Preview set** to test the set in this browser/device. The app combines one chosen target per card into one shared tracker; it does not recompile the marker images. Your original `.mind` files remain unchanged.
6. Click **Publish one QR**, check the deployed studio URL, and generate the publication ZIP. Follow the deployment steps below **before** scanning the QR on another phone. The QR opens one shared camera; point the camera at a printed **marker image**, not at the QR itself. Camera permission and HTTPS are required; some browsers may require an additional tap to start the camera.

**One task at a time:** use **New set** when starting a different flashcard set. Earlier shared sets stay saved on this device and can be selected from **Current set** in the bottom bar. Existing shared mini-project sets are opened without altering their combined tracker or target indices. When adding a card to an older combined tracker, explicitly select its existing index, or provide matching individual `.mind` files for the entire set to rebuild the tracker. Previously created individual/event-card projects remain available in the separate legacy interface at the studio URL plus `?legacy=1`; the original single-scene editor remains available at `?studio=1`.

## Publish so another phone can scan

Drafts and uploads are initially stored **only in this browser on this device**. The app does not upload them to a server. A local preview link cannot be used on another phone.

1. Deploy the **updated studio** to a stable HTTPS address. For example, the user's GitHub Pages site is `https://susanthavfx-art.github.io/FlashCards_WebAR_Creator/` when that repository contains this updated version. In the repository's **Settings → Pages**, select **GitHub Actions**. The included workflow builds the app with the correct repository subfolder.
2. Under **Publish one QR**, enter that exact deployed studio URL, including the repository name. The temporary Arena preview address is not a permanent publishing address.
3. Generate the ZIP. Unzip it and copy the entire `public/published/<publication-id>/` folder into the **same path** in your studio source repository. The ZIP itself is not the published folder. On a different static host, put the folder beneath the deployed app's `published/` directory.
4. Commit/push the folder and wait for GitHub Pages to finish deploying. Then scan the one QR on the phone, allow camera access and point at any printed marker from the set. The ZIP contains `qr/one-qr-for-the-set.png` and `printable-marker-sheets.pdf`, with a QR cover sheet and one marker page per card.

GitHub's browser uploader has a **25 MB per-file limit**. Use Git or GitHub Desktop for larger files where GitHub's repository limits permit; regular GitHub repositories block individual files over **100 MiB**. The app's upload limits do not override host limits. Large trackers and models also make phone downloads slower; optimize them where possible.

Each publication is a new **public snapshot** with a new folder and QR. Later edits do not update an earlier publication. Anyone with the link can access its files. Keep the studio and the published folder online. The ZIP is not an editable draft backup/import.

## Local data and limits

- Metadata is in browser localStorage; uploaded binaries are in IndexedDB. Clearing site data, private browsing, or storage/quota errors can remove or prevent local saves. Keep original GLB, marker and `.mind` files separately. A removed card leaves its saved scene and binary files on this device; clearing site data removes all local drafts and uploads.
- A flashcard set supports up to **50 cards**. The `.mind` reader accepts up to 100 source targets; the generated tracker contains one selected target per card and must be at most 100 MB. The viewer tracks one marker at a time. Performance depends on the target complexity, lighting, file sizes and phone.
- Models: self-contained **GLB 2.0**, up to 40 MB each, with embedded textures and buffers. Draco and Meshopt are supported; external textures and KTX2 are not. Marker and image-box images: JPG/PNG/WebP up to 20 MB. Each `.mind` file: up to 100 MB. A publication's uploaded files are limited to 250 MB total.
- Local audio (up to 20 MB), video (up to 50 MB), play-button sounds and image boxes are included in publication ZIPs. The optional teacher cloud integration remains available when configured; no cloud project is required for local authoring or static publication.
- Use detailed, flat, well-lit, unaltered printed markers. Check the actual phones, browser permissions, tracking accuracy, downloads and reacquisition before production use.

## Running and deploying

Requires Node.js 20.19+ or Node 22.

```bash
npm ci
npm run dev
```

The development server binds to `0.0.0.0:5173` and accepts Arena preview hosts. For a production build under a GitHub Pages project subfolder, replace the example with the actual repository name:

```bash
VITE_BASE_PATH=/FlashCards_WebAR_Creator/ npm run build
APP_BASE_PATH=/FlashCards_WebAR_Creator/ node scripts/serve-pages.mjs
```

`site/` is the built output. The included workflow detects the Pages base path and deploys that output rather than unbuilt source. The old Jurassic Kingdom page remains at `jurassic.html`; its pre-existing missing optional models/markers are not added here.

For tests, install Playwright's Chromium and operating-system dependencies, start the dev server and run `npm test`. `tests/flashcards.spec.mjs` covers batch filename matching, independent scene persistence, multi-target selection, duplicate targets, preservation of older sets, the publication ZIP and two different real marker descriptors in a simulated camera. The legacy tests also cover individual/event-card QR routes and a synthetic 25-entry tracker with one marker at index 24. Synthetic camera tests are not a substitute for testing the intended printed cards on real iPhone/Android devices.

## Source

The original 3D editor and viewer build on `susanthavfx-art/AR-Web-App` (reference commit `be0255076ed6627de5517d10fb3e1e915a84a199`). The focused workspace is in `src/components/FlashcardStudio.jsx`, `FlashcardLibrary.jsx` and `FlashcardPublish.jsx`; filename matching and tracker preparation live in `src/lib/flashcards.js` and `src/lib/local-files.js`. Existing mini-project and collection viewer code is preserved. See `THIRD_PARTY_NOTICES.md` for bundled dependencies and licences.
