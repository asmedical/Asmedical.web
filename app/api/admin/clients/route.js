import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierAdmin, journaliser, refus, ROLES_GESTION_INTERVENANTS, ROLES_GESTION_EQUIPE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Numéro local → format international (+213 par défaut).
function e164(tel) {
  let s = String(tel || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return "+213" + s.slice(1);
  return "+213" + s;
}

// GET /api/admin/clients?q=&id= — liste/recherche des comptes clients
// (table profil Supabase, lue avec la clé service_role côté serveur).
// Avec ?id= : fiche complète (profil + demandes liées à son téléphone).
export async function GET(req) {
  const acces = await verifierAdmin(req);
  if (!acces) return refus();
  try {
    const p = new URL(req.url).searchParams;
    const id = p.get("id");

    if (id) {
      const { data: profil } = await acces.admin.from("profil").select("*").eq("id", id).maybeSingle();
      if (!profil) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

      const tel8 = String(profil.telephone || "").replace(/\D/g, "").slice(-8);
      const estPro = profil.role === "pro";
      // Patient : ses demandes (par téléphone) + les établissements autorisés.
      // Établissement : les réservations faites PAR lui + ses patients rattachés.
      // Correspondance téléphone insensible au format (espaces, indicatifs).
      const { idsDemandesParTel } = await import("@/lib/telephones");
      const idsTel = tel8 ? await idsDemandesParTel(tel8, 50) : [];
      const ouDemandes = estPro
        ? { OR: [{ parEtabUserId: id }, ...(idsTel.length ? [{ id: { in: idsTel } }] : [])] }
        : idsTel.length ? { id: { in: idsTel } } : null;
      const [demandes, rattachementsTous] = await Promise.all([
        ouDemandes
          ? prisma.demande.findMany({
              where: ouDemandes,
              orderBy: { creeLe: "desc" },
              take: 50,
              include: { avis: { select: { note: true } } },
            })
          : Promise.resolve([]),
        estPro
          ? prisma.rattachement.findMany({
              where: { etabUserId: id, statut: { not: "CODE_ATTENTE" } },
              orderBy: { creeLe: "desc" },
              take: 300,
            })
          : tel8
          ? prisma.rattachement.findMany({ where: { statut: { not: "CODE_ATTENTE" } }, orderBy: { creeLe: "desc" }, take: 300 })
          : Promise.resolve([]),
      ]);
      const rattachements = estPro
        ? rattachementsTous
        : rattachementsTous.filter((r) => String(r.patientTel || "").replace(/\D/g, "").slice(-8) === tel8);

      // Documents déposés par le patient (bucket privé → URL signées).
      let documents = [];
      try {
        const { data: docs } = await acces.admin
          .from("document")
          .select("*")
          .eq("patient_id", id)
          .order("cree_le", { ascending: false })
          .limit(50);
        if (docs?.length) {
          const { data: urls } = await acces.admin.storage
            .from("documents")
            .createSignedUrls(docs.map((d) => d.chemin), 3600);
          documents = docs.map((d, i) => ({ ...d, url: urls?.[i]?.signedUrl || null }));
        }
      } catch {}

      return NextResponse.json({ profil, demandes, rattachements, documents });
    }

    // « , ( ) » neutralisés : séparateurs de conditions du filtre PostgREST.
    const q = (p.get("q") || "").trim().replace(/[,()]/g, " ").trim();
    // L'onglet Clients ne montre que les CLIENTS : patients par défaut
    // (?type=pro pour les établissements). Les comptes employés et
    // internes ont leurs propres sections (Soignants, Transport, Équipe).
    const type = p.get("type") === "pro" ? "pro" : "patient";
    let requete = acces.admin
      .from("profil")
      .select("id, role, prenom, nom, telephone, email, commune, etablissement, cree_le")
      .order("cree_le", { ascending: false })
      .limit(100);
    if (type === "pro") requete = requete.eq("role", "pro");
    else requete = requete.or("role.eq.patient,role.is.null"); // anciens comptes sans rôle = patients
    if (q) {
      requete = requete.or(
        `nom.ilike.%${q}%,prenom.ilike.%${q}%,telephone.ilike.%${q}%,email.ilike.%${q}%,etablissement.ilike.%${q}%`
      );
    }
    const { data: clients, error } = await requete;
    if (error) throw error;
    return NextResponse.json({ clients: clients || [] });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// POST : créer un compte client (patient ou établissement) depuis l'admin.
// Le client se connecte ensuite avec son numéro (SMS / code) — téléphone
// déjà confirmé. Réservé à superadmin / admin / modérateur.
export async function POST(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    const telephone = String(c.telephone || "").trim();
    if (telephone.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ erreur: "Téléphone obligatoire (9 chiffres min.)." }, { status: 400 });
    }
    const role = c.role === "pro" ? "pro" : "patient";
    const email = c.email ? String(c.email).trim().toLowerCase() : null;

    const { data: cree, error } = await acces.admin.auth.admin.createUser({
      phone: e164(telephone),
      phone_confirm: true,
      ...(email ? { email, email_confirm: true } : {}),
      // À sa 1re connexion, le client devra créer son mot de passe.
      user_metadata: { must_create_password: true },
    });
    if (error) {
      const m = String(error.message || "");
      if (/registered|exists|already/i.test(m)) {
        return NextResponse.json({ erreur: "Un compte existe déjà avec ce téléphone ou cet email." }, { status: 409 });
      }
      return NextResponse.json({ erreur: "Création impossible : " + m }, { status: 400 });
    }

    const t = (v, m) => (v ? String(v).slice(0, m) : null);
    await acces.admin.from("profil").upsert({
      id: cree.user.id,
      role,
      prenom: t(c.prenom, 60),
      nom: t(c.nom, 60),
      telephone,
      email,
      commune: t(c.commune, 80),
      contact: t(c.contact, 160),
      etablissement: role === "pro" ? t(c.etablissement, 160) : null,
      maj_le: new Date().toISOString(),
    });
    await journaliser(acces.nomAffiche, "client.cree", "client", cree.user.id, `${role} · ${telephone}`);
    return NextResponse.json({ ok: true, id: cree.user.id }, { status: 201 });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH : corriger la fiche d'un client. Email et téléphone sont aussi
// synchronisés sur le COMPTE DE CONNEXION (confirmés, sans email envoyé).
export async function PATCH(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_INTERVENANTS);
  if (!acces) return refus();
  try {
    const c = await req.json();
    if (!c.id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const autorises = ["prenom", "nom", "commune", "telephone", "email", "etablissement", "contact"];
    const data = {};
    for (const k of autorises) if (c[k] !== undefined) data[k] = String(c[k] || "").slice(0, 160);
    data.maj_le = new Date().toISOString();
    const { error } = await acces.admin.from("profil").update(data).eq("id", c.id);
    if (error) throw error;

    // Synchronisation du compte de connexion (identifiants réels).
    const majAuth = {};
    if (c.email !== undefined && String(c.email || "").includes("@")) {
      majAuth.email = String(c.email).trim().toLowerCase();
      majAuth.email_confirm = true;
    }
    if (c.telephone !== undefined && String(c.telephone || "").replace(/\D/g, "").length >= 9) {
      majAuth.phone = e164(c.telephone);
      majAuth.phone_confirm = true;
    }
    if (Object.keys(majAuth).length) {
      const { error: eAuth } = await acces.admin.auth.admin.updateUserById(c.id, majAuth);
      if (eAuth && /registered|exists|already/i.test(String(eAuth.message || ""))) {
        return NextResponse.json({ erreur: "Cet email ou ce téléphone est déjà utilisé par un autre compte." }, { status: 409 });
      }
    }

    await journaliser(acces.nomAffiche, "client.maj", "client", c.id, Object.keys(data).join(","));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE ?id= : suppression du COMPTE client — SUPER ADMIN uniquement.
// Suppression « propre » : le compte de connexion et le profil partent,
// mais l'historique (demandes, journal, avis) est conservé.
export async function DELETE(req) {
  const acces = await verifierAdmin(req, ROLES_GESTION_EQUIPE);
  if (!acces) return refus();
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ erreur: "id manquant" }, { status: 400 });
    const { data: profil } = await acces.admin.from("profil").select("prenom, nom, telephone, etablissement").eq("id", id).maybeSingle();
    await acces.admin.from("profil").delete().eq("id", id);
    try {
      await acces.admin.auth.admin.deleteUser(id);
    } catch {}
    await journaliser(
      acces.nomAffiche, "client.supprime", "client", id,
      profil ? (profil.etablissement || [profil.prenom, profil.nom].filter(Boolean).join(" ") || profil.telephone) : ""
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ erreur: "Erreur serveur" }, { status: 500 });
  }
}
