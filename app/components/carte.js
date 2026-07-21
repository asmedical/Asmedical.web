"use client";
import { useEffect, useRef } from "react";

// Carte Google Maps (web) — chargée UNIQUEMENT si la clé navigateur
// NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY est posée (clé restreinte par domaine
// dans Google Cloud : c'est la protection prévue par Google pour les clés
// de carte, qui sont par nature visibles du navigateur). Sans clé, le
// composant ne rend rien — aucune régression.
//
// Affiche : départ (A), arrivée (B), l'itinéraire calculé (polyline) et,
// en option, la position du véhicule mise à jour en direct.

const CLE_JS = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY || "";
let chargement = null;

function chargerMapsJs() {
  if (!CLE_JS) return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!chargement) {
    chargement = new Promise((resoudre) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${CLE_JS}&v=weekly&language=fr&region=DZ&loading=async&callback=__asmMapsPrete`;
      window.__asmMapsPrete = () => resoudre(window.google.maps);
      s.onerror = () => resoudre(null);
      document.head.appendChild(s);
    });
  }
  return chargement;
}

// Décodage d'une polyline encodée Google (algorithme officiel, ~20 lignes —
// évite de facturer un appel de plus juste pour redessiner le trajet).
export function decoderPolyline(encodee) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  const chaine = String(encodee || "");
  while (index < chaine.length) {
    for (const cible of ["lat", "lng"]) {
      let resultat = 0, decalage = 0, octet;
      do {
        octet = chaine.charCodeAt(index++) - 63;
        resultat |= (octet & 0x1f) << decalage;
        decalage += 5;
      } while (octet >= 0x20);
      const delta = resultat & 1 ? ~(resultat >> 1) : resultat >> 1;
      if (cible === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function carteDisponible() {
  return Boolean(CLE_JS);
}

export default function CarteTrajet({ depart, destination, polyline, position, hauteur = 240 }) {
  const conteneur = useRef(null);
  const carte = useRef(null);
  const marqueurVehicule = useRef(null);

  useEffect(() => {
    if (!CLE_JS || !conteneur.current) return;
    let annule = false;
    chargerMapsJs().then((maps) => {
      if (!maps || annule || !conteneur.current) return;
      if (!carte.current) {
        carte.current = new maps.Map(conteneur.current, {
          center: depart || destination || { lat: 36.7525, lng: 3.042 }, // Alger
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
      }
      const m = carte.current;
      const bornes = new maps.LatLngBounds();
      if (depart) {
        new maps.Marker({ map: m, position: depart, label: "A", title: "Départ" });
        bornes.extend(depart);
      }
      if (destination) {
        new maps.Marker({ map: m, position: destination, label: "B", title: "Arrivée" });
        bornes.extend(destination);
      }
      if (polyline) {
        const chemin = decoderPolyline(polyline);
        new maps.Polyline({ map: m, path: chemin, strokeColor: "#0E6B3F", strokeWeight: 4, strokeOpacity: 0.85 });
        chemin.forEach((p) => bornes.extend(p));
      }
      if (!bornes.isEmpty()) m.fitBounds(bornes, 40);
    });
    return () => { annule = true; };
    // La carte de base ne se reconstruit pas à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depart?.lat, depart?.lng, destination?.lat, destination?.lng, polyline]);

  // Position du véhicule : marqueur déplacé sans recréer la carte.
  useEffect(() => {
    if (!CLE_JS || !position) return;
    chargerMapsJs().then((maps) => {
      if (!maps || !carte.current) return;
      if (!marqueurVehicule.current) {
        marqueurVehicule.current = new maps.Marker({
          map: carte.current,
          position,
          title: "Votre véhicule",
          icon: {
            path: maps.SymbolPath.CIRCLE, scale: 8,
            fillColor: "#0E6B3F", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2,
          },
        });
      } else {
        marqueurVehicule.current.setPosition(position);
      }
    });
  }, [position?.lat, position?.lng, position]);

  if (!CLE_JS) return null;
  return <div ref={conteneur} className="carte-trajet" style={{ height: hauteur }} />;
}
