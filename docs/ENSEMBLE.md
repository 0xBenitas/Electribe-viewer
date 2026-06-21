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
| 0 | Audio NINJAM : transport + panneau Audio + infra Docker/Caddy + déploiement | 🟩 fait (`infra/`, `AudioPanel`, `docs/DEPLOY.md`) — build ninjamsrv à valider au déploiement |
| 1a | Lecture clock MIDI → BPM + position mesure (module pur testé) | 🟩 fait (`src/core/clock`) |
| 1b | Serveur WS (relais présence/BPM/snapshots/cues) + client + présence | 🟩 fait (`server/`, `src/net/`) |
| 1c | Clock live (`bridge` feed `MidiClock`) + diffusion du transport par l'hôte + phare BPM/mesure | 🟩 fait (`useClock`, `TransportBar`) |
| 2 | Device Profiles : format + détection + setup machine inconnue (→ JSON contribuable) | 🟩 fait (`registry`, 6 profils, `DeviceSetup`) |
| 2d | Connexion généralisée : toute machine MIDI se connecte (inquiry best-effort), profil par nom de port, UI capability-driven (éditeur Electribe / cockpit lite) | 🟩 fait (`client`, `bridge`, `MachinePanel`) |
| 2b | **Fusion viewer** : read-model `Machine` + adaptateurs snapshot + composants pilotés par le read-model (local ou distant) | 🟩 fait (`src/model`, composants migrés) |
| 2c | Diffusion `DeviceSnapshot` (hôte→pairs) + rendu des machines des pairs | 🟩 fait (`useSessionSync`, `usePeerMachines`) |
| 3 | Cues non-verbaux calés à la mesure (le différenciateur) | 🟩 fait (`CueDeck`, store cues, relais serveur) |
| 4 | (R&D, optionnel) Audio dans le navigateur — hors chemin critique | ⬜ |
| — | Rename EMX.PILOT → ENSEMBLE | 🟩 fait |
| — | Monorepo (`apps/`/`packages/`) | ⛔ écarté : sur-ingénierie pour 1 app + 1 petit serveur ; `src/core` donne déjà la séparation. À reconsidérer si 2ᵉ app / déploiement indépendant. |

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

- Reverse-engineering SysEx par machine pour l'édition fine au-delà de l'Electribe
  (chaque appareil = son format ; exige le hardware). Les autres machines ont
  aujourd'hui le cockpit « lite » : tempo, présence, cues, audio.
- Validation hardware : émission clock Electribe (`0xF8`/transport) + audio NINJAM
  bout-en-bout (recette Phase 0 dans `docs/DEPLOY.md`).
- (R&D, optionnel) Audio dans le navigateur — hors chemin critique.

> Limite connue des cues : un pair (non-hôte) calcule `landAtBar` depuis sa mesure
> partagée relayée (~200 ms de retard), donc l'atterrissage peut différer d'±1
> mesure de la vue de l'hôte. Acceptable (signal volontairement « gros grain ») ;
> piste future = marge adaptative en fin de mesure.
