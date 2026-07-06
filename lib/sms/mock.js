// Fournisseur « mock » : n'envoie aucun vrai SMS. Sert aux tests locaux et
// aux environnements de préproduction, pour vérifier tout le circuit
// (Supabase → hook → abstraction) sans consommer de crédits ni exposer de
// numéro réel. Le code est simplement journalisé côté serveur.
export async function envoyerMock(phone, message) {
  console.log(`[SMS mock] → ${phone} : ${message}`);
  return { id: "mock-" + Date.now() };
}
