#!/usr/bin/env bash
# Ajoute une route à la passerelle MCP, sans toucher aux autres.
#
#   sudo bash scripts/vps/ajouter-cible.sh metro 8767
#   sudo bash scripts/vps/ajouter-cible.sh playwright 8769 /etc/asm/mcp.env
#
# La passerelle lit CIBLES="nom:port,nom:port". Écrire cette ligne à la main
# depuis chaque script d'installation revenait à l'écraser : installer
# Playwright coupait Metro, et inversement. Ici, un nom déjà présent est
# remplacé, les autres sont conservés.
#
# N'écrit rien si la valeur ne change pas : inutile de redémarrer la
# passerelle, qui déconnecterait les connecteurs le temps du redémarrage.

set -euo pipefail

NOM="${1:?nom de la route attendu}"
PORT="${2:?port attendu}"
FICHIER="${3:-/etc/asm/mcp.env}"

case "$NOM" in
  *[!a-z0-9-]*|"")
    echo "Nom de route invalide : « $NOM » (lettres minuscules, chiffres, tirets)" >&2
    exit 1
    ;;
esac
case "$PORT" in
  ''|*[!0-9]*)
    echo "Port invalide : « $PORT »" >&2
    exit 1
    ;;
esac

touch "$FICHIER"
ACTUEL="$(sed -n 's/^CIBLES=//p' "$FICHIER" | tail -1)"

# On remplace la route à SA place, sans réordonner les autres : sinon une
# simple relance produit une ligne différente, donc un redémarrage de la
# passerelle pour rien.
NOUVEAU=""
TROUVE=0
IFS=',' read -ra ROUTES <<< "$ACTUEL"
for route in ${ROUTES[@]+"${ROUTES[@]}"}; do
  [ -z "$route" ] && continue
  if [ "${route%%:*}" = "$NOM" ]; then
    route="$NOM:$PORT"
    TROUVE=1
  fi
  NOUVEAU="${NOUVEAU:+$NOUVEAU,}$route"
done
[ "$TROUVE" = 1 ] || NOUVEAU="${NOUVEAU:+$NOUVEAU,}$NOM:$PORT"

if [ "$ACTUEL" = "$NOUVEAU" ]; then
  echo "Route « $NOM » déjà en place ($NOUVEAU) — rien à changer."
  exit 0
fi

if grep -q '^CIBLES=' "$FICHIER"; then
  sed -i "s|^CIBLES=.*|CIBLES=$NOUVEAU|" "$FICHIER"
else
  echo "CIBLES=$NOUVEAU" >> "$FICHIER"
fi

echo "Routes de la passerelle : $NOUVEAU"
