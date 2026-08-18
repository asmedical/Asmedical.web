#!/usr/bin/env bash
# Contrôle complet du VPS ASM, en une commande.
#
#   bash scripts/vps/verifier-asm.sh            # regarde et rend compte
#   sudo bash scripts/vps/verifier-asm.sh --reparer   # répare ce qui peut l'être
#
# Écrit pour remplacer les cinq commandes qu'il fallait taper à chaque fois
# pour savoir où on en était. Sans « --reparer », le script ne touche à rien.
#
# Ce qu'il ne peut PAS faire : autoriser les connecteurs dans Claude. C'est
# une autorisation liée au compte, elle passe forcément par les réglages.

set -uo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPARER=0
[ "${1:-}" = "--reparer" ] && REPARER=1

PROBLEMES=0
ACTIONS=()

ok()      { printf '  \033[32mok\033[0m    %s\n' "$1"; }
souci()   { printf '  \033[31mSOUCI\033[0m %s\n' "$1"; PROBLEMES=$((PROBLEMES+1)); }
info()    { printf '        %s\n' "$1"; }
titre()   { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Sous sudo, $HOME devient /root et adb reste introuvable. Le serveur adb
# appartient de toute façon à l'utilisateur, pas à root : on l'interroge
# sous son identité.
UTILISATEUR="${SUDO_USER:-$(id -un)}"
MAISON="$(getent passwd "$UTILISATEUR" | cut -d: -f6)"
CHEMIN_ADB="$(command -v adb 2>/dev/null || true)"
[ -z "$CHEMIN_ADB" ] && [ -x "$MAISON/android/platform-tools/adb" ] && CHEMIN_ADB="$MAISON/android/platform-tools/adb"
adb_() { sudo -n -u "$UTILISATEUR" "$CHEMIN_ADB" "$@" 2>/dev/null || "$CHEMIN_ADB" "$@" 2>/dev/null; }

# --- Mémoire ---------------------------------------------------------------
titre "Mémoire"
LIBRE_MO=$(free -m | awk '/^Mem:/ {print $7}')
ECHANGE_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
ECHANGE_LIBRE=$(free -m | awk '/^Swap:/ {print $4}')

if [ "$ECHANGE_TOTAL" -eq 0 ]; then
  souci "aucun fichier d'échange — l'émulateur sera tué à la première pointe"
  ACTIONS+=("sudo bash $DEPOT/scripts/vps/sante-vps.sh")
elif [ "$ECHANGE_LIBRE" -lt 256 ]; then
  souci "fichier d'échange presque plein (${ECHANGE_LIBRE} Mo libres sur ${ECHANGE_TOTAL})"
  info "quelque chose fuit — voir « processus abandonnés » plus bas"
else
  ok "échange : ${ECHANGE_LIBRE} Mo libres sur ${ECHANGE_TOTAL}"
fi

if [ "$LIBRE_MO" -lt 500 ]; then
  souci "mémoire disponible : ${LIBRE_MO} Mo — c'est la zone où le système tue des processus"
else
  ok "mémoire disponible : ${LIBRE_MO} Mo"
fi

# --- Processus abandonnés --------------------------------------------------
titre "Processus abandonnés"
# Chaque session MCP laisse une machine virtuelle si supergateway n'a pas de
# délai d'expiration. Elles s'accumulaient jusqu'à saturer la machine.
# On ne compte que de vrais processus « java ». « pgrep -f » attrapait aussi
# le shell dont la ligne de commande contenait le mot cherché — et « -c »
# imprime « 0 » puis sort en erreur, si bien qu'un repli y collait un second
# zéro et cassait la comparaison. awk imprime toujours un nombre.
ORPHELINS=$(ps -eo comm=,args= | awk '$1 == "java" && /maestro\.cli\.AppKt/ {n++} END {print n+0}')
if [ "$ORPHELINS" -gt 3 ]; then
  souci "$ORPHELINS machines virtuelles Maestro — au-delà de 3, elles s'accumulent"
  ACTIONS+=("sudo bash $DEPOT/scripts/vps/reparer-sessions-mcp.sh")
else
  ok "$ORPHELINS machine(s) virtuelle(s) Maestro"
fi

for unite in mcp-maestro mcp-metro; do
  FICHIER="/etc/systemd/system/${unite}.service"
  if [ -f "$FICHIER" ] && grep -q supergateway "$FICHIER" && ! grep -q -- '--stateful' "$FICHIER"; then
    souci "$unite n'expire pas ses sessions abandonnées"
    ACTIONS+=("sudo bash $DEPOT/scripts/vps/reparer-sessions-mcp.sh")
  fi
done

# --- Services --------------------------------------------------------------
titre "Services"
for unite in emulateur-asm metro-asm mcp-maestro mcp-metro mcp-playwright mcp-oauth caddy; do
  ETAT=$(systemctl is-active "$unite" 2>/dev/null || true)
  if [ "$ETAT" = "active" ]; then ok "$unite"; else
    souci "$unite : $ETAT"
    ACTIONS+=("sudo systemctl restart $unite && journalctl -u $unite -n 20 --no-pager")
  fi
done

ETAT_MINUTERIE=$(systemctl is-active surveillance-emulateur.timer 2>/dev/null || true)
if [ "$ETAT_MINUTERIE" = "active" ]; then
  ok "surveillance-emulateur.timer"
else
  souci "surveillance de l'émulateur absente — il ne se relèvera pas tout seul"
  ACTIONS+=("sudo bash $DEPOT/scripts/vps/sante-vps.sh")
fi

# --- Émulateur -------------------------------------------------------------
titre "Émulateur"
if [ -z "$CHEMIN_ADB" ]; then
  souci "adb introuvable"
  ACTIONS+=("export PATH=\$PATH:$MAISON/android/platform-tools")
elif adb_ devices | grep -qE '^emulator-[0-9]+[[:space:]]+device$'; then
  ok "un appareil répond"
else
  souci "aucun appareil utilisable"
  info "$(adb_ devices | tail -n +2 | tr '\n' ' ')"
  ACTIONS+=("sudo systemctl restart emulateur-asm   # puis attendre 90 s")
fi

# --- Serveurs MCP, en local ------------------------------------------------
titre "Serveurs MCP (en local)"
# curl écrit toujours %{http_code}, y compris « 000 » quand rien ne répond.
# Ajouter un « || echo 000 » collait un second code au premier — « 000000 »
# ne correspondait plus à rien et un port mort passait pour bon.
interroger() {
  local code
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$1" 2>/dev/null)
  printf '%s' "${code:-000}"
}

verifier_port() {
  local nom="$1" port="$2" chemin="$3"
  local code
  code=$(interroger "http://127.0.0.1:${port}${chemin}")
  case "$code" in
    000)     souci "$nom (port $port) : aucune réponse" ;;
    403)     souci "$nom (port $port) : refuse la requête (403)" ;;
    5[0-9][0-9]) souci "$nom (port $port) : erreur $code" ;;
    # 400, 405 et 406 sont normaux ici : le serveur répond et négocie, il
    # manque juste les en-têtes MCP qu'une requête nue n'envoie pas.
    *)       ok "$nom (port $port) : répond $code" ;;
  esac
}
verifier_port "Maestro"    8765 /mcp
verifier_port "Metro"      8767 /mcp
verifier_port "Playwright" 8769 /mcp
verifier_port "Metro (Expo)" 8081 /status

