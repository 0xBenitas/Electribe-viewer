# JAMBOREE

Outil de **jam collaboratif à distance** pour une crew de musique électronique
hardware. Tu te connectes avec tes potes, tu **vois leurs machines** (parts, sons,
réglages en direct), tu **pilotes la tienne**, et vous **jouez calés au tempo**
malgré la latence. En solo, c'est un éditeur/viewer pour ta machine, dans la même
appli.

> Issu d'EMX.PILOT (companion Korg Electribe 2), désormais fusionné en un seul
> produit. Voir `docs/JAMBOREE.md` (vision + roadmap) et `docs/DECISIONS.md`
> (ADR-005).

## Ce que ça fait

- **Voir / éditer sa machine** — vue d'ensemble des parts, sons, params temps réel
  (le viewer devient le panneau par-machine).
- **Voir les machines des potes** — réplication read-only de leur état en session.
- **Tempo partagé** — l'hôte est la source de vérité ; position dans la mesure
  affichée (le phare visuel).
- **Cues non-verbaux calés à la mesure** — signaler « break / monte / coupe… » qui
  atterrit proprement à la mesure suivante. Le différenciateur : le décalage d'une
  mesure devient le médium du signal.
- **Audio via NINJAM** — hors navigateur : chacun connecte son client natif
  (Jamtaba / Reaper). JAMBOREE orchestre le reste.

## Stack

- Vite + React 19 + TypeScript (strict), Tailwind v4, Zustand, Dexie.
- Web MIDI (détection machines + clock), Web USB (identification).
- Serveur de session WebSocket (Node, `server/`), serveur audio NINJAM.
- Self-host : Docker + Caddy (voir `docs/DEPLOY.md`).

## Architecture (le joint de fusion)

Web MIDI → `bridge` → stores → composants ; et réseau WS → `DeviceSnapshot` →
**les mêmes composants**. Une machine locale (éditable) et celle d'un pair
(read-only) sont rendues par le même read-model `Machine`.

```
src/core/      domaine agnostique : clock, profiles, transport, session
src/model/     read-model Machine + adaptateurs + hooks (clock, sync)
src/midi/      adaptateur Web MIDI (client, SysEx, CC)
src/store/     état Zustand (connexion, parts, params, session, cues, clock)
src/components/ UI cockpit (panels machine, transport, cues, audio, setup)
src/net/       client WS + dispatch + diffusion
src/db/        persistance IndexedDB (Dexie) : presets, metadata de parts
src/data/      tables statiques (oscillateurs Electribe)
src/lib/       utilitaires (couleurs de parts, multi-tab guard)
src/styles/    Tailwind + palette
server/        relais de session WebSocket (hub pur + adaptateur ws)
device-profiles/ profils JSON versionnés (un par machine)
infra/         docker-compose + Caddy + NINJAM
docs/          vision (JAMBOREE.md), décisions (DECISIONS.md), déploiement (DEPLOY.md), backlog (BACKLOG.md), design (DESIGN.md)
```

## Browser support

Chrome / Edge / Brave / Opera (Web MIDI natif requis). Pas Safari ni Firefox.
Contexte sécurisé exigé : `localhost` en dev, HTTPS en prod.

## Hardware

Profils livrés : Korg Electribe 2 (vérifié), Elektron Model:Samples (draft).
Machine inconnue → setup guidé qui génère un profil JSON contribuable.

## Setup (dev)

```sh
npm install
npm run dev        # cockpit (localhost, Web MIDI OK)
npm run server     # relais de session WebSocket (port 8787)
```

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de dev Vite |
| `npm run server` | Relais de session WS (tsx watch) |
| `npm run build` | Typecheck + build production |
| `npm run typecheck` | `tsc` (app + tests + serveur) |
| `npm test` | Tests unitaires Vitest |
| `npm run lint` | ESLint |

Déploiement self-host : voir `docs/DEPLOY.md`.

## License

MIT (voir `LICENSE`).
