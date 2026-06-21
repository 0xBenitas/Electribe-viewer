# NINJAM audio server (ninjamsrv), built from source.
#
# ⚠️ VALIDATE ON DEPLOY: ninjamsrv has no official image, so this compiles it
# from upstream. Exact paths/targets can drift with the source tree — confirm
# against https://github.com/justinfrankel/ninjam (README) on first build. The
# rest of the stack (caddy/ws/web) is independent of this step.

FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      git build-essential libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
# ninjamsrv depends on Cockos' WDL; keep the two trees side by side.
RUN git clone --depth 1 https://github.com/justinfrankel/WDL.git \
 && git clone --depth 1 https://github.com/justinfrankel/ninjam.git
# Server sources live under ninjam/server; it expects ../../WDL/WDL.
RUN ln -s /src/WDL/WDL /src/ninjam/WDL || true \
 && make -C /src/ninjam/ninjam/server ninjamsrv \
 || make -C /src/ninjam/server ninjamsrv

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libssl3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Copy the built binary (path matches whichever make target above succeeded).
COPY --from=build /src/ninjam/ninjam/server/ninjamsrv /usr/local/bin/ninjamsrv
COPY ninjamsrv.cfg /etc/ninjam/ninjamsrv.cfg
EXPOSE 2049
CMD ["ninjamsrv", "/etc/ninjam/ninjamsrv.cfg"]
