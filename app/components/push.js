"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Activation des notifications push sur cet appareil.
// - Android / ordinateur : fonctionne dans le navigateur.
// - iPhone / iPad : Apple exige que le site soit ajouté à l'écran
//   d'accueil (PWA) — on guide l'utilisateur si besoin.
function base64VersUint8(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(b);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

export default function BoutonPush() {
  const [etat, setEtat] = useState("verif"); // verif | dispo | actif | ios_pwa | non_dispo | occupe | erreur
  const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      try {
        if (!clePublique || typeof window === "undefined") return setEtat("non_dispo");
        const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
        if (estIOS && !standalone) return setEtat("ios_pwa");
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setEtat("non_dispo");
        if (Notification.permission === "granted") {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager?.getSubscription();
          if (sub) return setEtat("actif");
        }
        if (Notification.permission === "denied") return setEtat("non_dispo");
        setEtat("dispo");
      } catch {
        setEtat("non_dispo");
      }
    })();
  }, [clePublique]);

  async function activer() {
    setEtat("occupe");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setEtat("non_dispo");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64VersUint8(clePublique),
      });
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!r.ok) throw new Error();
      setEtat("actif");
    } catch {
      setEtat("erreur");
    }
  }

  if (etat === "verif" || etat === "non_dispo") return null;

  if (etat === "actif") {
    return <p className="push-actif">🔔 Notifications activées sur cet appareil ✓</p>;
  }

  if (etat === "ios_pwa") {
    return (
      <div className="push-banniere">
        <strong>🔔 Recevez les alertes ASM sur votre iPhone</strong>
        <p>Ajoutez d&apos;abord ASM à votre écran d&apos;accueil : bouton <b>Partager</b> <span aria-hidden="true">⬆️</span> puis « <b>Sur l&apos;écran d&apos;accueil</b> ». Ouvrez ensuite ASM depuis l&apos;icône et activez les notifications ici.</p>
      </div>
    );
  }

  return (
    <div className="push-banniere">
      <strong>🔔 Soyez prévenu en temps réel</strong>
      <p>Recevez une alerte sur cet appareil : intervenant en route, messages de l&apos;équipe, rendez-vous…</p>
      <button className={"btn-action" + (etat === "occupe" ? " btn-charge" : "")} onClick={activer} disabled={etat === "occupe"}>
        {etat === "occupe" ? "Activation…" : "Activer les notifications"}
      </button>
      {etat === "erreur" && <p className="erreur">Activation impossible. Réessayez.</p>}
    </div>
  );
}
