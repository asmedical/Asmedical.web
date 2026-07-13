// Compose les visuels Google Play :
//  - 6 captures téléphone au format store 1080×1920 (cadre + accroche)
//  - la bannière « feature graphic » 1024×500
// Tout est dessiné à partir des captures réelles et du logo ASM.
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BRUT = "google-play/brut";
const SORTIE = "google-play/visuels";

const ECRANS = [
  ["02-patient/patient-01-accueil.png", "01-accueil.png", "Transport, aide à domicile, médicaments"],
  ["02-patient/patient-03-connexion-rapide.png", "02-connexion.png", "Connexion simple : SMS, WhatsApp, Google, Apple"],
  ["09-reservations/patient-06-transport-medical.png", "03-reservation.png", "Réservez en 1 minute"],
  ["02-patient/patient-09-suivi-vehicule.png", "04-suivi.png", "Suivez votre chauffeur et son véhicule en direct"],
  ["02-patient/patient-05-tableau-de-bord.png", "05-rendez-vous.png", "Tous vos rendez-vous au même endroit"],
  ["07-messagerie/patient-10-messagerie.png", "06-messagerie.png", "Une équipe qui vous répond 7j/7"],
];

const b64 = (f) => fs.readFileSync(f).toString("base64");

const navigateur = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await navigateur.newPage();
fs.mkdirSync(SORTIE, { recursive: true });
await page.setContent(`<div id="zone"></div>`);

// ---- Captures 1080×1920 ----
for (const [source, cible, accroche] of ECRANS) {
  const img = b64(path.join(BRUT, source));
  const data = await page.evaluate(async ({ img, accroche }) => {
    const photo = new Image();
    photo.src = "data:image/png;base64," + img;
    await photo.decode();
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1920;
    const x = c.getContext("2d");
    // Fond dégradé charte ASM
    const g = x.createLinearGradient(0, 0, 0, 1920);
    g.addColorStop(0, "#0E6B3F"); g.addColorStop(1, "#0A5230");
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
    // Accroche
    x.fillStyle = "#FFFFFF";
    x.textAlign = "center";
    x.font = "800 52px 'Segoe UI', Arial, sans-serif";
    const mots = accroche.split(" ");
    let lignes = [""], li = 0;
    for (const m of mots) {
      if ((lignes[li] + " " + m).trim().length > 34) { lignes.push(m); li++; }
      else lignes[li] = (lignes[li] + " " + m).trim();
    }
    lignes.forEach((l, i) => x.fillText(l, 540, 110 + i * 64));
    const hTexte = 110 + lignes.length * 64;
    // Écran dans un cadre arrondi
    const hDispo = 1920 - hTexte - 60;
    const ech = Math.min(880 / photo.width, hDispo / photo.height);
    const w = photo.width * ech, h = photo.height * ech;
    const px = (1080 - w) / 2, py = hTexte + 20;
    const r = 44;
    x.save();
    x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 60; x.shadowOffsetY = 18;
    x.beginPath(); x.roundRect(px, py, w, h, r); x.fillStyle = "#fff"; x.fill();
    x.restore();
    x.save();
    x.beginPath(); x.roundRect(px, py, w, h, r); x.clip();
    x.drawImage(photo, px, py, w, h);
    x.restore();
    x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,.5)";
    x.beginPath(); x.roundRect(px, py, w, h, r); x.stroke();
    return c.toDataURL("image/png").split(",")[1];
  }, { img, accroche });
  fs.writeFileSync(path.join(SORTIE, cible), Buffer.from(data, "base64"));
  console.log("✓", cible);
}

// ---- Feature graphic 1024×500 ----
const logo = b64("public/logo-asm.jpg");
const fg = await page.evaluate(async ({ logo }) => {
  const im = new Image();
  im.src = "data:image/jpeg;base64," + logo;
  await im.decode();
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 500;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 1024, 500);
  g.addColorStop(0, "#0A5230"); g.addColorStop(1, "#0E6B3F");
  x.fillStyle = g; x.fillRect(0, 0, 1024, 500);
  // Halo doré discret
  x.fillStyle = "rgba(201,162,75,.12)";
  x.beginPath(); x.arc(900, 60, 260, 0, 7); x.fill();
  // Logo rond
  x.save();
  x.beginPath(); x.arc(190, 250, 128, 0, 7); x.fillStyle = "#fff"; x.fill();
  x.beginPath(); x.arc(190, 250, 120, 0, 7); x.clip();
  x.drawImage(im, 70, 130, 240, 240);
  x.restore();
  // Textes
  x.fillStyle = "#FFFFFF"; x.textAlign = "left";
  x.font = "800 64px 'Segoe UI', Arial, sans-serif";
  x.fillText("ASM", 370, 205);
  x.font = "700 34px 'Segoe UI', Arial, sans-serif";
  x.fillText("Assistance Sociale Médicale", 370, 258);
  x.font = "600 27px 'Segoe UI', Arial, sans-serif";
  x.fillStyle = "rgba(255,255,255,.92)";
  x.fillText("Transport sanitaire · Aide à domicile", 370, 320);
  x.fillText("Livraison de médicaments — Alger, 7j/7", 370, 360);
  return c.toDataURL("image/png").split(",")[1];
}, { logo });
fs.writeFileSync(path.join(SORTIE, "feature-graphic-1024x500.png"), Buffer.from(fg, "base64"));
console.log("✓ feature-graphic-1024x500.png");

fs.copyFileSync("public/icone-512.png", path.join(SORTIE, "icone-512.png"));
console.log("✓ icone-512.png (copiée)");
await navigateur.close();
