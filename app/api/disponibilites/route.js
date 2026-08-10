import { NextResponse } from "next/server";
import { getReglage } from "@/lib/creneaux";
import { creneauxParRessources, fenetresLivraison } from "@/lib/disponibilites";

export const dynamic = "force-dynamic";

// GET /api/disponibilites?service=…&mois=AAAA-MM[&commune=…&typeTrajet=…&duree=…]
//
// Renvoie, pour chaque jour du mois, s'il reste au moins une place. C'est ce
// qui permet au calendrier d'afficher en gras les jours réellement ouvrables
// et de griser les autres — au lieu de laisser l'utilisateur découvrir en
// tâtonnant qu'aucun créneau n'existe.
//
// Les jours sont calculés par le MÊME moteur que les créneaux d'un jour :
// aucune règle de disponibilité n'est réécrite ici, sans quoi le calendrier
// finirait par promettre des jours que la réservation refuserait.

// Le calcul interroge la base une fois par jour de l'horizon : sans cache,
// chaque ouverture du calendrier en déclencherait une trentaine. Une minute
// suffit à absorber la navigation entre les mois sans jamais présenter une
// disponibilité périmée.
const CACHE = new Map();
const DUREE_CACHE = 60 * 1000;

function duCache(cle) {
  const e = CACHE.get(cle);
  if (!e) return null;
  if (Date.now() - e.instant > DUREE_CACHE) {
    CACHE.delete(cle);
    return null;
  }
  return e.valeur;
}

function auCache(cle, valeur) {
  // Bornage grossier : ce cache ne doit pas devenir une fuite de mémoire.
  if (CACHE.size > 200) CACHE.clear();
  CACHE.set(cle, { instant: Date.now(), valeur });
  return valeur;
}

const jourIso = (d) => d.toISOString().slice(0, 10);

export async function GET(req) {
  try {
    const p = new URL(req.url).searchParams;
    const service = p.get("service");
    const mois = p.get("mois"); // AAAA-MM

    if (!service || !/^\d{4}-\d{2}$/.test(mois || "")) {
      return NextResponse.json({ erreur: "paramètres invalides" }, { status: 400 });
    }

    const commune = (p.get("commune") || "").slice(0, 80);
    const typeTrajet = p.get("typeTrajet") || undefined;
    const duree = Math.min(Math.max(parseInt(p.get("duree"), 10) || 60, 15), 480);

    const cle = [service, mois, commune, typeTrajet || "", duree].join("|");
    const memo = duCache(cle);
    if (memo) return NextResponse.json(memo);

    const reglage = await getReglage();
    const horizon = Math.max(1, reglage.joursHorizon || 14);

    const [annee, m] = mois.split("-").map(Number);
    const nbJours = new Date(annee, m, 0).getDate();

    // Bornes : aujourd'hui (pas de réservation dans le passé) et l'horizon
    // d'ouverture des réservations.
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const fin = new Date(aujourdhui);
    fin.setDate(fin.getDate() + horizon);

    const jours = [];
    for (let j = 1; j <= nbJours; j++) {
      const date = new Date(annee, m - 1, j);
      date.setHours(0, 0, 0, 0);
      const iso = jourIso(date);

      // Hors fenêtre d'ouverture : inutile d'interroger la base.
      if (date < aujourdhui || date > fin) {
        jours.push({ date: iso, dispo: false, horsHorizon: true });
        continue;
      }

      if (service === "medicaments") {
        const fenetres = await fenetresLivraison(iso);
        jours.push({ date: iso, dispo: (fenetres || []).some((f) => f.restant > 0) });
      } else {
        const { creneaux } = await creneauxParRessources(service, iso, { duree, commune, typeTrajet });
        jours.push({ date: iso, dispo: (creneaux || []).some((c) => c.dispo) });
      }
    }

    const reponse = { mois, horizon, jours };
    return NextResponse.json(auCache(cle, reponse));
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
