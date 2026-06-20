# ENSEMBLE — vision fusionnée & roadmap

> Ce repo évolue d'EMX.PILOT (éditeur mono-machine Korg Electribe 2) vers
> **ENSEMBLE** : un cockpit de jam où l'on joue *et* édite ses machines, seul ou
> à plusieurs à distance. Décision actée : **ADR-005**. Spec source du volet jam :
> `11faac72-ENSEMBLEspec.md` (brief d'origine — la stack y est révisée, cf. ADR-005).

## L'idée en une phrase

Un seul outil : tu te connectes avec tes potes, **tu vois leurs machines** (parts,
sons, réglages en direct), **tu pilotes la tienne**, et vous **jouez calés au
tempo** malgré la latence. En solo, c'est l'éditeur Electribe d'avant, dans la même
coquille.

## Les deux features « top »

1. **Voir / utiliser les machines** — chacun voit l'état des machines de la session
   (réplication read-only) ; chacun édite la sienne via Web MIDI. Le viewer
   EMX.PILOT = le **panneau par-machine**.
2. **Jouer ensemble** — BPM partagée (hôte = source de vérité), position dans la
   mesure affichée, présence, et **cues non-verbaux calés à la mesure** (le
   différenciateur).

## Architecture (le joint de fusion)

```
Web MIDI ──► bridge ──► stores Zustand ──► composants UI
(ma machine)                  ▲                  ▲
                              │                  │
réseau WS ──► DeviceSnapshot ─┘   (même UI rend local OU distant)
(machine d'un pote, read-only)
```

- `src/core/profiles/` — Device Profiles JSON + auto-détection (spec §4).
- `src/core/transport/` — `AudioTransport` + `NinjamTransport` (spec §8). **L'audio
  ne passe jamais par le navigateur en v1** (client natif Jamtaba/Reaper).
- `src/core/session/` — protocole WebSocket (présence, BPM, réplication, cues) +
  `DeviceSnapshot` (le contrat réseau d'une machine).
- `src/midi/` — adaptateur Web MIDI existant (réutilisé tel quel).
- `device-profiles/` — un JSON versionné par machine (Electribe `verified`,
  Model:Samples `draft`).

## Décisions clés (détail en ADR-005)

- **Stack : Vite + serveur WS autonome**, pas Next.js (Web MIDI est client-only).
- **Repo : on fait évoluer celui-ci** (historique + cœur MIDI gardés).
- **Réplication read-only** des machines d'autrui en v1 (contrôle distant = plus tard).

## Roadmap

| Phase | Contenu | État |
|---|---|---|
| 0 | Serveur NINJAM Docker (Hetzner/Caddy) + jam via Jamtaba | ⬜ à faire |
| 1a | Lecture clock MIDI → BPM + position mesure (module pur testé) | 🟩 fait (`src/core/clock`) |
| 1b | Serveur WS (relais présence/BPM/snapshots/cues) + client + présence | 🟩 fait (`server/`, `src/net/`) |
| 1c | Clock live (`bridge` feed `MidiClock`) + diffusion du transport par l'hôte + phare BPM/mesure | 🟩 fait (`useClock`, `TransportBar`) |
| 2 | Device Profiles : format + détection + UI capability-driven + setup machine inconnue | 🟨 socle posé (types, registry, 2 profils, tests) |
| 2b | **Fusion viewer** : read-model `Machine` + adaptateurs snapshot + composants pilotés par le read-model (local ou distant) | 🟩 fait (`src/model`, composants migrés) |
| 2c | Diffusion `DeviceSnapshot` (hôte→pairs) + rendu des machines des pairs | 🟩 fait (`useSessionSync`, `usePeerMachines`) |
| 3 | Cues non-verbaux calés à la mesure (le différenciateur) | 🟨 contrat posé (`Cue`, `landAtBar`) |
| 4 | (R&D, optionnel) Audio dans le navigateur — hors chemin critique | ⬜ |
| — | Étape structurelle : monorepo (`apps/web`, `apps/ws-server`, `packages/midi`) + rename ENSEMBLE | ⬜ à faire |

## Serveur de session

Process Node autonome (`server/`), relais fan-out pur :

- `server/hub.ts` — logique de salle **pure et testée** (présence, hôte = source
  BPM, réplication device, cues, promotion d'hôte au départ).
- `server/index.ts` — adaptateur `ws` mince (mappe sockets ↔ peer ids).
- Lancement : `npm run server` (dev, tsx watch) / `npm run server:start`.
- Client navigateur : `src/net/sessionClient.ts` (transport), `src/net/sync.ts`
  (inbound → store + `usePeerMachines`), `src/net/useSessionSync.ts` (cycle de
  vie + diffusion du snapshot local, throttlée hors du flux CC).

## Ce qui reste explicitement à construire (neuf)

- L'orchestration NINJAM réelle (lancement/lien client natif) + Phase 0 infra.
- Les **cues** non-verbaux (UI + émission `sendCue`, le contrat existe déjà).
- UI cockpit : position dans la mesure (phare visuel) alimentée par le transport.
