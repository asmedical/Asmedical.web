// Parcours de réservation — DÉFINITION UNIQUE, partagée par le site et
// l'application.
//
// Le site l'importe directement ; l'application la récupère par
// /api/parcours. Aucun des deux ne redéfinit les étapes, les types de
// demande ou les règles de validation : c'est la seule façon d'empêcher les
// deux supports de diverger, faute d'espace de travail commun entre le
// projet Next.js et le projet Expo.
//
// Ce fichier ne contient QUE la structure. Les libellés sont des clés de
// traduction (lib/i18n.js et mobile/src/i18n.js), et les disponibilités
// viennent du serveur — jamais d'un calcul côté client.

// --- Étapes, dans l'ordre. « cle » sert d'URL sur le site.
export const ETAPES = [
  { cle: "besoin", titre: "pc_etape_besoin" },
  { cle: "lieux", titre: "pc_etape_lieux" },
  { cle: "creneau", titre: "pc_etape_creneau" },
  { cle: "confirmation", titre: "pc_etape_confirmation" },
];

// --- Types de demande, par service.
//
// « recurrent » bascule vers le parcours abonnement : pour une dialyse ou
// une chimiothérapie, on ne montre jamais de créneaux temps réel — la
// régulation confirme humainement et rappelle sous trente minutes.
export const TYPES = {
  transport: [
    { cle: "dialyse", libelle: "pc_t_dialyse", recurrent: true },
    { cle: "chimiotherapie", libelle: "pc_t_chimio", recurrent: true },
    { cle: "consultation", libelle: "pc_t_consultation" },
    { cle: "laboratoire", libelle: "pc_t_labo" },
    { cle: "chauffeur", libelle: "pc_t_chauffeur" },
    { cle: "chauffeur_medical", libelle: "pc_t_chauffeur_med" },
    { cle: "accompagnement", libelle: "pc_t_accompagnement" },
  ],
  domicile: [
    { cle: "toilette", libelle: "pc_d_toilette" },
    { cle: "surveillance", libelle: "pc_d_surveillance" },
    { cle: "post_hospitalisation", libelle: "pc_d_post_hosp" },
    { cle: "soins_infirmiers", libelle: "pc_d_infirmiers" },
    { cle: "repas", libelle: "pc_d_repas" },
  ],
  medicaments: [
    { cle: "ordonnance", libelle: "pc_m_ordonnance" },
    { cle: "renouvellement", libelle: "pc_m_renouvellement" },
  ],
};

// --- Besoins particuliers : ils n'apparaissent QU'UNE fois dans tout le
// parcours (étape 2). L'ancien formulaire les répétait.
//
// Les clés gardent le préfixe « b_ » de l'ancien formulaire : ce sont elles
// qui sont écrites dans details.besoinsCles et que lib/finances.js relit pour
// facturer les suppléments fauteuil et oxygène. Les renommer aurait fait
// disparaître ces suppléments sans aucune erreur visible.
export const BESOINS = [
  { cle: "b_fauteuil", libelle: "pc_b_fauteuil" },
  { cle: "b_oxygene", libelle: "pc_b_oxygene" },
  { cle: "b_alite", libelle: "pc_b_alite" },
  { cle: "b_marche", libelle: "pc_b_marche" },
  { cle: "b_accompagnateur", libelle: "pc_b_accompagnateur" },
  { cle: "b_age", libelle: "pc_b_age" },
  { cle: "b_postop", libelle: "pc_b_postop" },
  { cle: "b_enfant", libelle: "pc_b_enfant" },
];

// --- Classe de véhicule exigée par un type de demande.
//
// L'ancien formulaire posait la question deux fois : « chauffeur médicalisé »
// dans la prestation, puis « type de trajet » dans une liste séparée. Le type
// choisi à l'étape 1 suffit à la déduire — c'est le champ « typeTrajet » que
// lib/disponibilites.js utilise pour ne proposer que des véhicules capables.
export const VEHICULES = {
  chauffeur_medical: "medicalise",
  accompagnement: "accompagne",
  dialyse: "accompagne",
  chimiotherapie: "accompagne",
};

export function vehiculePour(service, type) {
  return service === "transport" ? VEHICULES[type] || "simple" : undefined;
}

