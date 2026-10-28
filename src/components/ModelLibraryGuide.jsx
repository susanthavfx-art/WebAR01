import React from "react";
import { Box, Braces, Check, ExternalLink, FolderUp } from "lucide-react";
import { catalogue, catalogueRepositoryUrl } from "../lib/model-library";
const entry = `{
  "id": "lion-01",
  "name": "Lion",
  "category": "Animals",
  "file": "lion.glb",
  "height": 1.5,
  "rotation": [0, 0, 0],
  "animate": true
}`;
export default function ModelLibraryGuide() {
  return (
    <>
      <span className="models-guide-icon">
        <Box size={28} />
        <span>+</span>
      </span>
      <span className="eyebrow">YOUR LIBRARY, YOUR LITTLE WORLDS</span>
      <h2>Add your own models.</h2>
      <p className="models-guide-intro">
        Upload a GLB to your GitHub repository, then list it in the catalogue.
        No JavaScript edits. No account or upload server inside Wonderlab.
      </p>
      <div className="catalogue-summary">
        <Check size={15} />
        <span>
          {catalogue.count} hosted {catalogue.count === 1 ? "model" : "models"}{" "}
          + 12 original demo objects
        </span>
      </div>
      {catalogue.warnings.length > 0 && (
        <div className="catalogue-warnings" role="status">
          <strong>The catalogue needs a little attention</strong>
          {catalogue.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}
      <ol className="models-guide-steps">
        <li>
          <span className="models-step-number">1</span>
          <div>
            <h3>
              <FolderUp size={16} /> Put your file in the model folder
            </h3>
            <p>
              In GitHub, open <code>public/models/</code> →{" "}
              <b>Add file → Upload files</b>. Upload <code>lion.glb</code>. Keep
              textures embedded in the GLB.
            </p>
            <small>
              The app loads <code>models/lion.glb</code> on the published
              website; never include <code>public/</code> in the catalogue
              filename.
            </small>
          </div>
        </li>
        <li>
          <span className="models-step-number">2</span>
          <div>
            <h3>
              <Braces size={16} /> Add one catalogue entry
            </h3>
            <p>
              Edit <code>public/models/catalog.json</code>. Add this object
              inside the existing <code>models</code> array, with a comma
              between entries.
            </p>
            <pre>{entry}</pre>
            <small>
              Use a unique, permanent <code>id</code>. Match the filename and
              capital letters exactly. A new category appears automatically.
            </small>
          </div>
        </li>
        <li>
          <span className="models-step-number">3</span>
          <div>
            <h3>
              <Check size={16} /> Commit, wait, create
            </h3>
            <p>
              Commit both changes to <code>main</code>. Wait for the Pages
              workflow to turn green, refresh Wonderlab, then find “Lion” in the
              library.
            </p>
            <small>
              Use Publish &amp; share again after changing a scene. The model
              file must stay on the website for phone links to keep working.
            </small>
          </div>
        </li>
      </ol>
      {catalogue.repository && (
        <div className="models-guide-links">
          <a
            className="button secondary"
            href={catalogueRepositoryUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Model folder <ExternalLink size={14} />
          </a>
          <a
            className="button primary"
            href={catalogueRepositoryUrl("catalog")}
            target="_blank"
            rel="noopener noreferrer"
          >
            Edit catalogue <ExternalLink size={14} />
          </a>
        </div>
      )}
      <p className="small-note">
        Optional: <code>thumbnail</code> (PNG/JPEG/WebP inside the same folder),{" "}
        <code>background</code> (hex colour), <code>credit</code>. Height is in
        scene units, rotation is [X, Y, Z] in degrees. The first embedded
        animation plays in Preview/AR and while the editor is playing. See{" "}
        <b>ADD-MODELS.md</b> in the repository for the full guide.
      </p>
    </>
  );
}
