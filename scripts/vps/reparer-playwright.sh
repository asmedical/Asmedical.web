#!/usr/bin/env bash
# Donne à Playwright le navigateur et les bibliothèques qui lui manquent.
#
#   sudo bash scripts/vps/reparer-playwright.sh
#
# Symptôme : chaque commande du connecteur expire à 60 secondes, et le
# journal du service ne montre rien — l'échec se produit à l'intérieur de
# l'appel, pas au démarrage.
#
# Deux causes, et elles vont ensemble :
#
#   1. Il manque les bibliothèques système de Chromium. La sortie d'Expo
#      l'avait déjà laissé voir : « libgtk-3.so.0: cannot open shared object
#      file ». Sans elles, le navigateur ne démarre pas, même sans écran.
#   2. Le navigateur installé ne correspond pas. Playwright ne cherche que
#      la version exacte liée à sa propre version ; celle du VPS était la
#      1.62, alors que @playwright/mcp embarque la 1.63.
#
# Le numéro de version n'est PAS écrit en dur ici : il est demandé au paquet.
# Figé, il se serait démodé au premier « @latest » et le navigateur aurait
# de nouveau été introuvable, avec le même silence de 60 secondes.

set -euo pipefail

UTILISATEUR="${SUDO_USER:-$(id -un)}"
MAISON="$(getent passwd "$UTILISATEUR" | cut -d: -f6)"

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo : les bibliothèques système s'installent en root." >&2
  exit 1
fi

# Lancé en root SANS sudo, on ne sait pas pour qui installer le navigateur :
# il atterrirait dans le cache de root, et le service — qui tourne sous un
# autre compte — ne le trouverait pas. Même panne, même silence de 60
# secondes, mais une cause de plus à chercher.
if [ -z "${SUDO_USER:-}" ]; then
  echo "Lancer « sudo bash $0 » depuis le compte qui fait tourner le service," >&2
  echo "pas depuis une session root : le navigateur doit être installé pour lui." >&2
  exit 1
fi

echo "Version de Playwright attendue par @playwright/mcp…"
VERSION="$(npm view @playwright/mcp dependencies.playwright 2>/dev/null | tr -d '^~ ')"
if [ -z "$VERSION" ]; then
  echo "Impossible de lire la version depuis npm. Réseau ?" >&2
  exit 1
fi
echo "  $VERSION"
echo

# --- Bibliothèques système, en root ---------------------------------------
echo "Installation des bibliothèques système (quelques minutes)…"
npx -y "playwright@$VERSION" install-deps chromium

# --- Navigateur, sous l'identité du service --------------------------------
# Le service tourne en tant qu'utilisateur : le navigateur doit atterrir dans
# SON cache (~/.cache/ms-playwright). Installé en root, il serait déposé chez
# root et resterait introuvable — même erreur, autre chemin.
echo
echo "Installation de Chromium pour $UTILISATEUR…"
sudo -u "$UTILISATEUR" npx -y "playwright@$VERSION" install chromium

echo
systemctl restart mcp-playwright
sleep 10

CODE=$(curl -s -o /dev/null -m 15 -w '%{http_code}' http://127.0.0.1:8769/mcp 2>/dev/null)
echo "Le serveur répond : ${CODE:-000}"
echo
echo "Navigateurs présents :"
# Entre guillemets, « ~ubuntu » ne s'ouvre pas : le chemin restait littéral
# et le script annonçait « aucun » juste après avoir tout téléchargé.
ls "$MAISON/.cache/ms-playwright" 2>/dev/null | sed 's/^/  /' || echo "  (aucun)"
echo
echo "Reconnecte le connecteur Playwright ASM dans Claude, puis demande un"
echo "essai de navigation : c'est le seul contrôle qui compte."
