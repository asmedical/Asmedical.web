// Politique de confidentialité — SOURCE UNIQUE, partagée par le site et
// l'application.
//
// Ce document engage juridiquement ASM. Le recopier dans l'application
// aurait produit deux versions destinées à diverger : au premier
// amendement, l'une des deux serait devenue fausse. Le texte vit donc ici,
// le site le rend directement, et l'application le récupère par
// /api/confidentialite.

export const MAJ = "12 juillet 2026";

export const RESUME_AR =
  "نحمي بياناتكم: لا نجمع إلا ما يلزم لتقديم الخدمة، ولا نبيع بياناتكم أبداً، ويمكنكم طلب حذف حسابكم في أي وقت.";

// Chaque section : un titre, des paragraphes, une liste facultative.
// Les points de liste sont { fort, texte } — « fort » est le début en gras.
export const SECTIONS = [
  {
    titre: "1. Qui sommes-nous ?",
    paragraphes: [
      "ASM (Assistance Sociale Médicale) exploite le site et l'application asm-sante.com, qui permettent de réserver un transport sanitaire, une aide à domicile ou une livraison de médicaments dans la wilaya d'Alger, et d'en suivre l'exécution. Contact : contact@asm-sante.com.",
    ],
  },
  {
    titre: "2. Données que nous collectons",
    points: [
      { fort: "Identité et contact", texte: "nom, prénom, numéro de téléphone, e-mail (facultatif), commune, contact d'un proche (facultatif)." },
      { fort: "Données de réservation", texte: "prestations demandées, adresses de départ et de destination, dates, créneaux, consignes que vous renseignez." },
      { fort: "Documents", texte: "que vous déposez volontairement (par exemple une ordonnance pour une livraison de médicaments)." },
      { fort: "Données de compte", texte: "identifiants de connexion (le mot de passe est stocké sous forme chiffrée, jamais en clair), préférences de langue et de notifications." },
      { fort: "Données techniques minimales", texte: "nécessaires au fonctionnement et à la sécurité (journaux serveur, protection anti-abus). Nous n'utilisons pas de cookies publicitaires." },
    ],
  },
  {
    titre: "3. Pourquoi nous les utilisons",
    points: [
      { texte: "Organiser et exécuter vos prestations (réservation, affectation d'un intervenant, suivi, facturation)." },
      { texte: "Vous tenir informé : notifications de suivi, messages de l'équipe, rappels de rendez-vous." },
      { texte: "Sécuriser les comptes (codes de connexion, journal des actions sensibles)." },
      { texte: "Améliorer le service (statistiques d'activité internes, jamais revendues)." },
    ],
    paragraphes: ["Nous ne vendons ni ne louons vos données à personne."],
  },
  {
    titre: "4. Qui peut voir vos données",
    points: [
      { fort: "L'équipe ASM", texte: "selon des rôles stricts contrôlés par nos serveurs : chaque membre ne voit que ce qui est nécessaire à sa mission, et les actions sensibles sont journalisées." },
      { fort: "L'intervenant affecté", texte: "à votre demande (chauffeur, auxiliaire de santé, coursier) : uniquement les informations utiles à la mission — jamais vos documents ni votre historique complet." },
      { fort: "Un établissement de santé", texte: "uniquement si vous l'y avez autorisé (procuration que vous pouvez révoquer à tout moment depuis votre espace)." },
      { fort: "Nos sous-traitants techniques", texte: "qui hébergent ou acheminent pour notre compte : hébergement du site et de la base de données, envoi de SMS, d'e-mails et de notifications. Ils n'utilisent pas vos données pour leur propre compte." },
    ],
  },
  {
    titre: "5. Conservation",
    paragraphes: [
      "Les données de votre compte sont conservées tant que le compte est actif. L'historique des prestations est conservé pour les besoins de gestion et les obligations comptables. En cas de suppression de compte, vos identifiants de connexion sont supprimés ; l'historique est conservé sous une forme limitée aux besoins légaux.",
    ],
  },
  {
    titre: "6. Vos droits",
    points: [
      { texte: "Consulter et corriger vos informations depuis votre espace, ou en nous contactant." },
      { texte: "Révoquer à tout moment une autorisation donnée à un établissement." },
      { texte: "Désactiver les notifications depuis votre téléphone ou votre profil." },
      { texte: "Demander la suppression de votre compte et de vos données : depuis la page dédiée asm-sante.com/suppression-compte, par email à contact@asm-sante.com ou par téléphone ; la demande est traitée sous 30 jours." },
    ],
  },
  {
    titre: "7. Sécurité",
    paragraphes: [
      "Connexions chiffrées (HTTPS), mots de passe jamais stockés en clair ni visibles (même par nos administrateurs), documents stockés dans un espace privé accessible par liens temporaires signés, droits vérifiés côté serveur à chaque action, journal d'audit des opérations sensibles.",
    ],
  },
  {
    titre: "8. Enfants",
    paragraphes: [
      "Le service s'adresse aux adultes. Un mineur est pris en charge via le compte d'un parent, d'un tuteur ou d'un établissement autorisé.",
    ],
  },
  {
    titre: "9. Évolutions de cette politique",
    paragraphes: [
      "Si cette politique évolue, la date de mise à jour ci-dessus change et les modifications importantes sont annoncées dans l'application.",
    ],
  },
];
