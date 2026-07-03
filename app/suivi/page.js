"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAsm } from "@/app/providers";
import { TEL_LIEN } from "@/lib/i18n";
import { IcoPersonne, IcoTelephone } from "@/app/components/icones";

// Suivi en temps réel (démonstration animée — la position GPS réelle
// arrivera avec l'app chauffeur, via un canal Realtime).
export default function Suivi() {
  const { t, langue } = useAsm();
  const routeRef = useRef(null);
  const routeFaiteRef = useRef(null);
  const vehiculeRef = useRef(null);
  const [eta, setEta] = useState("8 min");
  const [etapeActive, setEtapeActive] = useState(1); // index dans les 5 étapes

  useEffect(() => {
    const routeEl = routeRef.current;
    const faiteEl = routeFaiteRef.current;
    const vehEl = vehiculeRef.current;
    if (!routeEl) return;
    const L = routeEl.getTotalLength();
    faiteEl.style.strokeDasharray = L;
    let tPos = 0.18;
    let etaMin = 8;
    const place = () => {
      const p = routeEl.getPointAtLength(L * tPos);
      vehEl.setAttribute("transform", `translate(${p.x},${p.y})`);
      faiteEl.style.strokeDashoffset = L * (1 - tPos);
      const m = Math.max(1, Math.round(etaMin));
      setEta(langue === "ar" ? `${m} د` : `${m} min`);
    };
    place();
    const timer = setInterval(() => {
      tPos += 0.015;
      etaMin -= (8 * 0.015) / 0.82;
      if (tPos >= 1) {
        tPos = 1;
        place();
        clearInterval(timer);
        setEta(langue === "ar" ? "وصل" : "Arrivé");
        setEtapeActive(2);
        return;
      }
      place();
    }, 700);
    return () => clearInterval(timer);
  }, [langue]);

  const etapes = [
    t("etape_confirme"),
    t("etape_route"),
    t("etape_arrive"),
    t("etape_trajet"),
    t("etape_termine"),
  ];

  return (
    <div className="page">
      <div className="contenu-page">
        <Link className="btn-retour" href="/tableau">
          {t("retour")}
        </Link>
        <h2 className="titre-page">{t("suivi_t")}</h2>
        <p className="sous-page">{t("suivi_s")}</p>

        <div className="suivi-carte">
          <div className="carte-plan">
            <div className="eta-bulle">
              <span>{t("arrivee")}</span> <span>{eta}</span>
            </div>
            <svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMid slice">
              <path
                ref={routeRef}
                className="route-fond"
                d="M40 190 C 90 120, 140 200, 190 120 S 300 60, 320 40"
              />
              <path
                ref={routeFaiteRef}
                className="route-faite"
                d="M40 190 C 90 120, 140 200, 190 120 S 300 60, 320 40"
              />
              <circle className="point-arrivee" cx="320" cy="40" r="7" />
              <circle className="point-depart" cx="40" cy="190" r="7" />
              <g ref={vehiculeRef} className="vehicule">
                <circle className="halo" cx="0" cy="0" r="14" />
                <circle cx="0" cy="0" r="9" />
              </g>
            </svg>
          </div>
          <div className="suivi-chauffeur">
            <span className="avatar-ch">
              <IcoPersonne />
            </span>
            <span>
              <strong>Karim B.</strong>
              <small>
                <span>{t("chauffeur")}</span> · Jetour X70 · <span dir="ltr">01234-116-16</span>
              </small>
            </span>
            <a className="btn-appel-rond" href={TEL_LIEN} aria-label="Appeler le chauffeur">
              <IcoTelephone />
            </a>
          </div>
          <ul className="etapes-suivi">
            {etapes.map((e, i) => (
              <li
                key={e}
                className={i < etapeActive ? "faite" : i === etapeActive ? "active" : ""}
              >
                {e}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
