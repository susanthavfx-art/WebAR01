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

## QR visitor accounts (setup required)

The visitor flow is implemented, but **disabled by default** so existing public
QRs and local camera previews do not break. The connected WonderLab Supabase
project currently has new-user signup disabled. Its signup switch is
project-wide, so it was not changed automatically. To enable the flow:

1. Apply `supabase/migrations/202611040001_visitor_profiles.sql` through
   `202611040003_consent_phone_change.sql`, in order, to your chosen Supabase
   project. These migrations have already been applied to the connected
   `wonderlab.app` project. Profiles are protected by row-level security; each
   signed-in visitor can only read/write their own profile. Opens are insert-only
   for visitors and available to the project owner in the Supabase dashboard.
2. In Supabase Authentication, enable email signups and configure working SMTP,
   rate limits and CAPTCHA/abuse controls as appropriate. **This affects all apps
   using the same project.** Configure both the confirmation/signup and magic
   link email templates to show `{{ .Token }}` as a code (not just a link), and
   test both a new and an existing user. The app uses email OTP, not WhatsApp OTP.
   No external code delivery is provided by this repository.
3. Configure the website's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at
   build time if using a different project. Account auth intentionally ignores
   the browser's editable publishing settings. A service-role key must never be
   placed in the client. For GitHub Pages, set repository variable
   `VITE_VISITOR_ACCOUNTS` to `true` and redeploy. For local builds use
   `VITE_VISITOR_ACCOUNTS=true npm run dev` or `npm run build` with the variable.
   Draft camera previews bypass the gate. To preview only the sign-in screen
   before enabling it globally, add `&visitor=1` to a published collection's
   hash URL; login still requires the backend setup above.
4. Test email delivery, account creation, saved profile, withdrawal of consent,
   sign out, RLS and an actual QR on a phone before sharing. Run
   `node --test tests/visitor-auth.test.mjs` for the mocked client flow.

Visitors 18+ provide a name, title, adult age range, relationship and WhatsApp
number; an optional child's age range does not include the child's identity.
WhatsApp marketing is **off by default**, separate from access, and can be
withdrawn under **My details**. Changing a phone number clears consent; save the
number and then opt in again if desired. The number itself is not verified. A
successful logged-in open of a published collection is recorded, but it is not a
reliable count of QR scans (offline, failed logins, and analytics errors are not
recorded; opens can repeat). Admins can inspect `webar_visitor_profiles` and
`webar_visitor_opens` in the Supabase dashboard. Only use current opted-in
profiles (`whatsapp_marketing = true`) for marketing, recheck consent before
sending, and respect opt-out requests. There is **no automated WhatsApp sending**:
a compliant WhatsApp Business provider, approved templates, recipient
verification, opt-out handling, and applicable legal/privacy review are needed
before marketing. Publish your own privacy policy, retention and deletion/contact
process before collecting real customer information.

### Future paid access / PINs

The login screen is **not a paywall**: published manifests and assets are in the
public `ar-published` bucket and can be fetched directly. Do not sell these as
restricted content yet. There is no payment integration, purchase validation,
PIN issuance, WhatsApp delivery or purchase-access enforcement in this version.
For paid flashcards, first move all paid manifests, models and tracking files to
private storage, enforce per-product entitlements server-side for every asset,
and use short-lived authorized URLs or a protected delivery service. A trusted
admin or verified payment webhook must create/revoke entitlements. If using PINs,
issue high-entropy, single-use, expiring codes, store only a hash, rate-limit
redemption, and bind redemption to an authenticated account. Use a configured
transactional delivery provider; never put PINs, service keys or entitlement
checks only in browser code. Existing public copies must be removed or replaced
before access restrictions can provide protection.

## Simple QR form → Google Sheet → AR camera

An alternative to the email account flow above is included for collecting a
visitor's name, job/role and WhatsApp number **without login**. The Google Sheet
[WonderLab AR – Visitor Responses](https://docs.google.com/spreadsheets/d/1Uaqxyh7Y5EjUj-5hjf67N79x0Mw2OraxFjlJ9TY7qvM/edit)
was created in the connected `wonderlab.app@gmail.com` account. Its Responses
header has a submission ID for retry deduplication; keep column G intact.

The sheet connector is available only during this assisted session, not to
visitors' browsers. To save future responses securely without putting Google
credentials in the site, the owner must deploy the included Google Apps Script:

1. Sign in as `wonderlab.app@gmail.com`, open the response sheet, and choose
   **Extensions → Apps Script**. Paste `integrations/google-apps-script/Code.gs`
   into `Code.gs`. Add an HTML file named **Index** and paste
   `integrations/google-apps-script/Index.html` into it. Save the project. The
   sheet ID and current GitHub Pages URL are already in `Code.gs`; change both
   if using a different sheet or site.
2. Choose **Deploy → New deployment → Web app**, execute as **Me**, and allow
   access to **Anyone** so QR visitors need no Google account. Authorize the
   requested Sheets access as the sheet owner. Copy the deployed `/exec` URL.
   The web app must be public for submitting but the **spreadsheet itself should
   remain private**. Never share Google credentials or a service-account key.
3. The GitHub Pages workflow defaults to the `/exec` URL supplied for the
   WonderLab sheet. If you deploy a different script, set the GitHub repository
   variable `VITE_VISITOR_FORM_URL` to its `/exec` URL, then deploy this website.
   For local testing, set the same environment variable when starting/building
   Vite. The form is not active on the live site until the update is deployed.
   When configured,
   this form takes precedence over the optional email account flow. Draft camera
   previews remain unchanged. Each tab asks once per publication, then permits
   refreshes in the same tab. Existing QR links (including the supplied PDF's
   `abfb8ba5-ef91-4134-915c-2b175ddf12af` link) work after deployment; the PDF
   does not need a new QR, provided the website stays at the current URL.
4. Scan a QR on a phone, submit test details and check the response row and AR
   camera. Test connection errors too: the app must not claim success when a
   save fails. Apps Script returns a continuation link only after Sheets reports
   a successful save. If automatic navigation is blocked, tap **Open AR camera**.
   Camera use still requires HTTPS and the visitor's permission.

The form asks an adult to provide their own details, with marketing opt-in
unchecked by default; record “Yes” before using a number for promotions. Provide
an accessible privacy policy, retention/deletion process and a way to withdraw
consent before use, and honor opt-outs. WhatsApp numbers are not verified and
no marketing messages are sent by this integration. A publicly accessible Apps
Script can receive spam or forged submissions; its random submission ID avoids
accidental retries, **not** abuse or fraudulent entries. Monitor quotas and
consider a backend with CAPTCHA/rate limiting before large-scale use. This form
is not a purchase check or protection for public AR assets. Do not use it as a
paywall.

For the script's mocked validation and duplicate-save tests, run
`node --test tests/sheet-visitor.test.mjs`.