// --- Communes d'Alger : liste fermée. Le champ texte libre produisait des
// orthographes multiples pour une même commune, que le moteur de
// disponibilités ne savait pas rapprocher.
export const COMMUNES = [
  "Alger-Centre", "Sidi M'Hamed", "El Madania", "Belouizdad", "Bab El Oued",
  "Bologhine", "Casbah", "Oued Koriche", "Bir Mourad Raïs", "El Biar",
  "Bouzareah", "Birkhadem", "El Harrach", "Baraki", "Oued Smar",
  "Bourouba", "Hussein Dey", "Kouba", "Bachdjerrah", "Dar El Beïda",
  "Bab Ezzouar", "Ben Aknoun", "Dely Ibrahim", "Hammamet", "Raïs Hamidou",
  "Djasr Kasentina", "El Mouradia", "Hydra", "Mohammadia", "Bordj El Kiffan",
  "El Magharia", "Beni Messous", "Les Eucalyptus", "Birtouta", "Tessala El Merdja",
  "Ouled Chebel", "Sidi Moussa", "Aïn Taya", "Bordj El Bahri", "El Marsa",
  "H'raoua", "Rouiba", "Reghaïa", "Aïn Benian", "Staoueli",
  "Zeralda", "Mahelma", "Rahmania", "Souidania", "Cheraga",
  "Ouled Fayet", "El Achour", "Draria", "Douera", "Baba Hassen",
  "Khraicia", "Saoula",
];

// --- Fenêtres de livraison : pas d'heure précise pour les médicaments, le
// coursier enchaîne plusieurs tournées.
export const FENETRES = [
  { cle: "matin", libelle: "pc_f_matin", debut: "09:00", fin: "12:00" },
  { cle: "midi", libelle: "pc_f_midi", debut: "12:00", fin: "15:00" },
  { cle: "apresmidi", libelle: "pc_f_apresmidi", debut: "15:00", fin: "19:00" },
];

// --- Moyens de paiement. « actif: false » prépare la structure sans
// exposer un moyen que la plateforme ne sait pas encore traiter.
export const PAIEMENTS = [
  { cle: "especes", libelle: "pc_p_especes", actif: true, defaut: true },
  { cle: "agence", libelle: "pc_p_agence", actif: true },
  { cle: "carte", libelle: "pc_p_carte", actif: false },
  { cle: "conventionne", libelle: "pc_p_conventionne", actif: true, proSeulement: true },
];

// --- Validation d'une étape. Renvoie la liste des clés de message
// d'erreur ; vide = étape franchissable.
//
// Les DEUX supports appellent cette fonction : si l'un devenait plus
// permissif que l'autre, on créerait des demandes incomplètes d'un côté
// seulement. Le serveur revalide de toute façon.
export function validerEtape(etape, d = {}) {
  const manque = [];
  if (etape === "besoin") {
    if (!d.service) manque.push("pc_err_service");
    if (!d.type) manque.push("pc_err_type");
  }
  if (etape === "lieux") {
    // « depart » porte l'adresse dans les trois services : le point de prise
    // en charge pour un transport, le domicile pour une intervention ou une
    // livraison. Seul le transport a une seconde adresse.
    if (!d.depart?.trim()) manque.push(d.service === "transport" ? "pc_err_depart" : "pc_err_adresse");
    if (d.service === "transport" && !d.destination?.trim()) manque.push("pc_err_destination");
    if (!d.commune) manque.push("pc_err_commune");
    // Un aller-retour sans heure de reprise laisse le véhicule attendre sans
    // limite : soit une heure, soit « à la sortie des soins », explicitement.
    if (d.allerRetour && !d.retourHeure) manque.push("pc_err_retour");
  }
  if (etape === "creneau") {
    // L'abonnement ne choisit pas de créneau : la régulation rappelle.
    if (!estRecurrent(d.service, d.type)) {
      if (d.service === "medicaments") {
        if (!d.fenetre) manque.push("pc_err_fenetre");
      } else if (!d.iso) {
        manque.push("pc_err_creneau");
      }
    }
  }
  if (etape === "confirmation") {
    if (!d.paiement) manque.push("pc_err_paiement");
  }
  return manque;
}

export function estRecurrent(service, type) {
  return !!(TYPES[service] || []).find((x) => x.cle === type)?.recurrent;
}

// Étape suivante / précédente. Le retour arrière conserve les saisies :
// c'est l'appelant qui garde l'état, on ne fait que déplacer le curseur.
export function etapeSuivante(cle) {
  const i = ETAPES.findIndex((e) => e.cle === cle);
  return i >= 0 && i < ETAPES.length - 1 ? ETAPES[i + 1].cle : null;
}

export function etapePrecedente(cle) {
  const i = ETAPES.findIndex((e) => e.cle === cle);
  return i > 0 ? ETAPES[i - 1].cle : null;
}

export function numeroEtape(cle) {
  return ETAPES.findIndex((e) => e.cle === cle) + 1;
}
