"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { TEL_AFFICHE, TEL_LIEN } from "@/lib/i18n";

const ETAPES = [
  ["acceptee", "Confirmée"],
  ["en_route", "En route"],
  ["arrivee", "Arrivée"],
  ["en_cours", "En cours"],
  ["terminee", "Terminée"],
];
const RANG = { affectee: 0, acceptee: 1, en_route: 2, arrivee: 3, en_cours: 4, terminee: 5 };

// Prochaine action principale selon l'étape courante.
const SUITE = {
  affectee: { action: "accepter", label: "Confirmer la réception" },
  acceptee: { action: "en_route", label: "Je suis en route" },
  en_route: { action: "arrivee", label: "Arrivée sur place" },
  arrivee: { action: "commencer", label: "Commencer l'intervention" },
  en_cours: { action: "terminer", label: "Terminer l'intervention" },
};

async function jeton() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export default function FicheMission({ params }) {
  const id = params.id;
  const routeur = useRouter();
  const [iv, setIv] = useState(undefined); // undefined = chargement, null = refus/introuvable
  const [occupe, setOccupe] = useState(false);
  const [err, setErr] = useState("");
  const [rendu, setRendu] = useState(false); // formulaire compte rendu ouvert
  const [texteRendu, setTexteRendu] = useState("");
  const [signature, setSignature] = useState(null);
  const [pb, setPb] = useState(false); // formulaire problème ouvert
  const [textePb, setTextePb] = useState("");

  async function charger() {
    const token = await jeton();
    if (!token) { setIv(null); return; }
    try {
      const r = await fetch(`/api/employe/intervention?id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { setIv(null); return; }
      const d = await r.json();
      setIv(d.intervention);
    } catch { setIv(null); }
  }
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  // Rafraîchissement léger : voir arriver « patient prêt » sans recharger.
  useEffect(() => {
    if (!iv || ["terminee", "annulee", "absent"].includes(iv.etape)) return;
    const minuteur = setInterval(charger, 45000);
    return () => clearInterval(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iv?.etape]);

  // Partage de position pendant le trajet (transport, étape « en route ») :
  // envoyée au serveur toutes les ~20 s, affichée sur le suivi du patient.
  // S'arrête seul dès que l'étape change ou qu'on quitte la page.
  const gpsActif = iv?.service === "transport" && iv?.etape === "en_route";
  useEffect(() => {
    if (!gpsActif || !navigator.geolocation) return;
    let dernierEnvoi = 0;
    const surveillance = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - dernierEnvoi < 20000) return;
        dernierEnvoi = Date.now();
        try {
          const token = await jeton();
          await fetch("/api/employe/intervention", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: Number(id), action: "position", lat: p.coords.latitude, lng: p.coords.longitude }),
          });
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(surveillance);
  }, [gpsActif, id]);

  async function agir(action, extra = {}) {
    setErr("");
    setOccupe(true);
    try {
      const token = await jeton();
      const r = await fetch("/api/employe/intervention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: Number(id), action, ...extra }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setIv(d.intervention);
      setRendu(false); setPb(false); setTexteRendu(""); setTextePb("");
    } catch {
      setErr("Action impossible. Réessayez.");
    }
    setOccupe(false);
  }

  if (iv === undefined) return <p className="adm-vide">Chargement de l&apos;intervention…</p>;
  if (iv === null) {
    return (
      <div className="emp-refus" style={{ margin: "40px auto" }}>
        <h1>Intervention introuvable</h1>
        <p>Cette intervention ne vous est pas attribuée, ou n&apos;existe plus.</p>
        <Link className="adm-btn" href="/employe">Retour au tableau de bord</Link>
      </div>
    );
  }

  const rang = RANG[iv.etape] ?? 0;
  const suite = SUITE[iv.etape];
  const cloturee = ["terminee", "annulee", "absent"].includes(iv.etape);
  const heure = iv.date ? new Date(iv.date.replace(" ", "T")).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "à planifier";

  return (
    <>
      <button className="adm-btn secondaire" onClick={() => routeur.back()} style={{ marginBottom: 14 }}>← Retour</button>

      <h1 className="emp-titre">{iv.prioritaire ? "🔴 " : ""}{iv.serviceLib}</h1>
      <p className="emp-sous">{heure}</p>

      {/* Progression */}
      {!["annulee", "absent"].includes(iv.etape) && (
        <div className="mission-steps">
          {ETAPES.map(([k, lib], i) => (
            <div key={k} className={"mission-step" + (i < rang ? " faite" : i === rang - 1 || (rang === 0 && i === 0) ? "" : "") + (RANG[k] <= rang ? " atteinte" : "")}>
              <span className="mission-pastille" />
              <small>{lib}</small>
            </div>
          ))}
        </div>
      )}
      {iv.etape === "absent" && <p className="fe-alerte">Marquée « patient absent ».</p>}
      {iv.etape === "annulee" && <p className="fe-alerte">Cette intervention a été annulée.</p>}

      {/* Patient prêt pour le retour (bouton « Je suis prêt » côté patient). */}
      {iv.retourPretLe && !cloturee && (
        <p className="fe-alerte" style={{ background: "#e7f6ec", borderColor: "#bfe6cc", color: "#1c6b38" }}>
          🟢 Le patient est prêt pour le retour (depuis {new Date(iv.retourPretLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}).
        </p>
      )}
      {gpsActif && (
        <p className="fe-aide" style={{ marginTop: 4 }}>
          📡 Votre position est partagée avec le patient pendant le trajet (elle s&apos;efface à la fin de la mission).
        </p>
      )}

      {iv.ordonnances?.length > 0 && (
        <div className="fe-carte" style={{ marginBottom: 12 }}>
          <strong>📎 Ordonnance{iv.ordonnances.length > 1 ? "s" : ""}</strong>
          {iv.ordonnances.map((o) => (
            <p key={o.id} style={{ margin: "6px 0 0" }}>
              {o.url ? <a href={o.url} target="_blank" rel="noopener noreferrer">{o.nom}</a> : o.nom}
            </p>
          ))}
        </div>
      )}

      {iv.preferencesPatient && (
        <div className="fe-carte" style={{ marginBottom: 12 }}>
          <strong>ℹ Consignes du patient</strong>
          {iv.preferencesPatient.allergies && <p style={{ margin: "6px 0 0" }}>⚠ Allergies : {iv.preferencesPatient.allergies}</p>}
          {iv.preferencesPatient.etage && <p style={{ margin: "6px 0 0" }}>Étage : {iv.preferencesPatient.etage}</p>}
          {iv.preferencesPatient.codePorte && <p style={{ margin: "6px 0 0" }}>Accès : {iv.preferencesPatient.codePorte}</p>}
          {iv.preferencesPatient.consignes && <p style={{ margin: "6px 0 0" }}>{iv.preferencesPatient.consignes}</p>}
        </div>
      )}

      {err && <p className="erreur">{err}</p>}

      {/* Action principale */}
      {suite && (
        suite.action === "terminer" ? (
          !rendu ? (
            <button className={"adm-btn mission-cta" + (occupe ? " btn-charge" : "")} disabled={occupe} onClick={() => setRendu(true)}>
              {suite.label}
            </button>
          ) : (
            <div className="fe-carte" style={{ marginBottom: 12 }}>
              <label className="fe-champ"><span>Compte rendu (facultatif — visible par l&apos;équipe ASM)</span>
                <textarea rows={3} value={texteRendu} onChange={(e) => setTexteRendu(e.target.value)} placeholder="Tout s'est bien passé / points à signaler…" />
              </label>
              <PaveSignature onChange={setSignature} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className={"adm-btn" + (occupe ? " btn-charge" : "")} disabled={occupe} onClick={() => agir("terminer", { compteRendu: texteRendu.trim(), signature: signature || undefined })}>Valider la fin</button>
                <button className="adm-btn secondaire" onClick={() => setRendu(false)}>Annuler</button>
              </div>
            </div>
          )
        ) : (
          <button className={"adm-btn mission-cta" + (occupe ? " btn-charge" : "")} disabled={occupe} onClick={() => agir(suite.action)}>
            {suite.label}
          </button>
        )
      )}

      {/* Contact */}
      <div className="mission-contacts">
        {iv.client?.telephone && (
          <a className="mission-contact" href={`tel:${iv.client.telephone}`}>📞 Appeler le client</a>
        )}
        <a className="mission-contact" href={TEL_LIEN}>🏥 Appeler ASM</a>
        <Link className="mission-contact" href="/employe/messagerie?chat=1">💬 Message à l&apos;équipe</Link>
      </div>

      {/* Détails intervention */}
      <h2 className="emp-section">Détails de l&apos;intervention</h2>
      <div className="fe-carte">
        <div className="fe-ligne"><span className="fe-label">Type</span><span className="fe-valeur">{iv.serviceLib}{iv.typeTrajet ? ` · ${iv.typeTrajet}` : ""}</span></div>
        <div className="fe-ligne"><span className="fe-label">Quand</span><span className="fe-valeur" style={{ textTransform: "capitalize" }}>{heure}</span></div>
        {iv.consignes?.acte && <div className="fe-ligne"><span className="fe-label">Soin</span><span className="fe-valeur">{iv.consignes.acte}</span></div>}
        {(iv.destination || iv.depart) && <div className="fe-ligne"><span className="fe-label">Adresse</span><span className="fe-valeur">{iv.destination || iv.depart}</span></div>}
        {iv.fenetre && <div className="fe-ligne"><span className="fe-label">Créneau</span><span className="fe-valeur">{iv.fenetre}</span></div>}
        {iv.consignes?.acces && <div className="fe-ligne"><span className="fe-label">Accès</span><span className="fe-valeur">{iv.consignes.acces}</span></div>}
        {iv.consignes?.code && <div className="fe-ligne"><span className="fe-label">Code porte</span><span className="fe-valeur">{iv.consignes.code}</span></div>}
        {iv.consignes?.besoins?.length > 0 && <div className="fe-ligne"><span className="fe-label">Besoins</span><span className="fe-valeur">{iv.consignes.besoins.join(", ")}</span></div>}
        {iv.notes && <div className="fe-ligne"><span className="fe-label">Consignes</span><span className="fe-valeur">{iv.notes}</span></div>}
      </div>

      {/* Client (lecture seule) */}
      <h2 className="emp-section">Client</h2>
      <div className="fe-carte">
        <div className="fe-ligne"><span className="fe-label">Nom</span><span className="fe-valeur">{iv.client?.nom || "—"}</span></div>
        <div className="fe-ligne"><span className="fe-label">Téléphone</span><span className="fe-valeur">{iv.client?.telephone ? <a href={`tel:${iv.client.telephone}`}>{iv.client.telephone}</a> : "—"}</span></div>
      </div>
      <p className="fe-aide">🔒 Fiche consultable uniquement — la modification des informations client est réservée à l&apos;administration ASM.</p>

      {/* Compte rendu / problème existants */}
      {(iv.compteRendu || iv.problemeTexte) && (
        <>
          <h2 className="emp-section">Suivi</h2>
          <div className="fe-carte">
            {iv.problemeTexte && <div className="fe-ligne"><span className="fe-label">⚠️ Problème</span><span className="fe-valeur">{iv.problemeTexte}</span></div>}
            {iv.compteRendu && <div className="fe-ligne"><span className="fe-label">Compte rendu</span><span className="fe-valeur">{iv.compteRendu}</span></div>}
          </div>
        </>
      )}

      {/* Actions secondaires */}
      {!cloturee && (
        <div className="mission-secondaire">
          {!pb ? (
            <button className="adm-btn secondaire" onClick={() => setPb(true)}>Signaler un problème</button>
          ) : (
            <div className="fe-carte" style={{ width: "100%" }}>
              <label className="fe-champ"><span>Décrire le problème</span>
                <textarea rows={2} value={textePb} onChange={(e) => setTextePb(e.target.value)} placeholder="Retard, adresse introuvable, patient injoignable…" />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className={"adm-btn" + (occupe ? " btn-charge" : "")} disabled={occupe || !textePb.trim()} onClick={() => agir("probleme", { problemeTexte: textePb.trim() })}>Envoyer</button>
                <button className="adm-btn secondaire" onClick={() => setPb(false)}>Annuler</button>
              </div>
            </div>
          )}
          {iv.etape !== "en_cours" && (
            <button className="adm-btn secondaire" disabled={occupe} onClick={() => window.confirm("Marquer le patient comme absent ?") && agir("absent")}>Patient absent</button>
          )}
        </div>
      )}
    </>
  );
}

// Pavé de signature tactile (facultatif) : le patient signe du doigt à la
// fin de l'intervention. L'image part avec « Valider la fin » — preuve de
// passage conservée dans l'espace privé, visible par l'équipe.
function PaveSignature({ onChange }) {
  const ref = useRef(null);
  const trace = useRef(false);
  const vide = useRef(true);

  function position(e) {
    const c = ref.current;
    const r = c.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    return { x: ((t.clientX - r.left) * c.width) / r.width, y: ((t.clientY - r.top) * c.height) / r.height };
  }
  function debut(e) {
    e.preventDefault();
    trace.current = true;
    const ctx = ref.current.getContext("2d");
    const p = position(e);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.strokeStyle = "#22332C";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function bouge(e) {
    if (!trace.current) return;
    e.preventDefault();
    const ctx = ref.current.getContext("2d");
    const p = position(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    vide.current = false;
  }
  function fin() {
    if (!trace.current) return;
    trace.current = false;
    if (!vide.current) onChange(ref.current.toDataURL("image/png"));
  }
  function effacer() {
    const c = ref.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    vide.current = true;
    onChange(null);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>Signature du patient (facultatif)</span>
      <canvas
        ref={ref}
        width={600}
        height={200}
        style={{ width: "100%", height: 120, border: "1.5px dashed var(--ligne, #ccc)", borderRadius: 10, background: "#fff", touchAction: "none", marginTop: 6 }}
        onMouseDown={debut} onMouseMove={bouge} onMouseUp={fin} onMouseLeave={fin}
        onTouchStart={debut} onTouchMove={bouge} onTouchEnd={fin}
      />
      <button type="button" className="fin-lien" onClick={effacer} style={{ marginTop: 4 }}>Effacer la signature</button>
    </div>
  );
}
