// Impression du dossier HTML en PDF (A4, en-tête/pied de page ASM).
import { chromium } from "playwright-core";
import path from "path";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const HTML = path.resolve("business-plan/ASM_Dossier_Fonctionnel_Complet.html");
const PDF = path.resolve("business-plan/ASM_Dossier_Fonctionnel_Complet.pdf");

const navigateur = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await navigateur.newPage();
await page.goto("file://" + HTML, { waitUntil: "networkidle" });
await page.pdf({
  path: PDF,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" },
  displayHeaderFooter: true,
  headerTemplate: `<div style="width:100%;font-size:7.5px;color:#6B7A72;padding:0 13mm;display:flex;justify-content:space-between;font-family:Arial">
    <span>ASM — Présentation fonctionnelle de la plateforme</span><span>Confidentiel</span></div>`,
  footerTemplate: `<div style="width:100%;font-size:7.5px;color:#6B7A72;padding:0 13mm;display:flex;justify-content:space-between;font-family:Arial">
    <span>Données de démonstration fictives — illustration uniquement</span>
    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await navigateur.close();
console.log("PDF généré :", PDF);
