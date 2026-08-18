import { prisma } from "@/lib/prisma";

// Correspondance de numéros INSENSIBLE au format : « 0555 44 33 22 »,
// « +213555443322 » et « 05-55-44-33-22 » désignent la même personne.
// La comparaison se fait en base sur les chiffres uniquement.

// Derniers chiffres significatifs d'un numéro (8 par défaut).
export function cleTel(valeur, n = 8) {
  return String(valeur || "").replace(/\D/g, "").slice(-n);
}

// LE numéro sur lequel un accès peut se fonder : celui que Supabase a
// vérifié par code à l'inscription.
//
// `profil.telephone` ne convient PAS. C'est un champ libre, que chacun
// modifie sur son propre compte. S'en servir pour décider à qui appartient
// une demande revenait à laisser n'importe qui saisir le numéro d'un autre
// patient et voir ses trajets, ses préférences, sa position en direct — et,
// sur /api/demandes/modifier-trajet, changer sa destination.
//
// Conséquence assumée : un compte créé par e-mail ne retrouve plus
// automatiquement les demandes passées par téléphone avant son inscription.
// Le rattachement doit passer par une vérification, pas par une déclaration.
export function telephoneVerifie(user) {
  return user?.phone || "";
}

// Identifiants des demandes dont le téléphone (normalisé) se termine par la
// clé donnée — robuste aux espaces, tirets et indicatifs.
export async function idsDemandesParTel(cle, limite = 100) {
  if (!cle) return [];
  const lignes = await prisma.$queryRaw`
    SELECT id FROM "Demande"
    WHERE regexp_replace(telephone, '\\D', '', 'g') LIKE ${"%" + cle}
    ORDER BY "creeLe" DESC
    LIMIT ${limite}`;
  return lignes.map((l) => l.id);
}
