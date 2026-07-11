// Matrice des permissions par rôle — documentation vivante de ce que les
// routes serveur appliquent réellement (adminAuth, rattachements, employe/*).
// Toute évolution de droits doit modifier LES DEUX : la route ET cette matrice.
export const MATRICE = [
  ["Voir / gérer les demandes et rendez-vous", ["superadmin", "admin", "moderateur", "standardiste"]],
  ["Affecter soignants, chauffeurs et véhicules", ["superadmin", "admin", "moderateur", "standardiste"]],
  ["Voir les clients et leurs dossiers", ["superadmin", "admin", "moderateur", "standardiste"]],
  ["Messagerie équipe + diffusion aux employés", ["superadmin", "admin", "moderateur"]],
  ["Gérer les fiches soignants / transporteurs", ["superadmin", "admin", "moderateur"]],
  ["Valider / refuser les documents employés", ["superadmin", "admin", "moderateur"]],
  ["Créer des comptes EMPLOYÉS (soignant, chauffeur…)", ["superadmin", "admin"]],
  ["Créer des comptes ADMIN / modérateur / standardiste", ["superadmin"]],
  ["Changer le rôle d'un utilisateur", ["superadmin"]],
  ["Réinitialiser un mot de passe / suspendre un accès", ["superadmin"]],
  ["Supprimer définitivement une fiche employé", ["superadmin"]],
  ["Modifier les réglages du moteur de réservation", ["superadmin", "admin", "moderateur", "standardiste"]],
  ["Voir un mot de passe existant", []], // personne, jamais
];

export const ROLES_MATRICE = ["superadmin", "admin", "moderateur", "standardiste"];

// Côté clients / employés / établissements (résumé) :
export const REGLES_EXTERNES = [
  "Un patient ne voit que SES demandes, messages, documents et notifications.",
  "Un employé ne voit que SES interventions et ne modifie jamais un client.",
  "Un établissement n'agit pour un patient QUE si une procuration acceptée, non expirée et couvrant le service existe — vérifiée côté serveur.",
  "Le patient peut révoquer une procuration à tout moment (effet immédiat).",
];
