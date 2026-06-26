#!/usr/bin/env bash
#
# tester-la-diffusion.sh — vérifie la CHAÎNE d'écoute sans toucher à ta carte son.
#
# Pousse une source de test (tonalité ou fichier audio) vers Icecast /live, le
# temps de confirmer que la page d'écoute joue bien. Utile pour valider l'infra
# (Icecast → Caddy → navigateur) AVANT de bricoler le loopback de ta vraie jam.
#
# USAGE :
#   ./tester-la-diffusion.sh                  # tonalité 440 Hz (douce), Ctrl-C pour arrêter
#   ./tester-la-diffusion.sh musique.mp3      # diffuse un fichier (en boucle)
#   JAMBOREE_HOST=127.0.0.1 ./tester-la-diffusion.sh   # depuis le VPS (boucle locale)
#
# Pendant que ça tourne, ouvre  https://<hôte>/ecouter.html  → tu dois entendre
# le test et voir « En direct ». À l'arrêt (Ctrl-C), la page repasse en
# « Personne ne diffuse — j'attends la jam… ». Variables d'env : cf. diffuser-le-live.sh.
#
set -euo pipefail

HOST="${JAMBOREE_HOST:-jamboreeeeeeee.duckdns.org}"
PORT="${JAMBOREE_PORT:-8000}"
PASS="${JAMBOREE_PASS:-Jamboree-Live-2026}"
MOUNT="${JAMBOREE_MOUNT:-live}"
BITRATE="${JAMBOREE_BITRATE:-128k}"
FILE="${1:-}"

command -v ffmpeg >/dev/null 2>&1 || { echo "✗ ffmpeg introuvable." >&2; exit 1; }

URL="icecast://source:${PASS}@${HOST}:${PORT}/${MOUNT}"
echo "🍇 Test de diffusion → icecast://source:***@${HOST}:${PORT}/${MOUNT}"
echo "   écoute : https://${HOST}/ecouter.html   (Ctrl-C pour arrêter)"
echo

if [ -n "$FILE" ]; then
  [ -f "$FILE" ] || { echo "✗ fichier introuvable : $FILE" >&2; exit 1; }
  echo "   source : fichier « $FILE » (en boucle)"
  exec ffmpeg -hide_banner -loglevel warning -re -stream_loop -1 -i "$FILE" \
    -c:a libmp3lame -b:a "$BITRATE" -ar 44100 -ac 2 \
    -content_type audio/mpeg -f mp3 "$URL"
else
  echo "   source : tonalité de test 440 Hz"
  # Sinus généré par lavfi (entrée synthétique → -re pour la cadencer en temps réel),
  # baissé à -18 dB pour ne pas exploser les oreilles.
  exec ffmpeg -hide_banner -loglevel warning -re -f lavfi -i "sine=frequency=440:sample_rate=44100" \
    -af "volume=-18dB" -c:a libmp3lame -b:a "$BITRATE" -ac 2 \
    -content_type audio/mpeg -f mp3 "$URL"
fi
