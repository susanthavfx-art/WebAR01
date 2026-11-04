import React, { useEffect, useState } from "react";
import {
  Camera,
  Check,
  Clipboard,
  CloudUpload,
  Download,
  ExternalLink,
  FileText,
  FolderCheck,
  Image as ImageIcon,
  LoaderCircle,
  QrCode,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "./UI";
import {
  defaultPublicBase,
  normalisePublicBase,
  workspaceProblems,
} from "../lib/workspace";
import { downloadBlob, slug } from "../lib/projects";
import {
  SUPABASE_DEFAULTS,
  isSupabaseConfigured,
  loadSupabaseSettings,
  normaliseProjectUrl,
  resetSupabaseSettings,
  saveSupabaseSettings,
} from "../lib/supabase";

export default function PublishModal({
  workspace,
  scenes,
  onClose,
  onPublish,
  onTestCamera,
}) {
  const [base, setBase] = useState(defaultPublicBase);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cloud, setCloud] = useState(() => loadSupabaseSettings());
  const [cloudDraft, setCloudDraft] = useState(() => loadSupabaseSettings());
  const [cloudEditing, setCloudEditing] = useState(
    () => !isSupabaseConfigured(loadSupabaseSettings()),
  );
  const [cloudNotice, setCloudNotice] = useState("");

  const problems = workspaceProblems(workspace, scenes);
  const cloudReady = isSupabaseConfigured(cloud);
  const cloudFolder = result?.cloud?.folder || "";

  useEffect(() => {
    setResult(null);
  }, [base, cloud]);

  async function handlePublish() {
    setError("");
    setCloudNotice("");
    try {
      normalisePublicBase(base);
      normaliseProjectUrl(cloud.url);
      setProgress("Combining .mind tracking targets…");
      const pub = await onPublish(base, setProgress, {
        settings: cloud,
        uploadToCloud: cloud.enabled,
        downloadZip: !cloudReady,
      });
      setResult(pub);
      if (pub.cloudError) setCloudEditing(true);
    } catch (err) {
      setError(err?.message || "Could not create the publish package.");
    } finally {
      setProgress("");
    }
  }

  function saveCloudSettings() {
    try {
      const saved = saveSupabaseSettings({
        ...cloudDraft,
        enabled: true,
      });
      setCloud(saved);
      setCloudDraft(saved);
      setCloudNotice(
        `Connected to ${saved.bucket}. The next publish creates a new folder there.`,
      );
      setError("");
      setCloudEditing(false);
    } catch (err) {
      setError(err?.message || "Could not save the Supabase settings.");
    }
  }

  function useDefaultCloud() {
    const defaults = resetSupabaseSettings();
    setCloud(defaults);
    setCloudDraft(defaults);
    setCloudEditing(false);
    setCloudNotice("");
    setError("");
  }

  async function copyLink() {
    if (!result?.qrLink) return;
    try {
      await navigator.clipboard.writeText(result.qrLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Select and copy the QR link below.");
    }
  }

  async function copyFolder() {
    if (!cloudFolder) return;
    try {
      await navigator.clipboard.writeText(cloudFolder);
      setCloudNotice("Supabase folder path copied.");
    } catch {
      setCloudNotice(cloudFolder);
    }
  }

  return (
    <Modal
      label="Publish and share single QR code"
      onClose={onClose}
      className="flash-publish-modal"
    >
      <div className="flash-publish-heading">
        <div className="flash-publish-icon">
          <QrCode size={23} />
        </div>
        <div>
          <span className="eyebrow">SINGLE QR · ALL MODELS IN ONE CAMERA</span>
          <h2>Publish &amp; share</h2>
          <p>
            One QR code opens the AR camera directly and shows all{" "}
            <strong>{workspace.entries.length || ""}</strong>{" "}
            {workspace.entries.length === 1 ? "model" : "models"} on their
            matching markers. Every publish is saved into a new Supabase folder.
          </p>
        </div>
      </div>

      <label className="field-label" htmlFor="deploy-public-base">
        YOUR GITHUB PAGES / WEBSITE URL
      </label>
      <input
        id="deploy-public-base"
        aria-label="Deployed website URL"
        className="text-input"
        value={base}
        onChange={(e) => setBase(e.target.value)}
        placeholder="https://susanthavfx-art.github.io/WebAR01/"
        disabled={!!progress}
      />
      <p className="flash-publish-help">
        The QR code points at this site. The AR models and markers themselves
        are loaded from your Supabase folder, so nothing has to be uploaded to
        GitHub again.
      </p>

      <div className={`flash-cloud ${cloudReady ? "is-ready" : "is-off"}`}>
        <div className="flash-cloud-head">
          <span className="flash-cloud-icon">
            {cloudReady ? <CloudUpload size={17} /> : <ShieldCheck size={17} />}
          </span>
          <div>
            <strong>
              {cloudReady
                ? `Saves to Supabase · ${cloud.bucket}`
                : "Supabase is not connected"}
            </strong>
            <p>
              {cloudReady ? (
                <>
                  Publish creates a brand new folder{" "}
                  <code>published/&lt;new-id&gt;/</code> and uploads the whole
                  AR bundle there.
                </>
              ) : (
                <>
                  Add your Supabase project URL and anon key once — the publish
                  button will then save every bundle into a new bucket folder.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className="flash-cloud-toggle"
            onClick={() => setCloudEditing((value) => !value)}
            disabled={!!progress}
          >
            <Settings2 size={13} />
            {cloudEditing ? "Hide" : "Change"}
          </button>
        </div>

        {cloudEditing && (
          <div className="flash-cloud-form">
            <label htmlFor="supabase-url">SUPABASE PROJECT URL</label>
            <input
              id="supabase-url"
              className="text-input"
              value={cloudDraft.url}
              onChange={(e) =>
                setCloudDraft({ ...cloudDraft, url: e.target.value })
              }
              placeholder={SUPABASE_DEFAULTS.url}
              disabled={!!progress}
            />
            <label htmlFor="supabase-key">ANON / PUBLISHABLE KEY</label>
            <input
              id="supabase-key"
              className="text-input"
              value={cloudDraft.anonKey}
              onChange={(e) =>
                setCloudDraft({ ...cloudDraft, anonKey: e.target.value })
              }
              placeholder="eyJhbGciOiJIUzI1NiIs…"
              spellCheck={false}
              disabled={!!progress}
            />
            <label htmlFor="supabase-bucket">STORAGE BUCKET</label>
            <input
              id="supabase-bucket"
              className="text-input"
              value={cloudDraft.bucket}
              onChange={(e) =>
                setCloudDraft({ ...cloudDraft, bucket: e.target.value })
              }
              placeholder={SUPABASE_DEFAULTS.bucket}
              disabled={!!progress}
            />
            <div className="flash-cloud-actions">
              <button
                type="button"
                className="button primary"
                onClick={saveCloudSettings}
                disabled={!!progress}
              >
                <Check size={14} /> Save Supabase settings
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={useDefaultCloud}
                disabled={!!progress}
              >
                Use WonderLab project
              </button>
            </div>
            <p className="flash-cloud-note">
              The anon key is safe in the browser because Supabase protects the
              bucket with policies. Uploads are only allowed inside{" "}
              <code>published/</code>; deleting or overwriting files needs a
              logged-in owner.
            </p>
          </div>
        )}

        {cloudNotice && !cloudEditing && (
          <p className="flash-cloud-status" role="status">
            <Check size={13} /> {cloudNotice}
          </p>
        )}
      </div>

      {problems.length > 0 && (
        <div className="flash-issues" role="status">
          <strong>Complete these items before publishing:</strong>
          <ul>
            {problems.slice(0, 6).map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
          {problems.length > 6 && (
            <small>And {problems.length - 6} more items.</small>
          )}
        </div>
      )}

      {error && (
        <div className="flash-publish-error" role="alert">
          {error}
        </div>
      )}

      {!result ? (
        <div className="publish-cta-stack">
          <button
            className="button primary full flash-generate"
            disabled={!!progress || problems.length > 0}
            onClick={handlePublish}
          >
            {progress ? (
              <>
                <LoaderCircle size={18} className="spin" />{" "}
                <span className="flash-generate-progress">{progress}</span>
              </>
            ) : (
              <>
                <CloudUpload size={18} /> Publish to Supabase &amp; Get QR
              </>
            )}
          </button>
          {problems.length === 0 && onTestCamera && (
            <button
              type="button"
              className="button secondary full"
              disabled={!!progress}
              onClick={onTestCamera}
            >
              <Camera size={16} /> Test AR Camera on This Device First
            </button>
          )}
        </div>
      ) : (
        <div className="flash-qr-result">
          <img src={result.qrDataUrl} alt="Single QR code for all AR models" />
          <div>
            <span className="flash-result-badge">
              <Check size={13} />{" "}
              {result.cloud ? "SAVED TO SUPABASE" : "ZIP DOWNLOADED"} (
              {result.cardCount} {result.cardCount === 1 ? "MODEL" : "MODELS"})
            </span>
            <strong>
              {result.cloud
                ? "Your AR bundle is live in Supabase!"
                : "Your single QR code is ready!"}
            </strong>
            <p>
              {result.cloud ? (
                <>
                  New folder <code>{result.cloud.folder}</code> — scan the QR
                  and the camera loads the models straight from Supabase.
                </>
              ) : (
                <>
                  Upload the extracted <code>public</code> folder to GitHub, or
                  connect Supabase above so publishing saves itself.
                </>
              )}
            </p>
            <input
              aria-label="Single QR link"
              className="text-input"
              value={result.qrLink}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <div className="flash-result-actions">
              <button type="button" onClick={copyLink}>
                <Clipboard size={14} /> {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(result.qrBlob, `${slug(workspace.title)}-qr.png`)
                }
              >
                <ImageIcon size={14} /> QR PNG
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    result.pdfBlob,
                    `${slug(workspace.title)}-markers-and-qr.pdf`,
                  )
                }
              >
                <FileText size={14} /> Printable PDF
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(result.zipBlob, result.filename)}
              >
                <Download size={14} /> ZIP
              </button>
              <a href={result.qrLink} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Open link
              </a>
            </div>
          </div>
        </div>
      )}

      {result?.cloud && (
        <div className="flash-cloud-saved" role="status">
          <div className="flash-cloud-saved-head">
            <FolderCheck size={16} />
            <span>
              Saved {result.cloud.fileCount}{" "}
              {result.cloud.fileCount === 1 ? "file" : "files"} ·{" "}
              {(result.cloud.sizeBytes / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>
          <code>{result.cloud.folder}</code>
          <div className="flash-cloud-saved-actions">
            <button type="button" onClick={copyFolder}>
              <Clipboard size={13} /> Copy folder path
            </button>
            <a
              href={result.cloud.dashboardUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} /> Open in Supabase
            </a>
          </div>
        </div>
      )}

      {result?.cloudError && (
        <div className="flash-publish-error" role="alert">
          <strong>Supabase save failed.</strong> {result.cloudError}
          <br />
          Your ZIP and QR are ready — download the ZIP and upload the{" "}
          <code>public</code> folder to GitHub, or fix the Supabase settings and
          publish again.
        </div>
      )}

      {result?.cloudSkipped && !result?.cloud && (
        <div className="flash-issues" role="status">
          <strong>Saved to a ZIP only.</strong> Connect Supabase above to have
          the next publish create its own folder automatically.
        </div>
      )}

      <div className="flash-deploy-steps">
        <strong>
          {result?.cloud
            ? "Phone eken QR eka scan karanna:"
            : "Phone eken QR eka scan karanna (GitHub Pages steps):"}
        </strong>
        {result?.cloud ? (
          <ol>
            <li>
              QR code eka <strong>scan</strong> karanna — camera eka open wela
              model eka marker eka mata pennanawa.
            </li>
            <li>
              Supabase eke <code>{result.cloud.bucket}</code> bucket eke aluth
              folder eka <code>{result.cloud.folder}</code> — files okkoma
              ekathu wela thiyenawa.
            </li>
            <li>
              Aluth publish ekak karaddi{" "}
              <strong>thawa aluth folder ekak</strong> hedila, paran folder eka
              venama thiyenawa (delete wen na).
            </li>
          </ol>
        ) : (
          <ol>
            <li>
              Download una ZIP file eka computer eke{" "}
              <strong>Extract (Unzip)</strong> karanna.
            </li>
            <li>
              GitHub repository root ekata gihin{" "}
              <strong>Add file → Upload files</strong> click karala, extract una{" "}
              <code>public</code> folder eka drag &amp; drop karala{" "}
              <strong>Commit changes</strong> obanna.
            </li>
            <li>
              GitHub Actions deploy eka green unata passe, eka{" "}
              <strong>Single QR code</strong> eka scan kalahama kelinma AR
              camera ekata gihin okkoma markers walata adala models pennanawa!
            </li>
          </ol>
        )}
        <p>
          <ShieldCheck size={14} /> Uploads go straight to Supabase Storage (max
          50 MB per file). The ZIP + printable markers stay available as a
          backup.
        </p>
      </div>
    </Modal>
  );
}
