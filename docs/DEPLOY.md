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
  `infra/ninjam/ninjamsrv.cfg` (anonyme, 10 users max = 8 musiciens + le mixeur
  « radio » ninjamcast + marge, BPM 120 / BPI 16, pas d'enreg.). ⚠️ Les directives
  sont celles du parseur upstream (`AnonymousUsers yes`, pas `DefaultUser`) : une
  directive inconnue est ignorée en silence, le serveur démarre quand même.

## Son dans le navigateur (ADR-007, 2026-09-04)

Le relais `jamboree-ws` renvoie désormais des trames binaires (audio Opus) en plus
du JSON : **rebuild obligatoire** à chaque changement de `server/` ou `src/core/`
(`cd /opt/omexom && docker compose up -d --build jamboree-ws`). Les worklets audio
sont des fichiers statiques `public/worklets/*.js` copiés dans `dist/` au build du
cockpit. Bande passante : ~96 kb/s par musicien, vers chaque autre membre.
Test de bout en bout après déploiement : `node scripts/e2e-son.mjs` (Playwright,
faux micro Chrome) — vérifié le 04/09/2026 : 581 tranches envoyées, 527 reçues
et jouées, signal en sortie. Aussi `scripts/e2e-son-solo.mjs` (auto-écoute décalée)
et `scripts/e2e-son-nodevice.mjs` (aucune entrée → écoute + avertissement).

## Relais durci (audit 2026-09-04)

Le relais est public et sans authentification. Depuis l'audit : messages JSON
validés champ par champ (`src/core/session/validate.ts`, tout le reste est
ignoré, jamais de plantage), `maxPayload` 64 Kio, trames audio ≤ 4 Kio et ≤ 80/s
par membre, JSON ≤ 40/s, 16 membres par room, 64 rooms, 6 connexions par IP,
auditeurs sans audio, jeton `clientId` jamais rediffusé (éviction notifiée par
`{t:'evicted'}` → le client rejoint), contre-pression (audio sauté au-dessus de
256 Kio en attente, socket coupé au-dessus de 2 Mio), fantômes balayés après
30 s sans message, conteneur `USER node`, `cpus: "1"`, `pids_limit`, tas Node
192 Mo. Refus = `{t:'error', code}` affiché dans la barre de session.

## Cache navigateur (2026-09-04)

Sans en-tête `Cache-Control`, un téléphone gardait l'ancienne app des heures
(cache heuristique sur `Last-Modified`). Le vhost Caddy renvoie désormais
`no-cache` pour `/`, `*.html` et `/worklets/*` (revalidation ETag à chaque
visite, quasi gratuit) et `immutable` un an pour `/assets/*` (noms hachés par
Vite). ⚠️ Le Caddyfile de prod est bind-monté : après édition, **restart** du
conteneur `omexom-caddy` (un reload ne voit pas le nouvel inode) ; valider avant
avec `docker cp` + `caddy validate`, ce Caddy sert aussi les autres sites.

## Port NINJAM de secours (2026-09-04)

2049 est le port NFS : des box et réseaux d'entreprise le filtrent en sortie, et
Jamtaba répond « impossible to connect » sans plus de détail. Le compose de prod
(`/opt/omexom/docker-compose.yml`) publie aussi **`2050:2049`** (UFW ouvert) :
même serveur, même room. Vérifié joignable depuis l'extérieur via check-host.net.
⚠️ `ninjamsrv` bufferise son stdout dans Docker : ses logs n'apparaissent qu'au
remplissage du buffer, on ne peut pas s'y fier pour diagnostiquer en direct ;
capturer plutôt les connexions côté hôte (`ss -tan '( sport = :2049 )'`).

## Écoute web sur mobile (Icecast) — 2026-06-23

Pour qu'un pote écoute le live dans un **navigateur mobile** (iPhone Safari
inclus), sans client NINJAM : un mini-serveur **Icecast** rediffuse le mix de la
jam en **MP3** (seul format universel mobile), servi en HTTPS par le hub Caddy.

