import Link from "next/link";

// Écran d'entrée : choix entre Espace Patient et Espace Professionnel
export default function ChoixEspace() {
  return (
    <div className="voile-choix">
      <div className="logo-rond">+</div>
      <div className="devise-ar">دائماً قريبون منكم</div>
      <h1>Bienvenue chez ASM</h1>
      <div className="choix-espaces">
        <Link href="/patient" className="carte-espace patient">
          <span className="emoji">🧑‍🦽</span>
          <strong>Espace Patient</strong>
          <small>
            Réserver un transport, une aide à domicile ou une livraison de
            médicaments
          </small>
        </Link>
        <Link href="/pro" className="carte-espace pro">
          <span className="emoji">🏥</span>
          <strong>Espace Professionnel</strong>
          <small>Cliniques, centres de dialyse, EHPAD et équipe ASM</small>
        </Link>
      </div>
    </div>
  );
}
