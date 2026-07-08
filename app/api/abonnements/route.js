import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifierEquipe } from "@/lib/notifier";
import { logErreur } from "@/lib/log";
import { autorise } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const JOURS_FR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

// POST /api/abonnements — demande de transport régulier (Mode B).
// Ex. dialyse : lun/mer/ven à 8h vers le centre. On crée l'abonnement
// ET une demande « à rappeler » pour que l'équipe confirme par téléphone.
export async function POST(req) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnu";
    if (!autorise(`abonnement:${ip}`, 5, 60000)) {
      return NextResponse.json({ erreur: "Trop de demandes, réessayez dans une minute." }, { status: 429 });
    }

    const corps = await req.json();
    const texte = (v, max) => String(v || "").slice(0, max).trim();

    const telephone = texte(corps.telephone, 20);
    const centre = texte(corps.centre, 160);
    const domicile = texte(corps.domicile, 160);
    const heure = /^([01]?\d|2[0-3]):[0-5]\d$/.test(corps.heure) ? corps.heure : "";
    const jours = Array.isArray(corps.jours)
      ? [...new Set(corps.jours.map(Number).filter((j) => Number.isInteger(j) && j >= 0 && j <= 6))].sort()
      : [];

    if (telephone.length < 9 || !centre || !heure || jours.length === 0) {
      return NextResponse.json({ erreur: "Données invalides" }, { status: 400 });
    }

    const resume = `${jours.map((j) => JOURS_FR[j]).join(" · ")} à ${heure} → ${centre}`;

    const demande = await prisma.$transaction(async (tx) => {
      const abo = await tx.abonnement.create({
        data: {
          nom: texte(corps.nom, 80) || null,
          telephone,
          jours: jours.join(","),
          heure,
          centre,
          domicile,
          retour: corps.retour !== false,
          debut: texte(corps.debut, 10) || new Date().toISOString().slice(0, 10),
          fin: texte(corps.fin, 10) || "",
        },
      });
      return tx.demande.create({
        data: {
          service: "transport",
          typeTrajet: texte(corps.typeTrajet, 30) || null,
          nom: abo.nom,
          telephone,
          depart: domicile || null,
          destination: centre,
          date: `${abo.debut}T${heure}`,
          recurrence: `Abonnement : ${resume}`.slice(0, 80),
          notes: texte(corps.notes, 500) || null,
          espace: corps.espace === "pro" ? "pro" : "patient",
          sousMode: "abonnement",
          abonnementId: abo.id,
        },
      });
    });

    await notifierEquipe(demande);
    return NextResponse.json({ ok: true, id: demande.id }, { status: 201 });
  } catch (e) {
    logErreur("abonnements.POST", e);
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
