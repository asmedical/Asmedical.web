// Jeu de données de DÉMONSTRATION pour les captures du dossier fonctionnel.
// Tous les noms, numéros et rendez-vous sont FICTIFS (cf. dossier).
// S'exécute uniquement sur la base LOCALE de démonstration.
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://asm:asm@localhost:5432/asmdb";
if (!process.env.DATABASE_URL.includes("localhost")) {
  console.error("Refus : ce script ne s'exécute que sur une base locale.");
  process.exit(1);
}
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const auj = new Date();
const j = (n, h = "09:00") => {
  const d = new Date(auj);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${h}`;
};

async function main() {
  // Repart d'une base de démonstration propre.
  for (const t of ["avis", "notification", "message", "demandeSuppression", "documentEmploye", "rattachement", "demande", "abonnement", "soignant", "transporteur", "journal", "otpCanal"]) {
    try { await prisma[t].deleteMany({}); } catch {}
  }

  // ---- Intervenants fictifs ----
  const sabrina = await prisma.soignant.create({
    data: {
      prenom: "Sabrina", nom: "Laziri", telephone: "0550 11 22 33", qualification: "aide_soignant",
      communes: "Alger-Centre, Bab El Oued, El Biar", commune: "Alger-Centre", wilaya: "Alger",
      statut: "VALIDE", dispo: "DISPONIBLE", specialites: "toilette, pansements, aide au lever",
      heureDebut: 8, heureFin: 18, joursOff: "6", accepteUrgences: true,
      typeRemuneration: "horaire", tauxHoraire: 900,
    },
  });
  const nadia = await prisma.soignant.create({
    data: {
      prenom: "Nadia", nom: "Cherif", telephone: "0550 44 55 66", qualification: "infirmier",
      communes: "Hydra, Kouba, Birkhadem", commune: "Hydra", wilaya: "Alger",
      statut: "VALIDE", dispo: "DISPONIBLE", specialites: "injections, perfusions, suivi diabète",
      heureDebut: 7, heureFin: 17, joursOff: "5",
      typeRemuneration: "mission", tarifMission: 2500,
    },
  });
  const karim = await prisma.transporteur.create({
    data: {
      nom: "Karim Mansouri", responsable: "Karim Mansouri", telephone: "0770 12 34 56",
      typeTransport: "accompagne", vehicule: "Renault Trafic aménagé", vehiculeCouleur: "blanc",
      vehiculeImmat: "01234-119-16", zone: "Alger-Centre, Hussein Dey, El Harrach",
      statut: "VALIDE", dispo: "DISPONIBLE", heureDebut: 6, heureFin: 20, joursOff: "",
      specialites: "fauteuil roulant, oxygène",
    },
  });
  const amine = await prisma.transporteur.create({
    data: {
      nom: "Amine Haddad", responsable: "Amine Haddad", telephone: "0770 98 76 54",
      typeTransport: "simple", vehicule: "Fiat Doblò", vehiculeCouleur: "gris",
      vehiculeImmat: "05678-121-16", zone: "Alger-Centre, Bab Ezzouar",
      statut: "VALIDE", dispo: "DISPONIBLE", heureDebut: 8, heureFin: 19, joursOff: "6",
      specialites: "livraison médicaments",
    },
  });

  // ---- Demandes fictives du patient Mahmoud Benali ----
  const TEL = "0555 01 02 03";
  await prisma.demande.create({
    data: {
      service: "transport", typeTrajet: "aller_retour", nom: "Mahmoud Benali", telephone: TEL,
      depart: "Alger-Centre", destination: "Centre de dialyse Alger", commune: "Alger-Centre",
      date: j(1, "08:00"), dureeMin: 60, statut: "AFFECTEE", transporteurId: karim.id,
      accepteeLe: new Date(), enRouteLe: new Date(),
    },
  });
  await prisma.demande.create({
    data: {
      service: "domicile", nom: "Mahmoud Benali", telephone: TEL, commune: "Alger-Centre",
      destination: "Domicile — Alger-Centre", date: j(2, "10:00"), dureeMin: 60,
      statut: "AFFECTEE", soignantId: sabrina.id,
    },
  });
  const terminee = await prisma.demande.create({
    data: {
      service: "medicaments", nom: "Mahmoud Benali", telephone: TEL, commune: "Alger-Centre",
      destination: "Domicile — Alger-Centre", fenetre: "Matin (9h – 12h)",
      date: j(-3, "10:30"), dureeMin: 30, statut: "TERMINEE", transporteurId: amine.id,
      accepteeLe: new Date(), finLe: new Date(),
    },
  });
  await prisma.avis.create({
    data: { demandeId: terminee.id, note: 5, commentaire: "Livraison rapide et coursier très aimable, merci ASM.", telephone: TEL, transporteurId: amine.id },
  });

  // Autres demandes pour remplir le planning / l'admin (fictives).
  await prisma.demande.create({
    data: {
      service: "transport", typeTrajet: "aller_simple", nom: "Yasmina Kaci", telephone: "0666 07 08 09",
      depart: "El Biar", destination: "CHU Mustapha", commune: "El Biar",
      date: j(1, "10:30"), dureeMin: 90, statut: "CONFIRMEE",
    },
  });
  await prisma.demande.create({
    data: {
      service: "domicile", nom: "Rachid Meziane", telephone: "0777 03 04 05", commune: "Hydra",
      destination: "Domicile — Hydra", date: j(1, "14:00"), dureeMin: 90,
      statut: "AFFECTEE", soignantId: nadia.id,
    },
  });
  await prisma.demande.create({
    data: {
      service: "medicaments", nom: "Fatima Zohra Ait", telephone: "0555 06 07 08", commune: "Kouba",
      destination: "Domicile — Kouba", fenetre: "Après-midi (13h – 17h)",
      date: j(1, "15:00"), dureeMin: 30, statut: "CONFIRMEE",
      parEtablissement: "Centre de dialyse Alger", parEtabUserId: "demo-etab-1",
    },
  });

  // ---- Rattachements (procurations) fictifs ----
  await prisma.rattachement.createMany({
    data: [
      { patientTel: TEL, patientNom: "Mahmoud Benali", etabUserId: "demo-etab-1", etabNom: "Centre de dialyse Alger", statut: "ACCEPTE", source: "staff", scopes: "transport,medicaments" },
      { patientTel: "0555 06 07 08", patientNom: "Fatima Zohra Ait", etabUserId: "demo-etab-1", etabNom: "Centre de dialyse Alger", statut: "ACCEPTE", source: "invitation", scopes: "transport,domicile,medicaments" },
      { patientTel: "0666 07 08 09", patientNom: "Yasmina Kaci", etabUserId: "demo-etab-1", etabNom: "Centre de dialyse Alger", statut: "EN_ATTENTE", source: "code", scopes: "transport" },
    ],
  });

  // ---- Notifications / messages fictifs du patient ----
  const USER = "demo-patient-1";
  await prisma.notification.createMany({
    data: [
      { userId: USER, type: "rdv", titre: "Votre chauffeur est en route", corps: "Karim Mansouri arrive — Renault Trafic blanc, plaque 01234-119-16.", auteur: "Coordination ASM", statut: "NON_LU", lienType: "suivi", lienId: "1" },
      { userId: USER, type: "rdv", titre: "Un intervenant vous a été assigné", corps: "Votre aide à domicile de demain est confirmée avec Sabrina L.", auteur: "Coordination ASM", statut: "NON_LU" },
      { userId: USER, type: "info", titre: "Document demandé", corps: "Merci d'ajouter votre ordonnance pour la livraison de médicaments.", auteur: "Équipe ASM", statut: "LU" },
    ],
  });
  await prisma.message.createMany({
    data: [
      { userId: USER, deEquipe: false, texte: "Bonjour, mon rendez-vous de demain est bien confirmé ?", luParEquipe: true },
      { userId: USER, deEquipe: true, auteur: "Lina — Équipe ASM", texte: "Bonjour M. Benali, oui : transport demain 8h avec Karim, Renault Trafic blanc. Bonne journée !", luParPatient: false },
    ],
  });

  // ---- Journal (traçabilité) fictif ----
  await prisma.journal.createMany({
    data: [
      { auteur: "Amel (modératrice)", action: "demande.maj", entite: "demande", entiteId: "1", detail: "transporteur → Karim Mansouri" },
      { auteur: "Super admin", action: "suppression.validee", entite: "client", entiteId: "0", detail: "Compte doublon (demandé par Amel)" },
      { auteur: "Amel (modératrice)", action: "export.demandes", entite: "export", entiteId: "0", detail: "mois en cours (42 lignes)" },
    ],
  });

  const compte = { soignants: await prisma.soignant.count(), transporteurs: await prisma.transporteur.count(), demandes: await prisma.demande.count(), rattachements: await prisma.rattachement.count() };
  console.log("Démo prête ✓", compte);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
