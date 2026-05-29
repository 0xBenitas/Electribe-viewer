# EMX.PILOT

Web app companion pour Korg Electribe 2 (EMX2). Vue d'ensemble des 16 parts, bibliothèque de sound presets, catalogue de patterns avec metadata, setlist builder, big XY pad MFX. Local, offline-first, PWA.

> ⚠️ **Statut** : Phase 1 (Foundation) en cours — setup, MIDIClient, détection de connexion.

## Pourquoi cette app

L'EMX2 a un LCD 16 caractères qui force une navigation menu-par-menu. Cette app **complète** la machine sans la remplacer :

- Vue d'ensemble simultanée des 16 parts sur grand écran
- Bibliothèque de sound presets (la machine n'en a pas en natif)
- Catalogue des 250 patterns avec metadata recherchable
- Setlist builder avec warnings de transitions BPM
- Big XY pad fullscreen pour MFX live
- Backup local en IndexedDB

La machine reste le moteur audio + séquenceur primaire + tactile. L'app est un panneau de commande externe + une mémoire externe.

## Documentation

- **`emx-pilot-spec-v0.3.md`** — cahier des charges complet
- **`CLAUDE.md`** — instructions Claude Code
- **`docs/`** — décisions, findings MIDI, questions ouvertes

## Stack

- Vite + React 19 + TypeScript (strict)
- Tailwind CSS v4
- Zustand (state)
- Web MIDI API native
- Vitest (unit) — Dexie.js / PWA à venir (Phases ultérieures)

## Browser support

Chrome / Edge / Brave / Opera (Web MIDI natif requis).

Pas de support Safari ni Firefox.

## Hardware support

Korg Electribe 2 (EMX2 synth, version bleue). Pas l'ESX2 sampler ni les Electribes précédentes.

## Setup

```sh
npm install
npm run dev        # serveur de dev (localhost, Web MIDI OK)
```

> Web MIDI exige un contexte sécurisé : `localhost` en dev, HTTPS en prod.

### Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de dev Vite |
| `npm run build` | Typecheck + build production |
| `npm run typecheck` | `tsc -b` sans émettre |
| `npm test` | Tests unitaires Vitest |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

### Structure

```
src/
├── midi/          # MIDIClient, SysEx envelope, Device Inquiry, encodage, ports
├── store/         # état Zustand (connexion)
├── components/    # BrowserCheck, PermissionPrompt, ConnectionStatus, MultiTabGuard
├── lib/           # multi-tab guard (BroadcastChannel)
└── styles/        # Tailwind + palette
tests/fixtures/    # captures MIDI réelles (pattern dump)
tools/             # midi-probe.html (validation Phase 0)
```

## License

À définir.
