"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAsm } from "@/app/providers";

// Invitation à installer l'application ASM sur l'écran d'accueil.
//  - Android / Chrome : bouton d'installation natif (beforeinstallprompt)
//  - iPhone / Safari : mode d'emploi (Partager → Sur l'écran d'accueil)
// Jamais affichée si l'app est déjà installée ; « Plus tard » = silence 14 jours.
const PAGES = ["/accueil", "/tableau", "/pro", "/suivi", "/compte"];
const CLE = "asm_pwa_report";

export function InstallerApp() {
  const { t } = useAsm();
  const chemin = usePathname();
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [guide, setGuide] = useState(false);
  const [promptNatif, setPromptNatif] = useState(null);

  useEffect(() => {
    try {
      const installee =
        window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      if (installee) return;
      const report = Number(localStorage.getItem(CLE) || 0);
      if (Date.now() < report) return;

      const ua = navigator.userAgent;
      const estIos = /iphone|ipad|ipod/i.test(ua);
      const estMobile = estIos || /android/i.test(ua);
      if (!estMobile) return;
      setIos(estIos);

      if (estIos) {
        setVisible(true);
      } else {
        const recevoir = (e) => {
          e.preventDefault();
          setPromptNatif(e);
          setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", recevoir);
        return () => window.removeEventListener("beforeinstallprompt", recevoir);
      }
    } catch {}
  }, []);

  if (!visible || !PAGES.some((p) => chemin?.startsWith(p))) return null;

  const plusTard = () => {
    try {
      localStorage.setItem(CLE, String(Date.now() + 14 * 24 * 3600 * 1000));
    } catch {}
    setVisible(false);
  };

  const installer = async () => {
    if (ios) {
      setGuide(true);
      return;
    }
    try {
      promptNatif?.prompt();
      const { outcome } = await promptNatif.userChoice;
      if (outcome === "accepted") setVisible(false);
    } catch {}
  };

  return (
    <>
      <div className="pwa-bandeau" role="dialog" aria-label={t("pwa_t")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icone-192.png" alt="" width={44} height={44} />
        <div className="pwa-txt">
          <strong>{t("pwa_t")}</strong>
          <small>{t("pwa_p")}</small>
        </div>
        <div className="pwa-actions">
          <button className="pwa-btn" onClick={installer}>{t("pwa_installer")}</button>
          <button className="pwa-fermer" onClick={plusTard} aria-label={t("pc_plus_tard")}>✕</button>
        </div>
      </div>

      {guide && (
        <div className="sheet-fond" onClick={() => setGuide(false)}>
          <div className="pwa-guide" onClick={(e) => e.stopPropagation()}>
            <strong>{t("pwa_t")}</strong>
            <ol>
              <li>{t("pwa_ios_1")}</li>
              <li>{t("pwa_ios_2")}</li>
            </ol>
            <button className="btn-action" onClick={() => { setGuide(false); plusTard(); }}>{t("pwa_compris")}</button>
          </div>
        </div>
      )}
    </>
  );
}
