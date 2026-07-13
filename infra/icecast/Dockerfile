# Icecast avec config custom : accepte une source Shoutcast v1 (ninjamcast)
# sur le port 8001 (shoutcast-compat) et la monte sur /live.
#
# moul/icecast bake son icecast.xml dans l'image et /start.sh se contente de
# sed-er les mots de passe depuis les variables d'env — on remplace donc le
# xml par le nôtre (placeholders "hackme", les env du compose font le reste).
# Ne JAMAIS mettre de vrai secret dans ce fichier ni dans icecast.xml : le
# repo est public, les secrets vivent dans /opt/omexom/docker-compose.yml.
FROM moul/icecast:latest
COPY icecast.xml /etc/icecast2/icecast.xml
