#!/bin/sh
# Génère la config ninjamcast depuis l'environnement puis lance le binaire.
# Le mot de passe source Icecast n'existe QUE dans le compose privé du VPS
# (/opt/omexom/docker-compose.yml) — jamais dans ce repo public.
set -eu

: "${SC_PASSWORD:?SC_PASSWORD manquant (mot de passe source Icecast, cf. compose privé)}"

cat > /tmp/njcast.cfg <<EOF
Mp3_Samplerate	44100
Mp3_Bitrate	${MP3_BITRATE:-128}
Mp3_Channels	2

SC_Server_Name	${SC_NAME:-JAMBOREE}
SC_Server_Address	${SC_ADDRESS:-jamboree-icecast}
SC_Server_Port	${SC_PORT:-8000}
SC_Server_Password	${SC_PASSWORD}
SC_Server_Genre	ninjam
SC_Server_Public	0
SC_Server_Url	${SC_URL:-https://jamboreeeeeeee.duckdns.org/}
SC_Reconnect_Interval	5

NJ_Address	${NJ_ADDRESS:-jamboree-ninjam:2049}
NJ_User	${NJ_USER:-anonymous:radio}
NJ_Reconnect_Interval	5
NJ_Title_Set_Interval	10
NJ_Blocksize	1024
NJ_Session_Dir	/tmp/njcast_session
EOF

exec /usr/local/bin/ninjamcast /tmp/njcast.cfg
