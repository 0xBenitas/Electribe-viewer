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
| 1 | Lecture clock MIDI → BPM + position mesure ; serveur WS ; présence ; BPM partagée | ⬜ à faire |
| 2 | Device Profiles : format + détection + UI capability-driven + setup machine inconnue | 🟨 socle posé (types, registry, 2 profils, tests) |
| 2b | **Fusion viewer** : câbler stores ↔ `DeviceSnapshot`, rendre la machine d'un pote dans les composants existants | ⬜ à faire |
| 3 | Cues non-verbaux calés à la mesure (le différenciateur) | 🟨 contrat posé (`Cue`, `landAtBar`) |
| 4 | (R&D, optionnel) Audio dans le navigateur — hors chemin critique | ⬜ |
| — | Étape structurelle : monorepo (`apps/web`, `apps/ws-server`, `packages/midi`) + rename ENSEMBLE | ⬜ à faire |

## Ce qui reste explicitement à construire (neuf)

- Lecture temps-réel de la clock MIDI (`0xF8` / Start-Stop / SPP) → BPM + mesure.
  **Rien dans le repo aujourd'hui** : EMX.PILOT lit du SysEx, pas l'horloge.
- Le serveur WebSocket (process Node) : fan-out présence / BPM / snapshots / cues.
- Le câblage `bridge.ts` → sérialisation `DeviceSnapshot` → diffusion, et le sens
  inverse (snapshot réseau → store « peer » → composants).
- L'orchestration NINJAM réelle + l'UI cockpit (position mesure, présence, cues).
