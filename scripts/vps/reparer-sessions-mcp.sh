#!/usr/bin/env bash
# Empêche les serveurs MCP de laisser des processus derrière eux.
#
#   sudo bash scripts/vps/reparer-sessions-mcp.sh
#
# Le problème : supergateway lance un processus enfant par session, et ne le
# tue qu'à la fermeture propre de la connexion. Or les connecteurs sautent
# sans se fermer proprement plusieurs fois par jour. Neuf machines virtuelles
# Maestro ont ainsi été retrouvées vivantes, jusqu'à 45 minutes chacune,
# 1,6 Go à elles seules — sur une machine qui n'a que 7,6 Go et dont le
# fichier d'échange était déjà plein.
#
# Le mode par défaut n'a aucun délai d'expiration : rien ne ramasse jamais
# une session abandonnée. Le mode « stateful » en a un.
#
# Le script ajoute les deux options aux services qui passent par
# supergateway, sauvegarde les fichiers d'origine, et redémarre — ce qui tue
# au passage les processus déjà abandonnés.

set -euo pipefail

# Dix minutes : assez long pour qu'une coupure réseau passagère ne ferme pas
# une session en cours d'utilisation, assez court pour que les oubliés ne
# s'accumulent pas.
DELAI_MS="${DELAI_MS:-600000}"
SERVICES="${*:-mcp-maestro mcp-metro}"

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo." >&2
  exit 1
fi

echo "Avant :"
ps -eo rss,args --sort=-rss | grep "[m]aestro.cli.AppKt" | wc -l | xargs echo "  machines virtuelles Maestro :"
free -h | sed -n '2,3p'
echo

MODIFIES=0
for service in $SERVICES; do
  FICHIER="/etc/systemd/system/${service}.service"
  if [ ! -f "$FICHIER" ]; then
    echo "— $service : fichier absent, ignoré."
    continue
  fi
  if ! grep -q 'supergateway' "$FICHIER"; then
    echo "— $service : ne passe pas par supergateway, ignoré."
    continue
  fi
  if grep -q '\-\-stateful' "$FICHIER"; then
    echo "— $service : déjà corrigé."
    continue
  fi

  cp "$FICHIER" "${FICHIER}.avant-sessions"
  # Les options s'ajoutent à la fin de la dernière ligne de la commande.
  # Une commande sur plusieurs lignes se termine par « \ » sur toutes sauf
  # la dernière : c'est celle-là qu'on complète.
  python3 - "$FICHIER" "$DELAI_MS" <<'PYTHON'
import re, sys
chemin, delai = sys.argv[1], sys.argv[2]
lignes = open(chemin, encoding="utf-8").read().split("\n")
debut = next(i for i, l in enumerate(lignes) if l.startswith("ExecStart="))
fin = debut
while lignes[fin].rstrip().endswith("\\"):
    fin += 1
lignes[fin] = lignes[fin].rstrip() + f" --stateful --sessionTimeout {delai}"
open(chemin, "w", encoding="utf-8").write("\n".join(lignes))
PYTHON
  echo "— $service : corrigé (sauvegarde dans ${FICHIER}.avant-sessions)"
  MODIFIES=$((MODIFIES + 1))
done
echo

if [ "$MODIFIES" -eq 0 ]; then
  echo "Rien à changer."
  exit 0
fi

systemctl daemon-reload
for service in $SERVICES; do
  [ -f "/etc/systemd/system/${service}.service" ] && systemctl restart "$service" || true
done

# Redémarrer un service tue tout ce qu'il avait lancé : les oubliés partent
# avec. On laisse le temps aux nouveaux de s'installer avant de compter.
sleep 5

echo "Après :"
ps -eo rss,args --sort=-rss | grep -c "[m]aestro.cli.AppKt" | xargs echo "  machines virtuelles Maestro :"
free -h | sed -n '2,3p'
echo
systemctl is-active $SERVICES || true
echo
echo "Les connecteurs Maestro et Metro sont à reconnecter dans Claude."
