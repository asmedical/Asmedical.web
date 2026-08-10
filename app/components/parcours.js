"use client";
import { useEffect, useState } from "react";
import { ETAPES, numeroEtape } from "@/lib/parcours";

// Éléments communs au parcours de réservation. La structure vient de
// lib/parcours.js — partagée avec l'application ; seul le rendu est propre
// au site.

// Indicateur de progression. Il reste affiché à chaque étape : sans lui, un
// formulaire long donne l'impression de ne jamais finir.
export function Stepper({ etape }) {
  const courant = numeroEtape(etape);
  return (
    <div className="pc-stepper" role="progressbar" aria-valuenow={courant} aria-valuemin={1} aria-valuemax={ETAPES.length}>
      {ETAPES.map((e, i) => {
        const n = i + 1;
        const classe = n < courant ? "fait" : n === courant ? "actif" : "";
        return (
          <span className={"pc-pas " + classe} key={e.cle}>
            <span className="pc-rond">{n}</span>
            {i < ETAPES.length - 1 && <span className="pc-trait" />}
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
