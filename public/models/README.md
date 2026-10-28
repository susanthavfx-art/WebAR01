# Owner-managed GLB model library

Upload self-contained **GLB 2.0** files here, then add entries to **catalog.json**. Future additions need no JavaScript edits. The application loads this directory as `models/` under the deployment base, not `public/models/`.

Teacher-library setup and new categories: [TEACHER-LIBRARY.md](../../TEACHER-LIBRARY.md). Full owner export instructions: [ADD-MODELS.md](../../ADD-MODELS.md).

Included: **wonder-bot.glb**, an original animated sample made for this app (327,908 bytes, one friendly-wave clip). Rebuild with `node scripts/create-sample-model.mjs` after `npm ci`.

Keep unique permanent IDs, match filename case, use embedded PNG/JPEG textures, and keep published GLB files online for existing phone links. Draco/Meshopt geometry is supported; KTX2 and external texture files are not. Provide optional PNG/JPEG/WebP thumbnails for a larger library.

Example extra catalogue object (upload your own lion.glb first):

```json
{
  "id": "lion-01",
  "name": "Lion",
  "category": "Animals",
  "file": "lion.glb",
  "height": 1.5,
  "rotation": [0, 0, 0],
  "animate": true
}
```

Put it inside the existing `models` array with a comma between entries. Commit, wait for the latest Pages workflow to succeed, then refresh the app. Teachers see only the provided library, not model-owner upload/edit instructions. A new `category` value automatically adds a tab when a valid entry uses it. Wonder Bot belongs to Science; the owner-provided `jw_alive_blue.glb` belongs to Animals. Keep both model files for existing shares.
