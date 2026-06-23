# Déploiement (Phase 0 — self-host)

> Stack auto-hébergée : un VPS (Hetzner), Docker, Caddy (TLS), le serveur de
> session WebSocket, et le serveur audio NINJAM. **Le navigateur ne transporte
> pas l'audio** : chacun connecte son client NINJAM natif (Jamtaba / Reaper).

## Composants

| Service | Rôle | Port |
|---|---|---|
| `caddy` | TLS + sert le cockpit + proxy WS (`/ws`) | 80/443 |
| `ws` | Relais de session (présence, BPM, réplication, cues) | 8787 (interne) |
| `ninjam` | Serveur audio NINJAM (clients **natifs**) | 2049 (TCP direct) |

## Mise en route

```sh
cd infra
cp .env.example .env          # renseigne DOMAIN + VITE_SESSION_URL + VITE_NINJAM_HOST
docker compose up -d --build
```

Caddy obtient le certificat TLS automatiquement pour `DOMAIN` (prévois l'enregistrement DNS A vers le VPS, ports 80/443 ouverts, et **2049/TCP ouvert** pour NINJAM).

## Variables

- `DOMAIN` — domaine public (TLS auto).
- `VITE_SESSION_URL` — URL WS du relais, p.ex. `wss://<domaine>/ws` (inlinée au build du cockpit).
- `VITE_NINJAM_HOST` — `host:port` du serveur NINJAM affiché dans le panneau Audio.

> En local sans déploiement : `npm run dev` (cockpit) + `npm run server` (relais).
> Les valeurs par défaut (`ws://localhost:8787`, `localhost:2049`) conviennent.

## ⚠️ NINJAM : à valider au déploiement

`ninjamsrv` n'a pas d'image officielle : `infra/ninjam/Dockerfile` le **compile
depuis les sources** (justinfrankel/ninjam + WDL). Les chemins/targets de build
peuvent bouger avec l'upstream — vérifie le premier build et ajuste si besoin
(le reste de la stack est indépendant de cette étape). Config serveur :
`infra/ninjam/ninjamsrv.cfg`.

## Déploiement réel — VPS « omexom » (2026-06-22)

En prod, JAMBOREE **n'utilise pas** le compose autonome ci-dessus (le hub Caddy
d'omexom possède déjà 80/443). Il est intégré au hub :

- **URL** : https://jamboreeeeeeee.duckdns.org — TLS auto via challenge **DNS DuckDNS**
  (`resolvers 1.1.1.1`), donc HTTPS = secure context, requis par Web MIDI.
- **Cockpit statique** : `VITE_SESSION_URL=wss://jamboreeeeeeee.duckdns.org/ws npm run build`
  → `dist/` copié dans `/opt/jamboree/public`, bind-monté `:ro` dans le conteneur
  `omexom-caddy` sous `/srv/jamboree`, servi en `file_server` (fallback SPA).
- **Relais WS** : service `jamboree-ws` dans `/opt/omexom/docker-compose.yml`
  (build `server/Dockerfile`, réseau `omexom_default`, port interne 8787) ; le hub
  fait `handle /ws*` → `reverse_proxy jamboree-ws:8787` dans le vhost.
- **Redéployer le cockpit** : rebuild `dist` (mêmes `VITE_*`) → copier dans
  `/opt/jamboree/public` (pas de restart caddy nécessaire, file_server lit le disque).
- **Redéployer le serveur** : `cd /opt/omexom && docker compose up -d --build jamboree-ws`.
- **NINJAM (audio)** : service `jamboree-ninjam` (build `infra/ninjam`, compilé depuis
  les sources upstream), port **2049/TCP publié** sur l'hôte + **UFW ouvert** (`ufw allow
  2049/tcp`). Les clients **natifs** (Jamtaba / Reaper) se connectent en direct sur
  `jamboreeeeeeee.duckdns.org:2049` (le navigateur ne porte pas l'audio). Config :
  `infra/ninjam/ninjamsrv.cfg` (anonyme, 8 users max, BPM 120 / BPI 16, pas d'enreg.).

## Écoute web sur mobile (Icecast) — 2026-06-23

Pour qu'un pote écoute le live dans un **navigateur mobile** (iPhone Safari
inclus), sans client NINJAM : un mini-serveur **Icecast** rediffuse le mix de la
jam en **MP3** (seul format universel mobile), servi en HTTPS par le hub Caddy.

- **Service** `jamboree-icecast` (image `moul/icecast`) dans
  `/opt/omexom/docker-compose.yml` ; port **8000/TCP publié** (source push) +
  **UFW ouvert** (`ufw allow 8000/tcp`). Mot de passe source = `Jamboree-Live-2026`.
- **Caddy** : `handle /live*` → `reverse_proxy jamboree-icecast:8000 { flush_interval -1 }`
  (pas de buffering = vrai live) dans le vhost `jamboreeeeeeee.duckdns.org`.
  ⚠️ Le `Caddyfile` est bind-monté → après édition, **restart** `omexom-caddy`
  (l'`Edit` change l'inode, `caddy reload` ne suffit pas).
- **Page d'écoute** : `public/ecouter.html` (statique, AUCUN React/Web MIDI → marche
  sur iPhone) lit `/live`. Lien : `https://jamboreeeeeeee.duckdns.org/ecouter.html?room=<room>`,
  copié par le bouton « 🔊 Lien d'écoute » du bandeau de session.
- **L'hôte pousse le son** de sa jam (sortie carte son / loopback type BlackHole) :
  ```sh
  ffmpeg -re -i <entrée-audio> -c:a libmp3lame -b:a 128k -content_type audio/mpeg \
    -f mp3 icecast://source:Jamboree-Live-2026@jamboreeeeeeee.duckdns.org:8000/live
  ```
- Limite v1 : **un seul flux** `/live` (une jam à la fois). Audio par room = plus tard.

## Recette de Phase 0 (« vous jammez déjà »)

L'objectif de la spec : jammer pour de vrai, sans même le cockpit.

1. `docker compose up -d --build` sur le VPS ; vérifier les 3 services up.
2. Toi + un pote : ouvrir **Jamtaba**, se connecter à `VITE_NINJAM_HOST`.
3. Caler les machines au tempo, jouer → vous vous entendez (décalage d'une mesure
   façon NINJAM, attendu).
4. ✅ Phase 0 OK : l'audio passe. Le cockpit (tempo partagé, présence, cues) est
   le confort par-dessus, servi sur `https://DOMAIN`.
