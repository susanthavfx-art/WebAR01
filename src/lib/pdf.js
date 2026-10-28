import QRCode from "qrcode";
import { getMarker } from "./assets";
import { shareUrl, slug } from "./projects";
import { publicUrl } from "./deployment";
async function dataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Logo missing");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export async function markerPdf(project, save = true, lesson = "") {
  const { jsPDF } = await import("jspdf");
  const marker = getMarker(project.markerId),
    url = shareUrl(project, "view", lesson);
  const qr = await QRCode.toDataURL(url, {
    width: 700,
    margin: 2,
    errorCorrectionLevel: "L",
    color: { dark: "#282338", light: "#ffffff" },
  });
  const blob = await (await fetch(marker.image)).blob();
  const image = await new Promise((res, rej) => {
    const f = new FileReader();
    f.onload = () => res(f.result);
    f.onerror = rej;
    f.readAsDataURL(blob);
  });
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const mark = await dataUrl(publicUrl("brand/wonderlab-mark-256.png")).catch(
    () => "",
  );
  if (mark) pdf.addImage(mark, "PNG", 17, 14.5, 12, 12);
  pdf.setTextColor("#292437");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text("WonderLab Studio", mark ? 32 : 18, 23.2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor("#827b92");
  pdf.text("YOUR IMAGINATION, IN AR", 192, 22.5, { align: "right" });
  const title =
    project.title.replace(/[^\x20-\x7E]/g, "").trim() || "My AR creation";
  pdf.setTextColor("#302a42");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(pdf.splitTextToSize(title, 174).slice(0, 2), 18, 41);
  pdf.setDrawColor("#e4dfee");
  pdf.setLineWidth(0.3);
  pdf.roundedRect(22, 56, 166, 166, 2, 2, "S");
  pdf.addImage(image, "JPEG", 25, 59, 160, 160);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor("#827b92");
  pdf.text(
    `TRACKING IMAGE  /  ${marker.name.toUpperCase()}  /  DO NOT CROP`,
    105,
    228,
    { align: "center" },
  );
  pdf.addImage(qr, "PNG", 20, 237, 37, 37);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor("#302a42");
  pdf.text("A little paper. A whole new world.", 64, 244);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor("#655e75");
  pdf.text(
    [
      "1. Scan the QR code with your phone to open this creation.",
      "2. Tap Start AR camera and allow camera access.",
      "3. Point your camera at the tracking image above.",
    ],
    64,
    252,
    { lineHeightFactor: 1.7 },
  );
  pdf.setDrawColor("#e4dfee");
  pdf.line(18, 282, 192, 282);
  pdf.setFontSize(8);
  pdf.setTextColor("#827b92");
  pdf.text(
    "Print in colour at 100%. Keep the image flat, well lit and fully visible.",
    18,
    288,
  );
  pdf.text("Camera stays on your device.", 192, 288, { align: "right" });
  if (save) pdf.save(`${slug(project.title)}-ar-marker.pdf`);
  return pdf;
}
