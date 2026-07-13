// Politique de confidentialité — exigée notamment par Google Play.
// Page volontairement simple, honnête et lisible (FR, résumé AR en tête).
export const metadata = {
  title: "ASM — Politique de confidentialité",
  description: "Comment ASM collecte, utilise et protège vos données personnelles.",
};

const MAJ = "12 juillet 2026";

function Bloc({ titre, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{ marginBottom: 8 }}>{titre}</h3>
      {children}
    </section>
  );
}

export default function Confidentialite() {
  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 720 }}>
        <h2 className="titre-page">Politique de confidentialité</h2>
        <p className="sous-page">
          ASM — Assistance Sociale Médicale · dernière mise à jour : {MAJ}
          <br />
          <span dir="rtl" lang="ar">
            نحمي بياناتكم: لا نجمع إلا ما يلزم لتقديم الخدمة، ولا نبيع بياناتكم أبداً، ويمكنكم طلب حذف حسابكم في أي وقت.
          </span>
        </p>

        <Bloc titre="1. Qui sommes-nous ?">
          <p>
            ASM (Assistance Sociale Médicale) exploite le site et l&apos;application asm-sante.com, qui
            permettent de réserver un transport sanitaire, une aide à domicile ou une livraison de
            médicaments dans la wilaya d&apos;Alger, et d&apos;en suivre l&apos;exécution.
            Contact : <a href="mailto:contact@asm-sante.com">contact@asm-sante.com</a>.
          </p>
        </Bloc>

        <Bloc titre="2. Données que nous collectons">
          <ul>
            <li><strong>Identité et contact</strong> : nom, prénom, numéro de téléphone, e-mail (facultatif), commune, contact d&apos;un proche (facultatif).</li>
            <li><strong>Données de réservation</strong> : prestations demandées, adresses de départ et de destination, dates, créneaux, consignes que vous renseignez.</li>
            <li><strong>Documents</strong> que vous déposez volontairement (par exemple une ordonnance pour une livraison de médicaments).</li>
            <li><strong>Données de compte</strong> : identifiants de connexion (le mot de passe est stocké sous forme chiffrée, jamais en clair), préférences de langue et de notifications.</li>
            <li><strong>Données techniques minimales</strong> nécessaires au fonctionnement et à la sécurité (journaux serveur, protection anti-abus). Nous n&apos;utilisons pas de cookies publicitaires.</li>
          </ul>
        </Bloc>

        <Bloc titre="3. Pourquoi nous les utilisons">
          <ul>
            <li>Organiser et exécuter vos prestations (réservation, affectation d&apos;un intervenant, suivi, facturation).</li>
            <li>Vous tenir informé : notifications de suivi, messages de l&apos;équipe, rappels de rendez-vous.</li>
            <li>Sécuriser les comptes (codes de connexion, journal des actions sensibles).</li>
            <li>Améliorer le service (statistiques d&apos;activité internes, jamais revendues).</li>
          </ul>
          <p>Nous ne vendons ni ne louons vos données à personne.</p>
        </Bloc>

        <Bloc titre="4. Qui peut voir vos données">
          <ul>
            <li><strong>L&apos;équipe ASM</strong>, selon des rôles stricts contrôlés par nos serveurs : chaque membre ne voit que ce qui est nécessaire à sa mission, et les actions sensibles sont journalisées.</li>
            <li><strong>L&apos;intervenant affecté</strong> à votre demande (chauffeur, aide-soignant·e, coursier) : uniquement les informations utiles à la mission — jamais vos documents ni votre historique complet.</li>
            <li><strong>Un établissement de santé</strong> uniquement si vous l&apos;y avez autorisé (procuration que vous pouvez révoquer à tout moment depuis votre espace).</li>
            <li><strong>Nos sous-traitants techniques</strong>, qui hébergent ou acheminent pour notre compte : hébergement du site et de la base de données, envoi de SMS, d&apos;e-mails et de notifications. Ils n&apos;utilisent pas vos données pour leur propre compte.</li>
          </ul>
        </Bloc>

        <Bloc titre="5. Conservation">
          <p>
            Les données de votre compte sont conservées tant que le compte est actif. L&apos;historique des
            prestations est conservé pour les besoins de gestion et les obligations comptables. En cas de
            suppression de compte, vos identifiants de connexion sont supprimés ; l&apos;historique est
            conservé sous une forme limitée aux besoins légaux.
          </p>
        </Bloc>

        <Bloc titre="6. Vos droits">
          <ul>
            <li>Consulter et corriger vos informations depuis votre espace, ou en nous contactant.</li>
            <li>Révoquer à tout moment une autorisation donnée à un établissement.</li>
            <li>Désactiver les notifications depuis votre téléphone ou votre profil.</li>
            <li>Demander la suppression de votre compte : écrivez-nous à <a href="mailto:contact@asm-sante.com">contact@asm-sante.com</a> ou appelez-nous ; la demande est traitée par notre équipe.</li>
          </ul>
        </Bloc>

        <Bloc titre="7. Sécurité">
          <p>
            Connexions chiffrées (HTTPS), mots de passe jamais stockés en clair ni visibles (même par nos
            administrateurs), documents stockés dans un espace privé accessible par liens temporaires
            signés, droits vérifiés côté serveur à chaque action, journal d&apos;audit des opérations
            sensibles.
          </p>
        </Bloc>

        <Bloc titre="8. Enfants">
          <p>
            Le service s&apos;adresse aux adultes. Un mineur est pris en charge via le compte d&apos;un parent,
            d&apos;un tuteur ou d&apos;un établissement autorisé.
          </p>
        </Bloc>

        <Bloc titre="9. Évolutions de cette politique">
          <p>
            Si cette politique évolue, la date de mise à jour ci-dessus change et les modifications
            importantes sont annoncées dans l&apos;application.
          </p>
        </Bloc>
      </div>
    </div>
  );
}
