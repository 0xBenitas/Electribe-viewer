#!/usr/bin/env bash
#
# diffuser-le-live.sh — pousse le MIX de ta jam vers le live JAMBOREE.
#
# Le serveur NINJAM ne mixe PAS : le mix complet (tout le monde, calé au tempo)
# n'existe que dans TON client (Jamtaba / Reaper). Ce script capte la sortie
# audio de ta machine et la diffuse en MP3 vers Icecast → les potes l'écoutent
# dans un simple navigateur via .../ecouter.html  (iPhone compris).
#
# ┌─ À FAIRE UNE SEULE FOIS : installer un "loopback" audio + y router ta sortie ─┐
# │  • macOS   : BlackHole 2ch  (https://existential.audio/blackhole/).            │
# │              Crée un "Périphérique agrégé / Multi-Output" = Casque + BlackHole │
# │              pour t'entendre ET diffuser. Sortie de Jamtaba/Reaper → ce device.│
# │  • Windows : VB-CABLE       (https://vb-audio.com/Cable/).                     │
# │              Sortie de ton client → "CABLE Input". (lance ce script via Git    │
# │              Bash / WSL, ou utilise la commande ffmpeg affichée plus bas.)     │
# │  • Linux   : rien à installer — on capte le ".monitor" de ta sortie (Pulse/   │
# │              PipeWire). Pour une sortie dédiée, crée un null-sink.             │
# └───────────────────────────────────────────────────────────────────────────────┘
#
# USAGE :
#   ./diffuser-le-live.sh                 # auto-détecte l'entrée selon ton OS
#   ./diffuser-le-live.sh --list          # liste les périphériques audio dispo
#   ./diffuser-le-live.sh -i "<device>"   # force l'entrée (nom/index ffmpeg)
#
# Réglages par variables d'env (valeurs par défaut entre parenthèses) :
#   JAMBOREE_HOST   (jamboreeeeeeee.duckdns.org)   hôte Icecast
#   JAMBOREE_PORT   (8000)                          port source Icecast (EN CLAIR,
#                                                   pas le 443 : icecast:// n'a pas de TLS)
#   JAMBOREE_PASS   (Jamboree-Live-2026)            mot de passe source
#   JAMBOREE_MOUNT  (live)                          mountpoint
#   JAMBOREE_BITRATE(128k)                          débit MP3
#
set -euo pipefail

HOST="${JAMBOREE_HOST:-jamboreeeeeeee.duckdns.org}"
PORT="${JAMBOREE_PORT:-8000}"
PASS="${JAMBOREE_PASS:-Jamboree-Live-2026}"
MOUNT="${JAMBOREE_MOUNT:-live}"
BITRATE="${JAMBOREE_BITRATE:-128k}"

command -v ffmpeg >/dev/null 2>&1 || {
  echo "✗ ffmpeg introuvable. Installe-le : macOS 'brew install ffmpeg' · Linux 'apt install ffmpeg' · Windows https://ffmpeg.org" >&2
  exit 1
}

OS="$(uname -s)"
INPUT=""          # device d'entrée (peut être forcé par -i)
INPUT_FMT=""      # format ffmpeg d'entrée (pulse / avfoundation / dshow)

# --- options ---------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --list)
      echo "Périphériques audio détectés ($OS) :"
      case "$OS" in
        Darwin)  ffmpeg -hide_banner -f avfoundation -list_devices true -i "" 2>&1 | sed -n '/AVFoundation audio devices/,$p' ;;
        Linux)   { command -v pactl >/dev/null 2>&1 && pactl list short sources; } || echo "(installe pulseaudio-utils pour 'pactl', ou utilise -i)" ;;
        *)       ffmpeg -hide_banner -f dshow -list_devices true -i dummy 2>&1 | sed -n '/DirectShow audio devices/,$p' ;;
      esac
      exit 0 ;;
    -i|--input) INPUT="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Option inconnue : $1 (essaie --help)" >&2; exit 1 ;;
  esac
done

# --- auto-détection de l'entrée selon l'OS ---------------------------------
case "$OS" in
  Linux)
    INPUT_FMT="pulse"
    if [ -z "$INPUT" ]; then
      # Le ".monitor" de la sortie par défaut = ce que tu entends.
      if command -v pactl >/dev/null 2>&1; then
        DEFSINK="$(pactl get-default-sink 2>/dev/null || true)"
        INPUT="${DEFSINK:+${DEFSINK}.monitor}"
      fi
      INPUT="${INPUT:-default.monitor}"
    fi ;;
  Darwin)
    INPUT_FMT="avfoundation"
    # ":<nom>" = audio seul. BlackHole 2ch par défaut.
    INPUT="${INPUT:-:BlackHole 2ch}"
    case "$INPUT" in :*) ;; *) INPUT=":$INPUT" ;; esac ;;
  *)  # Windows (Git Bash / MSYS)
    INPUT_FMT="dshow"
    INPUT="${INPUT:-audio=CABLE Output (VB-Audio Virtual Cable)}"
    case "$INPUT" in audio=*) ;; *) INPUT="audio=$INPUT" ;; esac ;;
esac

URL="icecast://source:${PASS}@${HOST}:${PORT}/${MOUNT}"
SAFE_URL="icecast://source:***@${HOST}:${PORT}/${MOUNT}"

echo "🍇 JAMBOREE — diffusion du live"
echo "   OS      : $OS"
echo "   entrée  : [$INPUT_FMT] $INPUT      (override : -i \"<device>\" · liste : --list)"
echo "   sortie  : $SAFE_URL  (MP3 $BITRATE)"
echo "   écoute  : https://${HOST}/ecouter.html"
echo "   (Ctrl-C pour arrêter)"
echo

# NOTE : PAS de '-re' ici. '-re' ne sert qu'à cadencer une entrée FICHIER ; une
# entrée carte son/loopback est DÉJÀ temps réel (le mettre crée du drift).
# La robustesse du push ne vient PAS des flags '-reconnect*' (ce sont des options
# de l'ENTRÉE HTTP, pas de la sortie icecast) mais de cette boucle de supervision.
while true; do
  ffmpeg -hide_banner -loglevel warning \
    -f "$INPUT_FMT" -i "$INPUT" \
    -c:a libmp3lame -b:a "$BITRATE" -ar 44100 -ac 2 \
    -content_type audio/mpeg -f mp3 \
    "$URL" || true
  echo "↻ flux interrompu — reprise dans 2 s (Ctrl-C pour arrêter)…" >&2
  sleep 2
done
