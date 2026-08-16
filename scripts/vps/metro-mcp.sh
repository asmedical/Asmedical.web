#!/usr/bin/env bash
# Installe Metro MCP sur le VPS ASM et l'expose derrière la passerelle
# existante, sous le chemin /metro de la même adresse.
#
#   sudo bash scripts/vps/metro-mcp.sh
#
# Pourquoi un chemin plutôt qu'un sous-domaine : un sous-domaine imposerait
# un enregistrement DNS et un certificat de plus. Ici, tout passe par
# mcp.asm-sante.com, déjà en place, avec la même phrase de passe.
#
# Trois morceaux sont posés :
#   metro-asm  — le serveur de développement Expo (Metro), port 8081
#   mcp-metro  — metro-mcp, converti en service web par supergateway, 8767
#   mcp-oauth  — la passerelle existante apprend la route /metro
#
# Le script est rejouable : le relancer ne casse rien.

set -euo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UTILISATEUR="${SUDO_USER:-$(id -un)}"
MAISON="$(getent passwd "$UTILISATEUR" | cut -d: -f6)"
ENVIRONNEMENT=/etc/asm/mcp.env
PORT_METRO=8081
PORT_MCP=8767

echo "Dépôt        : $DEPOT"
echo "Utilisateur  : $UTILISATEUR"
echo

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo." >&2
  exit 1
fi

# --- 1. Outils indispensables ------------------------------------------------
# Chercher adb avant tout : sans lui, metro-mcp démarre mais ne voit aucun
# appareil, et l'erreur n'arrive qu'au premier appel, des heures plus tard.
CHEMIN_ADB="$(sudo -u "$UTILISATEUR" bash -lc 'command -v adb' || true)"
if [ -z "$CHEMIN_ADB" ] && [ -x "$MAISON/android/platform-tools/adb" ]; then
  CHEMIN_ADB="$MAISON/android/platform-tools/adb"
fi
if [ -z "$CHEMIN_ADB" ]; then
  echo "adb introuvable. Attendu dans le PATH ou dans $MAISON/android/platform-tools/." >&2
  exit 1
fi
DOSSIER_ADB="$(dirname "$CHEMIN_ADB")"
echo "adb          : $CHEMIN_ADB"

command -v node >/dev/null || { echo "node introuvable." >&2; exit 1; }
echo "node         : $(node -v)"
echo

# --- 2. Dépendances de l'application mobile ---------------------------------
# Metro ne peut pas démarrer sans elles. L'installation est longue : on ne la
# refait pas si elle est déjà là.
if [ ! -d "$DEPOT/mobile/node_modules" ]; then
  echo "Installation des dépendances mobiles (plusieurs minutes)…"
  sudo -u "$UTILISATEUR" bash -lc "cd '$DEPOT/mobile' && npm install --no-audit --no-fund"
else
  echo "Dépendances mobiles déjà installées."
fi
echo

# --- 3. Metro (serveur de développement Expo) -------------------------------
cat > /etc/systemd/system/metro-asm.service <<UNITE
[Unit]
Description=Metro (Expo) — application ASM
After=network-online.target

[Service]
Type=simple
User=$UTILISATEUR
WorkingDirectory=$DEPOT/mobile
Environment=CI=1
Environment=EXPO_NO_TELEMETRY=1
Environment=PATH=$DOSSIER_ADB:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/env npx expo start --port $PORT_METRO
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITE

# --- 4. metro-mcp, servi en HTTP par supergateway ---------------------------
# metro-mcp parle le protocole MCP sur son entrée standard. supergateway le
# transforme en service web, seule forme qu'un connecteur distant sait
# joindre.
cat > /etc/systemd/system/mcp-metro.service <<UNITE
[Unit]
Description=Metro MCP (via supergateway)
After=metro-asm.service
Wants=metro-asm.service

[Service]
Type=simple
User=$UTILISATEUR
WorkingDirectory=$DEPOT/mobile
Environment=PATH=$DOSSIER_ADB:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/env npx -y supergateway \\
  --stdio "npx -y metro-mcp" \\
  --outputTransport streamableHttp \\
  --port $PORT_MCP \\
  --streamableHttpPath /mcp \\
  --healthEndpoint /sante
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNITE

# --- 5. La passerelle apprend la route /metro -------------------------------
# Écrire la ligne entière ici écrasait les routes déjà posées : relancer ce
# script coupait Playwright, et inversement.
bash "$DEPOT/scripts/vps/ajouter-cible.sh" metro "$PORT_MCP" "$ENVIRONNEMENT"
echo

systemctl daemon-reload
systemctl enable --now metro-asm mcp-metro >/dev/null
systemctl restart mcp-metro mcp-oauth

# --- 6. L'émulateur doit pouvoir joindre Metro ------------------------------
# Sur l'émulateur, « localhost » désigne l'émulateur lui-même. Sans ce
# renvoi, l'application cherche Metro chez elle et ne trouve rien.
if sudo -u "$UTILISATEUR" "$CHEMIN_ADB" reverse tcp:$PORT_METRO tcp:$PORT_METRO 2>/dev/null; then
  echo "Renvoi de port posé vers l'émulateur."
  # metro-mcp ne voit que ce qui tourne DEPUIS Metro. L'apk installé, lui,
  # embarque son propre code : il resterait invisible.
  if sudo -u "$UTILISATEUR" "$CHEMIN_ADB" shell pm list packages 2>/dev/null | grep -q host.exp.exponent; then
    sudo -u "$UTILISATEUR" "$CHEMIN_ADB" shell am start -a android.intent.action.VIEW \
      -d "exp://127.0.0.1:$PORT_METRO" >/dev/null 2>&1 || true
    echo "Application ouverte dans Expo Go."
  else
    echo "Expo Go n'est pas installé sur l'émulateur. Une seule fois, à la main :"
    echo "  cd $DEPOT/mobile && npx expo start --android"
  fi
else
  echo "Émulateur absent. Une fois qu'il tourne :"
  echo "  $CHEMIN_ADB reverse tcp:$PORT_METRO tcp:$PORT_METRO"
fi
echo

# --- 7. État ----------------------------------------------------------------
echo "État des services :"
systemctl is-active emulateur-asm metro-asm mcp-metro mcp-oauth caddy || true
echo
echo "Metro met environ une minute à répondre la première fois."
echo
echo "Vérifications :"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:$PORT_METRO/status"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:$PORT_MCP/sante"
echo
echo "Adresse à donner au connecteur Claude :"
echo "  https://mcp.asm-sante.com/metro/mcp"
echo "  (Maestro reste sur https://mcp.asm-sante.com/, inchangé.)"