- **Service** `jamboree-icecast` (image dérivée `infra/icecast`, `FROM moul/icecast`
  + `icecast.xml` custom : ajoute le port source **8001 en shoutcast-compat**,
  interne au réseau Docker, monté sur `/live`) dans `/opt/omexom/docker-compose.yml` ;
  port **8000/TCP publié** (source push manuel + admin) + **UFW ouvert** (`ufw allow
  8000/tcp`) — le 8001 n'est PAS publié. Les mots de passe du xml sont les
  placeholders upstream (`hackme`), remplacés au démarrage par le `start.sh` de
  l'image depuis les env. Le **mot de passe source n'est PAS dans ce repo**
  (public) : il vit dans le compose privé sur le VPS (env
  `ICECAST_SOURCE_PASSWORD`). Pour diffuser à la main, exporte-le côté hôte :
  `export JAMBOREE_PASS=…` (demande-le à l'admin). ⚠️ Le port 8000 est ouvert au
  monde → le mot de passe source est la **seule** barrière : garde-le fort et
  hors du repo. Rotation = éditer l'env du compose puis **recréer** le conteneur
  (`docker compose up -d jamboree-icecast`), pas un simple restart.
- **Mixeur automatique** : service `jamboree-ninjamcast` (build `infra/ninjamcast`,
  binaire `ninjamcast` du dépôt NINJAM officiel, fork maintenu jeffmhopkins,
  commit épinglé). Il rejoint la session NINJAM comme un client « radio » sans
  carte son (`anonymous:radio`, horloge logicielle), **mixe tous les musiciens**,
  encode en MP3 (LAME 128k) et pousse le flux vers Icecast via le port source
  8001 → **`/live` est alimenté en continu, l'hôte n'a RIEN à lancer**. Le mot de
  passe source arrive par l'env `SC_PASSWORD` (compose privé). Quand personne ne
  joue, le flux diffuse du silence — la page d'écoute reste « En direct ».
  Redéployer : `cd /opt/omexom && docker compose up -d --build jamboree-ninjamcast`.
- **Caddy** : `handle /live*` → `reverse_proxy jamboree-icecast:8000 { flush_interval -1 }`
  (pas de buffering = vrai live) dans le vhost `jamboreeeeeeee.duckdns.org`.
  ⚠️ Le `Caddyfile` est bind-monté → après édition, **restart** `omexom-caddy`
  (l'`Edit` change l'inode, `caddy reload` ne suffit pas).
- **Page d'écoute** : `public/ecouter.html` (statique, AUCUN React/Web MIDI → marche
  sur iPhone) lit `/live`. Lien : `https://jamboreeeeeeee.duckdns.org/ecouter.html?room=<room>`,
  copié par le bouton « 🔊 Lien d'écoute » du bandeau de session.
- **Push manuel = fallback seulement** (depuis `jamboree-ninjamcast`, `/live` est
  alimenté tout seul — voir ci-dessus). Utile si le mixeur auto est HS ou pour
  diffuser un mix « oreilles de l'hôte » (le serveur NINJAM **ne mixe pas** : le
  mix complet calé au tempo n'existe que dans chaque client). On capte alors la
  **sortie audio** de l'hôte via un loopback (BlackHole macOS / VB-CABLE Windows /
  `.monitor` PulseAudio Linux) et on la pousse en MP3.
  Le plus simple = le script versionné :
  ```sh
  ./scripts/diffuser-le-live.sh            # auto-détecte le loopback selon l'OS
  ./scripts/diffuser-le-live.sh --list     # liste les périphériques audio
  ```
  Commande équivalente (entrée temps réel = loopback) :
  ```sh
  # Linux (monitor PulseAudio/PipeWire) :
  ffmpeg -f pulse -i default.monitor -c:a libmp3lame -b:a 128k -ar 44100 -ac 2 \
    -content_type audio/mpeg -f mp3 \
    "icecast://source:${JAMBOREE_PASS}@jamboreeeeeeee.duckdns.org:8000/live"
  ```
  ⚠️ Pièges (sinon ça « marche pas ») :
  - **PAS de `-re`** pour une entrée carte son/loopback (temps réel déjà cadencé) ;
    `-re` ne sert qu'à cadencer une entrée **fichier**.
  - Les flags `-reconnect*` sont des options de l'**entrée HTTP**, pas de la sortie
    icecast → ils ne fiabilisent **pas** le push. La reprise = la **boucle de
    supervision** du script (ou `systemd Restart=always`).
  - Le push est en **clair sur le port 8000** (`icecast://` n'a pas de TLS) — viser
    le 8000 en direct, **pas** le 443 (réservé aux auditeurs via Caddy).
- **Vérifier la chaîne sans toucher à ta carte son** : `./scripts/tester-la-diffusion.sh`
  pousse une tonalité (ou un fichier) vers `/live` → ouvre `ecouter.html`, tu dois
  entendre « En direct ».
- Limite v1 : **un seul flux** `/live` (une jam à la fois). Audio par room = plus tard.

## Recette de Phase 0 (« vous jammez déjà »)

L'objectif de la spec : jammer pour de vrai, sans même le cockpit.

1. `docker compose up -d --build` sur le VPS ; vérifier les 3 services up.
2. Toi + un pote : ouvrir **Jamtaba**, se connecter à `VITE_NINJAM_HOST`.
3. Caler les machines au tempo, jouer → vous vous entendez (décalage d'une mesure
   façon NINJAM, attendu).
4. ✅ Phase 0 OK : l'audio passe. Le cockpit (tempo partagé, présence, cues) est
   le confort par-dessus, servi sur `https://DOMAIN`.
