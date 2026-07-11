// Procurations patient ↔ établissement : logique centrale de contrôle.
// Un établissement ne peut agir POUR un patient que si un rattachement
// ACCEPTE, non expiré et couvrant le service existe. Toute décision passe
// par autorisationEtablissement() — jamais par un simple affichage.
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const SCOPES = ["transport", "domicile", "medicaments"];

export function normTel(t) {
  return String(t || "").replace(/\D/g, "").slice(-8);
}

// Identité par jeton → { user, profil } (ou null).
export async function identite(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: profil } = await admin
    .from("profil")
    .select("role, prenom, nom, telephone, email, etablissement")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profil, admin };
}

function expire(r) {
  return Boolean(r.expiration && r.expiration < new Date().toISOString().slice(0, 10));
}

// L'établissement (etabUserId) est-il autorisé à réserver `service` pour ce
// patient (tel) ? → { ok } ou { ok:false, raison }.
export async function autorisationEtablissement(etabUserId, patientTel, service) {
  const cle = normTel(patientTel);
  if (!cle) return { ok: false, raison: "telephone_invalide" };
  const liens = await prisma.rattachement.findMany({
    where: { etabUserId, statut: "ACCEPTE" },
  });
  const lien = liens.find((r) => normTel(r.patientTel) === cle);
  if (!lien) return { ok: false, raison: "aucune_procuration" };
  if (expire(lien)) return { ok: false, raison: "procuration_expiree" };
  const scopes = String(lien.scopes || "").split(",").map((s) => s.trim());
  if (!scopes.includes(service)) return { ok: false, raison: "service_hors_perimetre" };
  return { ok: true, lien };
}

// Notification in-app au patient (retrouvé par téléphone), best-effort.
export async function notifierPatientTel(admin, patientTel, { titre, corps, type = "message" }) {
  try {
    const cle = normTel(patientTel);
    if (!cle || cle.length < 6) return;
    const { data } = await admin.from("profil").select("id").ilike("telephone", `%${cle}%`).limit(1);
    const userId = data?.[0]?.id;
    if (!userId) return;
    await prisma.notification.create({
      data: { userId, type, titre, corps: corps || null, auteur: "ASM", statut: "NON_LU" },
    });
    const { envoyerPush } = await import("@/lib/pushEnvoi");
    await envoyerPush(userId, { titre, corps, url: "/autorisations" });
  } catch {}
}