# --- La passerelle, vue de l'extérieur -------------------------------------
titre "Adresse publique"
CODE=$(interroger https://mcp.asm-sante.com/.well-known/oauth-authorization-server)
if [ "$CODE" = "200" ]; then
  ok "https://mcp.asm-sante.com répond"
else
  souci "https://mcp.asm-sante.com : $CODE"
  ACTIONS+=("sudo systemctl restart caddy mcp-oauth")
fi

# --- Réparation ------------------------------------------------------------
if [ "$REPARER" -eq 1 ] && [ ${#ACTIONS[@]} -gt 0 ]; then
  titre "Réparation"
  if [ "$(id -u)" -ne 0 ]; then
    echo "  --reparer demande sudo." >&2
  else
    # Chaque correctif n'est lancé qu'une fois, même si plusieurs contrôles
    # l'ont réclamé.
    printf '%s\n' "${ACTIONS[@]}" | awk '!vu[$0]++' | while read -r commande; do
      case "$commande" in
        *sante-vps.sh|*reparer-sessions-mcp.sh)
          echo "  → $commande"; bash ${commande#sudo } ;;
        *) echo "  à lancer à la main : $commande" ;;
      esac
    done
    echo
    echo "  Relance le contrôle pour vérifier."
  fi
fi

# --- Conclusion ------------------------------------------------------------
titre "Conclusion"
if [ "$PROBLEMES" -eq 0 ]; then
  echo "  Tout répond. Il ne reste qu'à reconnecter les connecteurs dans Claude"
  echo "  s'ils affichent « session expirée » — ça, aucune commande ne peut le faire."
else
  echo "  $PROBLEMES point(s) à corriger :"
  if [ ${#ACTIONS[@]} -gt 0 ]; then
    printf '%s\n' "${ACTIONS[@]}" | awk '!vu[$0]++' | sed 's/^/    /'
  fi
  echo
  echo "  Ou, pour tout ce qui est automatisable :"
  echo "    sudo bash $DEPOT/scripts/vps/verifier-asm.sh --reparer"
fi
echo
exit 0
