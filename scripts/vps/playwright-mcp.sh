#!/usr/bin/env bash
# Installe Playwright MCP sur le VPS ASM et l'expose derrière la passerelle,
# sous le chemin /playwright de la même adresse.
#
#   sudo bash scripts/vps/playwright-mcp.sh
#
# Pourquoi : Maestro permet de piloter l'application, mais rien ne permettait
# de piloter le SITE. Or le parcours de réservation n'y a jamais tourné en
# vrai — et le site, c'est la moitié du produit.
#
# Contrairement à Maestro et Metro, Playwright MCP sait servir en HTTP tout
# seul (--port). Pas de supergateway ici : une pièce de moins à surveiller.

set -euo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UTILISATEUR="${SUDO_USER:-$(id -un)}"
ENVIRONNEMENT=/etc/asm/mcp.env
PORT_MCP=8769

echo "Dépôt        : $DEPOT"
echo "Utilisateur  : $UTILISATEUR"
echo

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo." >&2
  exit 1
fi

command -v node >/dev/null || { echo "node introuvable." >&2; exit 1; }
echo "node         : $(node -v)"
echo

# --- 1. Le service --------------------------------------------------------
# --headless : aucun écran sur un VPS, le navigateur ne démarrerait pas.
# --isolated : le profil reste en mémoire. Un profil sur disque ne peut
#   servir qu'à un navigateur à la fois ; deux sessions se bloqueraient.
# --host 127.0.0.1 : seule la passerelle doit pouvoir joindre ce port. Sans
#   ça, l'adresse publique donnerait un navigateur à qui la trouve.
# --allowed-hosts '*' : Playwright refuse par défaut tout en-tête Host autre
#   que celui auquel il est lié, et renvoie 403 avant même de regarder la
#   requête. Ce contrôle protège d'un serveur exposé au réseau ; ici le port
#   n'écoute que sur la boucle locale et la seule porte d'entrée est la
#   passerelle, avec sa phrase de passe. Le désactiver n'ouvre rien de plus.
cat > /etc/systemd/system/mcp-playwright.service <<UNITE
[Unit]
Description=Playwright MCP — pilotage du site ASM
After=network-online.target

[Service]
Type=simple
User=$UTILISATEUR
WorkingDirectory=$DEPOT
ExecStart=/usr/bin/env npx -y @playwright/mcp@latest \\
  --headless \\
  --browser chromium \\
  --no-sandbox \\
  --isolated \\
  --host 127.0.0.1 \\
  --allowed-hosts '*' \\
  --port $PORT_MCP
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITE

# --- 2. La route dans la passerelle ---------------------------------------
bash "$DEPOT/scripts/vps/ajouter-cible.sh" playwright "$PORT_MCP" "$ENVIRONNEMENT"
echo

systemctl daemon-reload
systemctl enable --now mcp-playwright >/dev/null
systemctl restart mcp-playwright mcp-oauth

# --- 3. État --------------------------------------------------------------
echo "État des services :"
systemctl is-active emulateur-asm metro-asm mcp-maestro mcp-metro mcp-playwright mcp-oauth caddy || true
echo
echo "Le premier démarrage télécharge @playwright/mcp : compte une minute."
echo
echo "Vérification :"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:$PORT_MCP/mcp"
echo
echo "Adresse à donner au connecteur Claude :"
echo "  https://mcp.asm-sante.com/playwright/mcp"
