#!/usr/bin/env bash
# Compile la version Android et l'envoie à Google, sans passer par un
# téléchargement de fichier .aab.
#
#   bash scripts/vps/publier-android.sh            # test fermé (par défaut)
#   bash scripts/vps/publier-android.sh production  # production
#
# La compilation tourne chez Expo, pas sur le VPS : la machine n'a qu'à
# lancer l'ordre et attendre. Le fichier .aab ne descend jamais ici — c'est
# Expo qui le remet directement à Google.
#
# Le profil d'envoi décide de la piste Play (mobile/eas.json) :
#   ferme      -> piste « alpha » (test fermé)
#   production -> piste « internal »
# Si la piste de test fermé porte un autre nom dans Play Console, c'est la
# seule valeur à changer dans mobile/eas.json.
#
# À faire UNE fois avant le premier envoi :
#   - déposer la clé du compte de service Google chez Expo :
#       cd mobile && eas credentials --platform android
#     (« Google Service Account » → indiquer le fichier .json)
#     Rien n'est conservé sur le VPS : le secret vit chez Expo, comme la clé
#     de signature.

set -euo pipefail

PROFIL_ENVOI="${1:-ferme}"
DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

case "$PROFIL_ENVOI" in
  ferme|production) ;;
  *)
    echo "Profil inconnu : $PROFIL_ENVOI (attendu : ferme ou production)" >&2
    exit 1
    ;;
esac

cd "$DEPOT"

# --- Ce qui part doit être ce qui est dans main -----------------------------
# eas empaquette les fichiers du disque, pas un commit. Un dépôt en retard
# publie l'ancienne version sans que rien ne le signale : c'est arrivé sur un
# OTA, la ligne « Commit » affichait un commit périmé.
if [ -n "$(git status --porcelain)" ]; then
  echo "Le dépôt contient des modifications non enregistrées." >&2
  echo "Publier maintenant enverrait autre chose que main. Arrêt." >&2
  git status --short >&2
  exit 1
fi

echo "Mise à jour depuis main…"
git checkout main
git pull --ff-only origin main
COMMIT="$(git log --oneline -1)"
echo "Version publiée : $COMMIT"
echo

# --- Dépendances ------------------------------------------------------------
# Synchroniser À CHAQUE FOIS, pas seulement quand le dossier manque. Un
# greffon ajouté dans app.json mais absent de node_modules fait échouer
# « expo config » — et donc la compilation — au bout de quelques secondes,
# avec un message qui ne nomme pas le paquet manquant. C'est exactement ce
# qui est arrivé en ajoutant expo-splash-screen.
echo "Synchronisation des dépendances mobiles…"
(cd "$DEPOT/mobile" && npm ci --no-audit --no-fund) || {
  echo "npm ci a échoué — verrou et package.json désaccordés ?" >&2
  exit 1
}

# Contrôle avant de lancer vingt minutes de compilation : si la configuration
# ne se lit pas ici, elle ne se lira pas mieux chez Expo.
echo "Lecture de la configuration…"
(cd "$DEPOT/mobile" && npx expo config --json > /dev/null) || {
  echo "La configuration de l'application est illisible. Compilation annulée." >&2
  echo "Souvent : un greffon déclaré dans app.json et absent des dépendances." >&2
  exit 1
}

# --- Compilation et envoi ---------------------------------------------------
# --auto-submit-with-profile enchaîne les deux : dès que la compilation est
# finie chez Expo, le fichier part chez Google. Rien à récupérer à la main.
#
# Sans EXPO_TOKEN, eas se sert de la session ouverte par « eas login ». Le
# jeton n'est utile que pour un lancement sans personne devant l'écran.
cd "$DEPOT/mobile"
echo "Compilation Android puis envoi à Google (piste : $PROFIL_ENVOI)…"
echo "Compte une vingtaine de minutes. Ne ferme pas la session."
echo

eas build \
  --platform android \
  --profile production \
  --auto-submit-with-profile "$PROFIL_ENVOI" \
  --non-interactive \
  --message "$COMMIT"

echo
echo "Envoyé. Vérifie l'arrivée dans Play Console :"
echo "  https://play.google.com/console/u/3/developers/5586483690568979066/app/4973644369963784510/tracks"
