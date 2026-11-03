#!/usr/bin/env bash
# Gallery Approach: Raspberry Pi kiosk setup
# Written for Raspberry Pi OS (Bookworm, desktop edition). Run from the project folder:
#   bash scripts/pi-setup.sh
# What it does:
#   1. installs Node.js if needed
#   2. runs the companion server as a background service on port 8080
#   3. turns off screen blanking
#   4. opens Chromium full-screen on the app at login (labwc, Wayfire or LXDE, whichever you have)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="${SUDO_USER:-$USER}"
USER_HOME="$(eval echo "~$USER_NAME")"
PORT="${PORT:-8080}"
URL="http://localhost:$PORT"

echo "→ Gallery Approach in $APP_DIR (user $USER_NAME)"

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "→ Installing Node.js"
  sudo apt-get update -y && sudo apt-get install -y nodejs
fi
NODE_BIN="$(command -v node)"

echo "→ Creating the gallery-approach service"
sudo tee /etc/systemd/system/gallery-approach.service >/dev/null <<EOF
[Unit]
Description=Gallery Approach screensaver server
After=network-online.target
Wants=network-online.target

[Service]
User=$USER_NAME
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
ExecStart=$NODE_BIN $APP_DIR/server/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now gallery-approach

echo "→ Disabling screen blanking"
sudo raspi-config nonint do_blanking 1 2>/dev/null || echo "  (raspi-config not found; turn off screen blanking in your desktop settings)"

BROWSER="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$BROWSER" ]; then echo "  Chromium not found. Install it with: sudo apt install chromium-browser"; exit 0; fi
CMD="$BROWSER --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 $URL"

echo "→ Starting Chromium full-screen at login"
# labwc (Raspberry Pi OS Bookworm from late 2024)
mkdir -p "$USER_HOME/.config/labwc"
touch "$USER_HOME/.config/labwc/autostart"
grep -q "gallery-approach" "$USER_HOME/.config/labwc/autostart" || echo "sleep 6; $CMD & # gallery-approach" >> "$USER_HOME/.config/labwc/autostart"
# Wayfire (Bookworm 2023 to 2024)
if [ -f "$USER_HOME/.config/wayfire.ini" ] && ! grep -q "gallery" "$USER_HOME/.config/wayfire.ini"; then
  if grep -q "^\[autostart\]" "$USER_HOME/.config/wayfire.ini"; then
    sed -i "/^\[autostart\]/a gallery = sleep 6; $CMD" "$USER_HOME/.config/wayfire.ini"
  else
    printf "\n[autostart]\ngallery = sleep 6; %s\n" "$CMD" >> "$USER_HOME/.config/wayfire.ini"
  fi
fi
# LXDE / X11 (Bullseye and older)
if [ -d "$USER_HOME/.config/lxsession" ] || [ -d /etc/xdg/lxsession ]; then
  mkdir -p "$USER_HOME/.config/lxsession/LXDE-pi"
  F="$USER_HOME/.config/lxsession/LXDE-pi/autostart"
  [ -f "$F" ] || cp /etc/xdg/lxsession/LXDE-pi/autostart "$F" 2>/dev/null || touch "$F"
  grep -q "gallery-approach" "$F" || { echo "@xset s off"; echo "@xset -dpms"; echo "@$CMD # gallery-approach"; } >> "$F"
fi
chown -R "$USER_NAME" "$USER_HOME/.config" 2>/dev/null || true

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Done. Reboot to start in kiosk mode:  sudo reboot"
echo "Other screens on your Wi-Fi can open:  http://${IP:-<pi-ip>}:$PORT"
echo "Drop photos into: $APP_DIR/photos (subfolders become album names)"
