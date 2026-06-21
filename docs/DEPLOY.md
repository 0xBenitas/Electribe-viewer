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

## Recette de Phase 0 (« vous jammez déjà »)

L'objectif de la spec : jammer pour de vrai, sans même le cockpit.

1. `docker compose up -d --build` sur le VPS ; vérifier les 3 services up.
2. Toi + un pote : ouvrir **Jamtaba**, se connecter à `VITE_NINJAM_HOST`.
3. Caler les machines au tempo, jouer → vous vous entendez (décalage d'une mesure
   façon NINJAM, attendu).
4. ✅ Phase 0 OK : l'audio passe. Le cockpit (tempo partagé, présence, cues) est
   le confort par-dessus, servi sur `https://DOMAIN`.
