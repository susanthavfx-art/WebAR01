import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  Printer,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { BRAND_MARK, BRAND_NAME, Modal } from "./UI";
import { getMarker } from "../lib/assets";
import { shareUrl } from "../lib/projects";
import { projectHasLocalFiles } from "../lib/local-files";
import { markerPdf } from "../lib/pdf";
import { cloudEnabled, publishLesson, useTeacherSession } from "../lib/cloud";

export default function ShareModal({
  project,
  screenshot,
  onClose,
  notify,
  printFirst = false,
  onUseInMini,
}) {
  const localFiles = projectHasLocalFiles(project);
  const [qr, setQr] = useState(""),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState(printFirst && !localFiles ? "print" : "share"),
    [qrError, setQrError] = useState(false);
  const teacher = useTeacherSession(),
    [lesson, setLesson] = useState(""),
    [publishing, setPublishing] = useState(() => cloudEnabled() && !!teacher),
    [publishError, setPublishError] = useState("");
  useEffect(() => {
    if (localFiles || !cloudEnabled() || !teacher) {
      setPublishing(false);
      return;
    }
    let active = true;
    setPublishing(true);
    publishLesson(project)
      .then((key) => active && setLesson(key))
      .catch((e) => active && setPublishError(e.message))
      .finally(() => active && setPublishing(false));
    return () => {
      active = false;
    };
  }, [project, teacher?.user.id]);
  const link = useMemo(
      () => (publishing || localFiles ? "" : shareUrl(project, "view", lesson)),
      [project, lesson, publishing, localFiles],
    ),
    marker = getMarker(project.markerId);
  useEffect(() => {
    setQr("");
    setQrError(false);
    if (!link) return;
    QRCode.toDataURL(link, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: "L",
      color: { dark: "#312841", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQrError(true));
  }, [link]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const i = document.getElementById("share-link");
      i.focus();
      i.select();
      notify("Select and copy the link from the field.");
    }
  }
  async function download() {
    setBusy(true);
    try {
      await markerPdf(project, true, lesson);
      notify("Your marker sheet is ready. Print it in colour at 100%.");
    } catch {
      notify("The PDF could not be created. Try Print sheet instead.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={onClose}
      className="share-modal"
      label="Publish and share your AR creation"
    >
      <div className="modal-heading">
        <span className="eyebrow">
          <Sparkles size={14} /> FROM YOUR SCREEN TO YOUR WORLD
        </span>
        <h2>
          A little imagination.
          <br />A whole new dimension.
        </h2>
        <p>Your creation is ready for its real-world adventure.</p>
      </div>
      <div className="dialog-tabs">
        <button
          className={tab === "share" ? "active" : ""}
          onClick={() => setTab("share")}
        >
          <QrCode size={16} />
          Share & explore
        </button>
        <button
          className={tab === "print" ? "active" : ""}
          disabled={localFiles}
          onClick={() => setTab("print")}
        >
          <Printer size={16} />
          Print your marker
        </button>
      </div>
      {tab === "share" ? (
        <div className="share-grid">
          <div className="share-preview">
            <div className="share-preview-scene">
              {screenshot ? (
                <img src={screenshot} alt="Your 3D creation" />
              ) : (
                <img src={marker.image} alt="Selected tracking marker" />
              )}
              <span className="preview-badge">
                <span /> READY TO EXPLORE
              </span>
            </div>
            <div className="share-project-title">
              <h3>{project.title}</h3>
              <p>
                {project.objects.length}{" "}
                {project.objects.length === 1 ? "object" : "objects"}
                {project.cards?.length
                  ? ` · ${project.cards.length} lesson ${project.cards.length === 1 ? "box" : "boxes"}`
                  : ""}{" "}
                · {marker.name}
              </p>
            </div>
            <div className="snapshot-note">
              <ShieldCheck size={17} />
              <span>
                {lesson
                  ? "Published online as a snapshot. After editing, publish again to share your changes."
                  : "This link shares a snapshot. After editing, make a new link to share your changes."}
              </span>
            </div>
          </div>
          <div className="share-actions">
            {localFiles && (
              <div className="publish-note error" role="alert">
                <p>
                  This scene contains files saved only on this device. Move a
                  copy to a mini project and export it before sharing with
                  another phone.
                </p>
                {onUseInMini && (
                  <button
                    className="button secondary full"
                    onClick={onUseInMini}
                  >
                    Continue in a mini project <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            )}
            {publishError && (
              <p className="publish-note error" role="alert">
                Online publishing failed: {publishError} The full scene link
                below still works.
              </p>
            )}
            {!lesson && !publishing && !publishError && cloudEnabled() && (
              <p className="publish-note">
                Sign in as a teacher to publish a short, easy-to-scan lesson
                link.
              </p>
            )}
            <div className="qr-block">
              {publishing ? (
                <p className="publishing" role="status">
                  <LoaderCircle className="spin" size={22} />
                  Publishing your lesson…
                </p>
              ) : qr ? (
                <img
                  src={qr}
                  alt="QR code to open your AR creation on a phone"
                />
              ) : localFiles ? (
                <p>Export your mini project to make a shareable QR.</p>
              ) : qrError ? (
                <p>
                  Your scene is too detailed for a QR code. The share link below
                  still works.
                </p>
              ) : (
                <LoaderCircle className="spin" size={25} />
              )}
              <h3>Meet your world on your phone</h3>
              <p>
                Scan the QR, then point your camera
                <br />
                at your printed marker.
              </p>
            </div>
            <label className="field-label" htmlFor="share-link">
              OR SHARE YOUR CREATION LINK
            </label>
            <div className="copy-field">
              <input
                id="share-link"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
              />
              <button
                aria-label="Copy share link"
                title="Copy share link"
                onClick={copy}
                disabled={!link}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
              </button>
            </div>
            <a
              href={link || undefined}
              aria-disabled={!link}
              target="_blank"
              rel="noreferrer"
              className="button primary full"
            >
              <Smartphone size={17} />
              Open AR viewer
              <ArrowUpRight size={17} />
            </a>
            <button
              className="button secondary full"
              onClick={() => setTab("print")}
              disabled={localFiles}
            >
              <Printer size={16} />
              Get my printable marker
            </button>
          </div>
        </div>
      ) : (
        <div className="print-dialog-grid">
          <div className="mini-sheet">
            <div className="mini-sheet-brand">
              <img src={BRAND_MARK} alt="" />
              {BRAND_NAME}
            </div>
            <strong>{project.title}</strong>
            <img
              className="sheet-marker"
              src={marker.image}
              alt={`${marker.name} tracking image`}
            />
            <div className="mini-sheet-bottom">
              {qr && <img src={qr} alt="Project QR code" />}
              <span>
                1. Scan the QR
                <br />
                2. Allow the camera
                <br />
                3. Bring your marker to life
              </span>
            </div>
          </div>
          <div className="print-instructions">
            <span className="step-pill">THE MAGIC STARTS ON PAPER</span>
            <h3>
              Print. Point.
              <br />
              Pretty wonderful.
            </h3>
            <p>
              Your A4 sheet includes the tracking image and a QR code that opens{" "}
              <strong>this creation</strong>.
            </p>
            <ul>
              <li>Print in colour, at 100% scale.</li>
              <li>Keep your paper flat and well lit.</li>
              <li>Show the whole image to the camera.</li>
            </ul>
            <button
              className="button primary full"
              disabled={busy || publishing}
              onClick={download}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Download size={17} />
              )}{" "}
              {busy ? "Creating your PDF…" : "Download marker PDF"}
            </button>
            <a
              className="button secondary full"
              href={link ? shareUrl(project, "print", lesson) : undefined}
              target="_blank"
              rel="noreferrer"
            >
              <Printer size={16} />
              Open print sheet
              <ExternalLink size={14} />
            </a>
            <p className="small-note">
              The QR opens the viewer. The illustrated image anchors your 3D
              objects.
            </p>
          </div>
        </div>
      )}
      <div className="dialog-footnote">
        <ShieldCheck size={14} />
        No app installation. No camera uploads. Just a little wonder.
        <span>
          {lesson
            ? "Lesson published online"
            : "Demo · Scene data is included in the link"}
        </span>
      </div>
    </Modal>
  );
}
