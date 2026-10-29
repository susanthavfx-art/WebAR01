import React, { useEffect, useState } from "react";
import {
  Camera,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "./UI";
import {
  defaultPublicBase,
  normalisePublicBase,
  workspaceProblems,
} from "../lib/workspace";
import { downloadBlob, slug } from "../lib/projects";

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

  const problems = workspaceProblems(workspace, scenes);

  useEffect(() => {
    setResult(null);
  }, [base]);

  async function handlePublish() {
    setError("");
    try {
      normalisePublicBase(base);
      setProgress("Combining .mind tracking targets…");
      const pub = await onPublish(base, setProgress);
      setResult(pub);
    } catch (err) {
      setError(err?.message || "Could not create the publish package.");
    } finally {
      setProgress("");
    }
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
            matching markers.
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
        Keep your GitHub Pages address above (including repository name) so the
        QR code points to your live HTTPS site.
      </p>

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
                <LoaderCircle size={18} className="spin" /> {progress}
              </>
            ) : (
              <>
                <QrCode size={18} /> Generate Single QR &amp; Download ZIP
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
          <img
            src={result.qrDataUrl}
            alt="Single QR code for all AR models"
          />
          <div>
            <span className="flash-result-badge">
              <Check size={13} /> ZIP DOWNLOADED ({result.cardCount}{" "}
              {result.cardCount === 1 ? "MODEL" : "MODELS"})
            </span>
            <strong>Your single QR code is ready!</strong>
            <p>
              Upload the extracted <code>public</code> folder to GitHub so
              phones can scan this QR.
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
                  downloadBlob(
                    result.qrBlob,
                    `${slug(workspace.title)}-qr.png`,
                  )
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
                <Download size={14} /> ZIP again
              </button>
              <a href={result.qrLink} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Open link
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="flash-deploy-steps">
        <strong>Phone eken QR eka scan karanna (GitHub Pages steps):</strong>
        <ol>
          <li>
            Download una ZIP file eka computer eke <strong>Extract (Unzip)</strong>{" "}
            karanna.
          </li>
          <li>
            GitHub repository root ekata gihin{" "}
            <strong>Add file → Upload files</strong> click karala, extract una{" "}
            <code>public</code> folder eka drag &amp; drop karala{" "}
            <strong>Commit changes</strong> obanna.
          </li>
          <li>
            GitHub Actions deploy eka green unata passe, eka{" "}
            <strong>Single QR code</strong> eka scan kalahama kelinma AR camera
            ekata gihin okkoma markers walata adala models pennanawa!
          </li>
        </ol>
        <p>
          <ShieldCheck size={14} /> Files over 25 MB should be pushed with Git
          or GitHub Desktop. Printable markers + QR PDF is included inside the
          ZIP.
        </p>
      </div>
    </Modal>
  );
}
