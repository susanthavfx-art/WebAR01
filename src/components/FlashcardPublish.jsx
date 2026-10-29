import React, { useEffect, useState } from "react";
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  LoaderCircle,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "./UI";
import { defaultPublicBase, normalisePublicBase } from "../lib/mini-projects";
import { flashcardProblems } from "../lib/flashcards";
import { downloadBlob } from "../lib/projects";

export default function FlashcardPublish({
  mini,
  projects,
  onClose,
  onPublish,
}) {
  const [base, setBase] = useState(defaultPublicBase);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const problems = flashcardProblems(mini, projects);
  useEffect(() => {
    setResult(null);
  }, [base]);
  async function publish() {
    setError("");
    try {
      normalisePublicBase(base);
      setProgress("Preparing the shared tracker…");
      const publication = await onPublish(base, setProgress);
      setResult(publication);
    } catch (failure) {
      setError(failure.message || "Could not create the publication.");
    } finally {
      setProgress("");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(result.qrList[0].link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Select and copy the link below instead.");
    }
  }
  return (
    <Modal
      label="Publish flashcard set"
      onClose={onClose}
      className="flash-publish-modal"
    >
      <div className="flash-publish-heading">
        <div className="flash-publish-icon">
          <QrCode size={23} />
        </div>
        <div>
          <span className="eyebrow">ONE QR FOR YOUR ENTIRE SET</span>
          <h2>Publish your flashcards</h2>
          <p>
            One shared camera recognizes any marker in this set, one card at a
            time.
          </p>
        </div>
      </div>
      <label className="field-label" htmlFor="flash-public-base">
        YOUR DEPLOYED STUDIO URL
      </label>
      <input
        id="flash-public-base"
        aria-label="Deployed studio URL"
        className="text-input"
        value={base}
        onChange={(event) => setBase(event.target.value)}
        placeholder="https://yourname.github.io/your-repository/"
        disabled={!!progress}
      />
      <p className="flash-publish-help">
        Use the HTTPS address where this updated studio is deployed, including
        its repository name.
      </p>
      {problems.length > 0 && (
        <div className="flash-issues" role="status">
          <strong>Finish these items before publishing</strong>
          <ul>
            {problems.slice(0, 5).map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
          {problems.length > 5 && (
            <small>
              And {problems.length - 5} more. Select each card to check its
              files.
            </small>
          )}
        </div>
      )}
      {error && (
        <div className="flash-publish-error" role="alert">
          {error}
        </div>
      )}
      {!result ? (
        <button
          className="button primary full flash-generate"
          disabled={!!progress || problems.length > 0}
          onClick={publish}
        >
          {progress ? (
            <>
              <LoaderCircle size={18} className="spin" /> {progress}
            </>
          ) : (
            <>
              <QrCode size={18} /> Generate one QR &amp; download ZIP
            </>
          )}
        </button>
      ) : (
        <div className="flash-qr-result">
          <img
            src={result.qrList[0].data}
            alt="Shared QR for the whole flashcard set"
          />
          <div>
            <span className="flash-result-badge">
              <Check size={13} /> ZIP DOWNLOADED
            </span>
            <strong>Your shared QR is ready</strong>
            <p>It will work after the publication folder has been deployed.</p>
            <input
              aria-label="Shared QR link"
              className="text-input"
              value={result.qrList[0].link}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <div className="flash-result-actions">
              <button onClick={copy}>
                <Clipboard size={14} /> {copied ? "Copied" : "Copy link"}
              </button>
              <button
                onClick={() => downloadBlob(result.blob, result.filename)}
              >
                <Download size={14} /> Download ZIP again
              </button>
              <a href={result.qrList[0].link} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Open link
              </a>
            </div>
          </div>
        </div>
      )}
      <div className="flash-deploy-steps">
        <strong>Make the QR work on another device</strong>
        <ol>
          <li>
            Unzip the download and copy its <code>public/published/…</code>{" "}
            folder into the same location in your studio repository.
          </li>
          <li>
            Commit the files and wait for GitHub Pages to finish deploying. For
            files over 25 MB, use Git or GitHub Desktop rather than GitHub's
            browser uploader.
          </li>
          <li>
            Open the QR on a phone over HTTPS, allow camera access, and point at
            the printed marker image.
          </li>
        </ol>
        <p>
          <ShieldCheck size={14} /> Some browsers may ask you to tap “Start AR
          camera”. Publishing is a public snapshot; edits need a new ZIP and QR.
        </p>
      </div>
    </Modal>
  );
}
