"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAsm } from "@/app/providers";

// Packs de prestations : offres nommées à PRIX AFFICHÉ (forfait tout
// compris) — réservables en un geste.

const ICO = { transport: "🚑", domicile: "🏠", medicaments: "💊" };

export default function Packs() {
  const { t, langue, choisirService } = useAsm();
  const routeur = useRouter();
  const [packs, setPacks] = useState(null);

  useEffect(() => {
    fetch("/api/packs")
      .then((r) => r.json())
      .then((d) => setPacks(d.packs || []))
      .catch(() => setPacks([]));
  }, []);

  function reserver(p) {
    try {
      sessionStorage.setItem("asm_pack", JSON.stringify({ id: p.id, nom: langue === "ar" && p.nomAr ? p.nomAr : p.nom, prix: p.prix }));
    } catch {}
    choisirService(p.service);
    routeur.push("/rdv");
  }

  return (
    <div className="page">
      <div className="contenu-page" style={{ maxWidth: 640 }}>
        <Link className="btn-retour" href="/accueil">{t("retour")}</Link>
        <h2 className="titre-page">{t("pk_t")}</h2>
        <p className="sous-page">{t("pk_s")}</p>

        {packs === null && <p className="sous-page">{t("compte_charge")}</p>}
        {packs?.length === 0 && <p className="sous-page">{t("pk_vide")}</p>}
        {(packs || []).map((p) => (
          <div className="carte-compte" key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <strong style={{ fontSize: 16.5 }}>{ICO[p.service]} {langue === "ar" && p.nomAr ? p.nomAr : p.nom}</strong>
              <strong style={{ color: "var(--vert-fonce)", fontSize: 18, whiteSpace: "nowrap" }}>
                {Number(p.prix).toLocaleString("fr-FR")} DZD
              </strong>
            </div>
            {(langue === "ar" && p.descriptionAr ? p.descriptionAr : p.description) && (
              <p style={{ color: "var(--gris)", margin: "6px 0 10px", lineHeight: 1.55 }}>
                {langue === "ar" && p.descriptionAr ? p.descriptionAr : p.description}
              </p>
            )}
            <button className="btn-action" style={{ padding: "11px 18px" }} onClick={() => reserver(p)}>
              {t("pk_reserver")}
            </button>
          </div>
        ))}

        <p className="sous-page" style={{ marginTop: 16 }}>
          {t("pk_devis_hint")} <Link href="/devis" style={{ fontWeight: 700 }}>{t("dv_t")}</Link>
        </p>
      </div>
    </div>
  );
}
