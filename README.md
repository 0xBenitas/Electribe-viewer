# EMX.PILOT

Web app companion pour Korg Electribe 2 (EMX2). Vue d'ensemble des 16 parts, bibliothèque de sound presets, catalogue de patterns avec metadata, setlist builder, big XY pad MFX. Local, offline-first, PWA.

> ⚠️ **Statut** : Phase 0 (MIDI Validation) en cours. Pas encore de code.

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

## Stack (à venir)

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Web MIDI API native
- Dexie.js (IndexedDB)
- PWA

## Browser support

Chrome / Edge / Brave / Opera (Web MIDI natif requis).

Pas de support Safari ni Firefox.

## Hardware support

Korg Electribe 2 (EMX2 synth, version bleue). Pas l'ESX2 sampler ni les Electribes précédentes.

## Setup (à venir)

```sh
# Une fois le code initialisé:
pnpm install
pnpm dev
```

## License

À définir.
