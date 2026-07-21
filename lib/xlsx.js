// Générateur XLSX minimal — AUCUNE dépendance externe.
// Un fichier .xlsx est une archive ZIP de petits fichiers XML : on écrit
// ici une archive « stored » (sans compression, CRC32 correct) contenant
// une seule feuille. Ouvrable dans Excel, Numbers, LibreOffice, Sheets.
// Les nombres restent des nombres (sommes possibles), le reste est du texte.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function xmlEsc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // caractères de contrôle interdits en XML 1.0
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// "A", "B", … "Z", "AA", "AB"… (référence de colonne Excel)
function colonne(n) {
  let s = "";
  n += 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Feuille de calcul : lignes = tableau de tableaux (comme les CSV existants).
function feuilleXml(lignes) {
  const rows = lignes.map((ligne, i) => {
    const cells = ligne.map((v, j) => {
      const ref = `${colonne(j)}${i + 1}`;
      if (typeof v === "number" && Number.isFinite(v)) {
        return `<c r="${ref}"><v>${v}</v></c>`;
      }
      const s = v === null || v === undefined ? "" : String(v);
      if (s === "") return "";
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(s)}</t></is></c>`;
    }).join("");
    return `<row r="${i + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
}

// Archive ZIP « stored » : en-têtes locaux + répertoire central, CRC32 exacts.
function zipStore(fichiers) {
  const morceaux = [];
  const centraux = [];
  let offset = 0;
  for (const [nom, contenu] of fichiers) {
    const nomBuf = Buffer.from(nom, "utf8");
    const data = Buffer.from(contenu, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4);         // version
    local.writeUInt16LE(0x0800, 6);     // drapeau UTF-8
    local.writeUInt16LE(0, 8);          // stored (pas de compression)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nomBuf.length, 26);
    morceaux.push(local, nomBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nomBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centraux.push(Buffer.concat([central, nomBuf]));
    offset += 30 + nomBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(centralBuf.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...morceaux, centralBuf, fin]);
}

// Point d'entrée : classeurXlsx(lignes, nomFeuille) → Buffer .xlsx
export function classeurXlsx(lignes, nomFeuille = "Export ASM") {
  const feuille = xmlEsc(String(nomFeuille).slice(0, 31)) || "Export";
  return zipStore([
    ["[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${feuille}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", feuilleXml(lignes)],
  ]);
}
