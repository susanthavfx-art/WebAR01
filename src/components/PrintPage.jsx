import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Download, LoaderCircle, Printer } from "lucide-react";
import { Logo } from "./UI";
import { LinkError, LoadingLesson, useLocationProject } from "./Viewer";
import { shareUrl } from "../lib/projects";
import { getMarker } from "../lib/assets";
import { markerPdf } from "../lib/pdf";
export default function PrintPage() {
  const result = useLocationProject();
  if (!result) return <LoadingLesson />;
  return result.error ? (
    <LinkError message={result.error} />
  ) : (
    <Sheet project={result.project} lesson={result.lesson} />
  );
}
function Sheet({ project, lesson }) {
  const marker = getMarker(project.markerId),
    [qr, setQr] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    QRCode.toDataURL(shareUrl(project, "view", lesson), {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "L",
    })
      .then(setQr)
      .catch(() =>
        setError(
          "The QR could not be generated. Try a scene with fewer objects.",
        ),
      );
  }, []);
  async function download() {
    setBusy(true);
    try {
      await markerPdf(project, true, lesson);
    } catch {
      setError(
        "The PDF could not be created. You can use the Print button instead.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="print-page">
      <div className="print-controls">
        <a
          className="button text-button"
          href={shareUrl(project, "view", lesson)}
        >
          <ArrowLeft size={16} />
          Back to viewer
        </a>
        <p>Print in colour · A4 · 100% scale</p>
        <button className="button secondary" disabled={busy} onClick={download}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Download size={16} />
          )}
          Download PDF
        </button>
        <button
          className="button primary"
          disabled={!qr}
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Print sheet
        </button>
      </div>
      {error && (
        <p className="print-error" role="alert">
          {error}
        </p>
      )}
      <article className="print-sheet">
        <div className="print-sheet-header">
          <Logo />
          <span>YOUR IMAGINATION, IN AR</span>
        </div>
        <h1>{project.title}</h1>
        <div className="print-target">
          <img
            src={marker.image}
            alt={`${marker.name} tracking image. Do not crop.`}
          />
        </div>
        <p className="print-target-caption">
          TRACKING IMAGE / {marker.name.toUpperCase()} / DO NOT CROP
        </p>
        <div className="print-sheet-guide">
          {qr && <img src={qr} alt="QR code to open this AR scene" />}
          <div>
            <h2>A little paper. A whole new world.</h2>
            <ol>
              <li>Scan the QR code with your phone to open this creation.</li>
              <li>
                Tap <strong>Start AR camera</strong> and allow camera access.
              </li>
              <li>Point your camera at the tracking image above.</li>
            </ol>
          </div>
        </div>
        <footer>
          Keep the image flat, well lit and fully visible.
          <span>Your camera feed stays on your device.</span>
        </footer>
      </article>
    </main>
  );
}
