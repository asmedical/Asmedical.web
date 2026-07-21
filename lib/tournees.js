// Optimisation des tournées chauffeurs — pur calcul, testable.
// Principe honnête (pas de routage externe) : les missions à heure fixe
// restent triées par heure ; les livraisons « fenêtre » sont rangées dans
// le créneau de leur fenêtre puis REGROUPÉES PAR COMMUNE pour éviter les
// allers-retours. L'ordre proposé reste une suggestion — le chauffeur
// garde la main.

// Heure de départ estimée d'une fenêtre de livraison (texte FR stocké).
function debutFenetre(fenetre) {
  const f = String(fenetre || "").toLowerCase();
  if (f.includes("plus tôt") || f.includes("asap")) return 7 * 60;
  // « après-midi » contient « midi » : tester le plus spécifique d'abord.
  if (f.includes("après-midi") || f.includes("soir")) return 15 * 60;
  if (f.includes("matin")) return 8 * 60;
  if (f.includes("midi")) return 12 * 60;
  return 9 * 60; // fenêtre inconnue : milieu de matinée
}

function minutesDe(iso) {
  const m = /T(\d{2}):(\d{2})/.exec(String(iso || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function normCommune(c) {
  return String(c || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Ordonne les missions D'UNE JOURNÉE : heure fixe d'abord (chronologie
// stricte — un rendez-vous ne se déplace pas), puis, à créneau égal
// (livraisons d'une même fenêtre), regroupement par commune.
export function ordonnerTournee(missions) {
  return [...(missions || [])].sort((a, b) => {
    const ha = minutesDe(a.date) ?? debutFenetre(a.fenetre);
    const hb = minutesDe(b.date) ?? debutFenetre(b.fenetre);
    if (ha !== hb) return ha - hb;
    // Même créneau : mêmes communes côte à côte, ordre alphabétique stable.
    const ca = normCommune(a.commune);
    const cb = normCommune(b.commune);
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (a.id || 0) - (b.id || 0);
  });
}

// Étapes de la tournée avec rupture de commune : chaque fois que la
// commune change, l'étape porte `nouvelleCommune` (affichage groupé).
export function etapesTournee(missions) {
  const ordre = ordonnerTournee(missions);
  let derniere = null;
  return ordre.map((m) => {
    const c = normCommune(m.commune) || null;
    const nouvelle = c !== derniere;
    derniere = c;
    return { ...m, nouvelleCommune: nouvelle ? (m.commune || "Commune non précisée") : null };
  });
}

// Résumé : nombre d'étapes par commune (dans l'ordre de passage).
export function resumeTournee(missions) {
  const etapes = etapesTournee(missions);
  const resume = [];
  for (const e of etapes) {
    if (e.nouvelleCommune) resume.push({ commune: e.nouvelleCommune, etapes: 1 });
    else resume[resume.length - 1].etapes++;
  }
  return resume;
}
