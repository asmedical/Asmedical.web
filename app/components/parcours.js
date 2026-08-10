"use client";
import { useEffect, useState } from "react";
import { ETAPES, TYPES, BESOINS, COMMUNES, FENETRES, PAIEMENTS, numeroEtape, etapesPour } from "@/lib/parcours";

// Éléments communs au parcours de réservation. La structure vient de
// lib/parcours.js — partagée avec l'application ; seul le rendu est propre
// au site.

// Indicateur de progression. Il reste affiché à chaque étape : sans lui, un
// formulaire long donne l'impression de ne jamais finir.
export function Stepper({ etape, demande }) {
  // La liste dépend de la demande : une prise en charge au plus tôt n'a pas
  // d'étape « date et heure », et compter une étape qui n'arrivera jamais
  // fait attendre pour rien.
  const etapes = etapesPour(demande || {});
  const courant = numeroEtape(etape, demande || {});
  return (
    <div className="pc-stepper" role="progressbar" aria-valuenow={courant} aria-valuemin={1} aria-valuemax={etapes.length}>
      {etapes.map((e, i) => {
        const n = i + 1;
        const classe = n < courant ? "fait" : n === courant ? "actif" : "";
        return (
          <span className={"pc-pas " + classe} key={e.cle}>
            <span className="pc-rond">{n}</span>
            {i < etapes.length - 1 && <span className="pc-trait" />}
          </span>
        );
      })}
    </div>
  );
}

// Conservation des saisies entre les étapes.
//
// Chaque étape a sa propre URL (retour navigateur, reprise de parcours) :
// l'état ne peut donc pas vivre dans un composant. Il est gardé dans la
// session de l'onglet — il disparaît à la fermeture, ce qui est le bon
// comportement pour une adresse de domicile ou l'état de santé de quelqu'un.
const CLE = "asm_parcours";

export function lireParcours() {
  try {
    return JSON.parse(sessionStorage.getItem(CLE) || "{}");
  } catch {
    return {};
  }
}

export function ecrireParcours(champs) {
  try {
    const actuel = lireParcours();
    const suivant = { ...actuel, ...champs };
    sessionStorage.setItem(CLE, JSON.stringify(suivant));
    return suivant;
  } catch {
    return champs;
  }
}

export function viderParcours() {
  try {
    sessionStorage.removeItem(CLE);
  } catch {}
}

// Hook de lecture : sessionStorage n'existe pas au rendu serveur, on ne lit
// donc qu'après le montage.
export function useParcours() {
  const [d, setD] = useState(null);
  useEffect(() => setD(lireParcours()), []);
  const maj = (champs) => setD(ecrireParcours(champs));
  return [d, maj];
}

// --- Structure du parcours, lue par le serveur.
//
// Le site pourrait importer lib/parcours.js et s'arrêter là. Il passe quand
// même par /api/parcours, pour une raison précise : les actes à domicile sont
// configurés en back-office, avec leur durée. Les lire ici garantit que le
// site et l'application proposent la MÊME liste — et que la durée qui sert à
// réserver le créneau est celle qu'a réglée l'équipe, pas une valeur figée.
//
// En attendant la réponse, et si elle n'arrive pas, on affiche la structure
// locale : un écran de réservation vide serait pire qu'une liste de secours.
const STRUCTURE_LOCALE = {
  etapes: ETAPES, types: TYPES, besoins: BESOINS,
  communes: COMMUNES, fenetres: FENETRES, paiements: PAIEMENTS,
};

let memo = null; // une seule requête par onglet

export function useStructure() {
  const [structure, setStructure] = useState(memo || STRUCTURE_LOCALE);
  const [pret, setPret] = useState(!!memo);

  useEffect(() => {
    if (memo) return;
    let annule = false;
    fetch("/api/parcours")
      .then((r) => r.json())
      .then((d) => {
        if (annule || !d?.etapes) return;
        memo = d;
        setStructure(d);
        setPret(true);
      })
      .catch(() => { if (!annule) setPret(true); });
    return () => { annule = true; };
  }, []);

  return { structure, pret };
}

// Intitulé d'un type de demande. Les types du code portent une clé de
// traduction ; ceux configurés en back-office portent leur texte tel quel.
export function libelleType(ty, t, langue) {
  if (!ty) return "";
  if (ty.texte) return langue === "ar" && ty.texteAr ? ty.texteAr : ty.texte;
  return t(ty.libelle);
}
