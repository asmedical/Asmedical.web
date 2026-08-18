#!/usr/bin/env bash
# Rend le VPS capable de tenir debout sans surveillance.
#
#   sudo bash scripts/vps/sante-vps.sh
#
# Deux causes ont fait tomber l'émulateur trois fois :
#
#   1. Aucun fichier d'échange. 7,6 Go de mémoire, l'émulateur, Metro et
#      Chromium ensemble : le système en tue un dès qu'il manque de place.
#   2. systemd relance bien le service, mais un émulateur peut rester
#      « actif » sans qu'aucun appareil ne réponde — le service tourne, adb
#      ne voit rien, et personne ne le sait avant d'essayer de s'en servir.
#
# Ce script pose le fichier d'échange et une surveillance qui regarde ce
# qu'adb voit vraiment, pas ce que systemd croit. Il est rejouable.

set -euo pipefail

UTILISATEUR="${SUDO_USER:-$(id -un)}"
MAISON="$(getent passwd "$UTILISATEUR" | cut -d: -f6)"
TAILLE_ECHANGE="${TAILLE_ECHANGE:-4G}"

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer avec sudo." >&2
  exit 1
fi

CHEMIN_ADB="$(sudo -u "$UTILISATEUR" bash -lc 'command -v adb' || true)"
[ -z "$CHEMIN_ADB" ] && [ -x "$MAISON/android/platform-tools/adb" ] && CHEMIN_ADB="$MAISON/android/platform-tools/adb"
if [ -z "$CHEMIN_ADB" ]; then
  echo "adb introuvable." >&2
  exit 1
fi
echo "adb : $CHEMIN_ADB"
echo

# --- 1. Fichier d'échange -------------------------------------------------
if [ "$(swapon --show --noheadings | wc -l)" -gt 0 ]; then
  echo "Fichier d'échange déjà en place :"
  swapon --show
else
  DISPO_MO="$(df --output=avail -m / | tail -1 | tr -d ' ')"
  # Refuser plutôt que remplir le disque : un disque plein casse tout le
  # reste, y compris les services qui marchaient.
  if [ "$DISPO_MO" -lt 6144 ]; then
    echo "Espace disque insuffisant pour un fichier d'échange (${DISPO_MO} Mo libres)." >&2
    echo "Libérer de la place, puis relancer." >&2
    exit 1
  fi
  echo "Création du fichier d'échange ($TAILLE_ECHANGE)…"
  fallocate -l "$TAILLE_ECHANGE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Posé, et rétabli au redémarrage."
fi
echo

# --- 2. Surveillance de l'émulateur ---------------------------------------
# systemd surveille le processus ; nous surveillons le résultat. Un émulateur
# vivant mais muet est exactement le cas qui n'était pas rattrapé.
cat > /usr/local/bin/surveiller-emulateur.sh <<SCRIPT
#!/usr/bin/env bash
set -u
ADB="$CHEMIN_ADB"
# « device » et rien d'autre : « offline » ou « unauthorized » ne sert à rien.
if "\$ADB" devices 2>/dev/null | grep -qE '^emulator-[0-9]+[[:space:]]+device\$'; then
  exit 0
fi
echo "Aucun émulateur utilisable — relance de emulateur-asm."
systemctl restart emulateur-asm
SCRIPT
chmod +x /usr/local/bin/surveiller-emulateur.sh

cat > /etc/systemd/system/surveillance-emulateur.service <<UNITE
[Unit]
Description=Surveillance de l'émulateur ASM
After=emulateur-asm.service

[Service]
Type=oneshot
User=$UTILISATEUR
ExecStart=/usr/local/bin/surveiller-emulateur.sh
UNITE

# Deux minutes après le démarrage : le temps que l'émulateur boote sans
# être relancé pour rien. Puis toutes les trois minutes.
cat > /etc/systemd/system/surveillance-emulateur.timer <<MINUTERIE
[Unit]
Description=Vérifie toutes les 3 minutes que l'émulateur répond

[Timer]
OnBootSec=2min
OnUnitActiveSec=3min

[Install]
WantedBy=timers.target
MINUTERIE

systemctl daemon-reload
systemctl enable --now surveillance-emulateur.timer >/dev/null
echo "Surveillance active : l'émulateur se relèvera tout seul."
echo

# --- 3. État --------------------------------------------------------------
echo "Mémoire :"
free -h | head -3
echo
echo "Services :"
systemctl is-active emulateur-asm metro-asm mcp-maestro mcp-metro mcp-playwright mcp-oauth caddy || true
echo
echo "Appareils :"
sudo -u "$UTILISATEUR" "$CHEMIN_ADB" devices
echo
echo "Prochaine vérification automatique :"
systemctl list-timers surveillance-emulateur.timer --no-pager | head -2
