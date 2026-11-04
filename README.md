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
9. **Supabase Auto-Save** — Every click of Publish also creates a **brand new folder in Supabase Storage** (`ar-published/published/<new-publication-id>/`) and uploads the whole bundle there, so the QR keeps working without uploading anything to GitHub. Old publications keep their own folder; nothing is overwritten.

## Ikman Guide (Singlish)

**A. Ready-made shapes walin AR scene ekak (GLB oni na)**

1. **Shapes** tab ekata gihin shape ekak (uda: `Tree`, `Rocket`, `Robot`) click karanna. Eka scene ekata add wenawa — drag, resize, colour, animation okkoma karanna puluwan.
2. Thawa shapes click karala ekama marker eke podi "world" ekak hadanna.
3. **Markers** tab ekata gihin card eka select karala **marker image** ekak saha **`.mind` file** ekak upload karanna. File name eka monotama one na — select karala thiyena card ekata attach wenawa.
4. **Publish & share** → **Publish to Supabase & Get QR**. Supabase eke aluth folder ekak hedila files okkoma save wenawa. QR eka scan kalahama AR camera ekata gihin oyage scene eka pennanawa.

**B. Oyageම GLB models ekka**

1. **Objects tab** ekata gihin **Upload GLB models** click karala oyage `.glb` models upload karanna (uda: `stegosaurus.glb`, `velociraptor.glb`).
2. Model ekak click karala select karaganna. **Lesson tab** ekata gihin e model ekata adala **Text, Audio, Video, Image, Link** boxes saha pointer lines wena wenama add karanna.
3. **Markers tab** ekata gihin model eke namama thiyena **marker images** (`stegosaurus.jpg`) saha **`.mind` files** (`stegosaurus.mind`) upload karanna. Same name thiyena files auto match wenawa.
4. **Publish & share** click karala **Publish to Supabase & Get QR** obanna. Eken aluth **Supabase folder ekak** (`ar-published/published/<aluth-id>/`) hedila okkoma models, markers saha `.mind` file ekathu wenawa. GitHub ekata mokuth upload karanna one na.
5. Optional: **ZIP** button eken download karana file eke `public` folder eka GitHub ekata upload karoth, Supabase nagena welawaka backup ekak widiyata weda karanawa.
6. Eka **Single QR code** eka scan kalahama kelinma **AR camera** ekata gihin okkoma markers walata adala models saha wistara pennanawa. (QR eka oyage website URL ekata point wenawa; models Supabase eken load wenawa.)

## Supabase Storage (auto folder per publish)

Publishing writes to the `ar-published` bucket of the WonderLab Supabase project.

| Item           | Value                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| Project URL    | `https://zptfctcsjauobncvenne.supabase.co`                                        |
| Bucket         | `ar-published` (public read, 50 MB per file)                                      |
| Folder pattern | `published/<publication-id>/manifest.json` + `published/<publication-id>/files/*` |
| Index table    | `public.publications` (one row per publish)                                       |

Policies created for this bucket:

- **INSERT** for `anon` — only inside `published/…`, so the browser can publish.
- No `UPDATE`/`DELETE` for `anon`, so a visitor can never overwrite or wipe an
  existing publication.
- Public read through `/storage/v1/object/public/…` (needed for the QR viewer).

`manifest.json` inside Supabase carries a `storage` block with the bucket base
URL, so the viewer resolves every `published/…` asset against Storage instead of
the website. Older manifests without that block keep loading from GitHub Pages.

The defaults live in `src/lib/supabase.js` and can be overridden at build time
with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_BUCKET`,
or at runtime from **Publish & share → Supabase settings** (stored in the
browser). The anon/publishable key is safe in the browser; RLS policies are what
protect the data.

To recreate the bucket on another project:

```sql
insert into storage.buckets (id, name, public, file_size_limit)
values ('ar-published', 'ar-published', true, 52428800)
on conflict (id) do update set public = true;

create policy "Anyone can publish an AR bundle"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'ar-published' and (storage.foldername(name))[1] = 'published');
```

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
