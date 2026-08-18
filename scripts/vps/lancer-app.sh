#!/usr/bin/env bash
# Fait tourner l'application à jour sur l'émulateur, sans attendre une
# compilation.
#
#   bash scripts/vps/lancer-app.sh
#
# L'apk installé sur l'émulateur embarque le code du jour où il a été
# compilé. Il affichait encore l'ancien formulaire de réservation, supprimé
# du dépôt depuis. Recompiler prend vingt minutes ; passer par Metro, qui
# tourne déjà, prend quelques secondes et sert le code de `main` tel quel.
#
# Effet secondaire utile : c'est aussi ce qui rend le connecteur Metro MCP
# capable d'inspecter l'application pendant qu'elle tourne. Sans ça, il
# annonce « aucune application attachée ».

set -uo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UTILISATEUR="${SUDO_USER:-$(id -un)}"
MAISON="$(getent passwd "$UTILISATEUR" | cut -d: -f6)"
PORT_METRO=8081
EXPO_GO=host.exp.exponent

CHEMIN_ADB="$(command -v adb 2>/dev/null || true)"
[ -z "$CHEMIN_ADB" ] && [ -x "$MAISON/android/platform-tools/adb" ] && CHEMIN_ADB="$MAISON/android/platform-tools/adb"
if [ -z "$CHEMIN_ADB" ]; then
  echo "adb introuvable." >&2
  exit 1
fi

if ! "$CHEMIN_ADB" devices | grep -qE '^emulator-[0-9]+[[:space:]]+device$'; then
  echo "Aucun émulateur utilisable. Lancer d'abord :" >&2
  echo "  sudo systemctl restart emulateur-asm" >&2
  exit 1
fi

# Sur l'émulateur, « localhost » désigne l'émulateur lui-même. Sans ce
# renvoi, l'application cherche Metro chez elle et ne trouve rien.
"$CHEMIN_ADB" reverse tcp:$PORT_METRO tcp:$PORT_METRO >/dev/null 2>&1
echo "Renvoi de port posé."

if "$CHEMIN_ADB" shell pm list packages 2>/dev/null | grep -q "$EXPO_GO"; then
  echo "Expo Go est installé."
else
  # « expo start --android » installe Expo Go puis ouvre l'application, mais
  # il veut le port 8081 que le service occupe déjà. On lui laisse la place
  # le temps de l'installation, puis on rend la main au service.
  echo "Expo Go absent — installation (quelques minutes)…"
  ETAIT_ACTIF=$(systemctl is-active metro-asm 2>/dev/null || true)
  [ "$ETAIT_ACTIF" = "active" ] && sudo systemctl stop metro-asm
  (cd "$DEPOT/mobile" && CI=1 npx expo start --android --port $PORT_METRO) &
  BOUCLE=$!
  # Laisser le temps à l'installation, puis rendre le port au service.
  for _ in $(seq 1 60); do
    sleep 5
    "$CHEMIN_ADB" shell pm list packages 2>/dev/null | grep -q "$EXPO_GO" && break
  done
  kill "$BOUCLE" 2>/dev/null
  wait "$BOUCLE" 2>/dev/null
  [ "$ETAIT_ACTIF" = "active" ] && sudo systemctl start metro-asm
  if ! "$CHEMIN_ADB" shell pm list packages 2>/dev/null | grep -q "$EXPO_GO"; then
    echo "Expo Go n'a pas pu être installé. À faire une fois, à la main :" >&2
    echo "  sudo systemctl stop metro-asm" >&2
    echo "  cd $DEPOT/mobile && npx expo start --android" >&2
    exit 1
  fi
  echo "Expo Go installé."
fi

# Laisser Metro reprendre son port avant d'ouvrir l'application.
for _ in $(seq 1 24); do
  curl -s -o /dev/null -m 3 "http://127.0.0.1:$PORT_METRO/status" && break
  sleep 5
done

"$CHEMIN_ADB" shell am start -a android.intent.action.VIEW \
  -d "exp://127.0.0.1:$PORT_METRO" >/dev/null 2>&1
echo "Application ouverte depuis Metro — c'est le code de « main » qui tourne."
echo
echo "Le premier chargement compile le paquet : compte une à deux minutes."
echo "Ensuite, le connecteur Metro ASM verra l'application."
