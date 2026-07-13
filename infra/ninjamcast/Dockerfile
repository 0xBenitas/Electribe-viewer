# ninjamcast — mixeur NINJAM headless → source Shoutcast v1 (par Brennan
# Underwood, dépôt officiel ninjam ; fork maintenu jeffmhopkins).
#
# Rôle : rejoint la session NINJAM comme un client sans carte son (horloge
# logicielle), mixe tous les musiciens, encode en MP3 (LAME) et pousse le flux
# vers Icecast (port source shoutcast-compat 8001). Résultat : /live est
# alimenté automatiquement pendant la jam, l'hôte n'a plus rien à lancer.
#
# Commit épinglé pour un build reproductible (validé sur le VPS le 2026-06-28).
FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates build-essential \
      libmp3lame-dev libvorbis-dev libogg-dev libncurses-dev libasound2-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone https://github.com/jeffmhopkins/ninjamcast-synthseeker.git . \
 && git checkout ace7871
RUN make -C ninjam/ninjamcast

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libmp3lame0 libvorbis0a libvorbisenc2 libogg0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/ninjam/ninjamcast/ninjamcast /usr/local/bin/ninjamcast
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# ninjamcast écrit les blobs audio de session dans son cwd (et nettoie derrière
# lui, config_savelocalaudio=-1) — on le cantonne à /tmp.
WORKDIR /tmp
ENTRYPOINT ["/entrypoint.sh"]
