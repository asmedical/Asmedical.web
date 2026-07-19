import { prisma } from "@/lib/prisma";

// Correspondance de numéros INSENSIBLE au format : « 0555 44 33 22 »,
// « +213555443322 » et « 05-55-44-33-22 » désignent la même personne.
// La comparaison se fait en base sur les chiffres uniquement.

// Derniers chiffres significatifs d'un numéro (8 par défaut).
export function cleTel(valeur, n = 8) {
  return String(valeur || "").replace(/\D/g, "").slice(-n);
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
