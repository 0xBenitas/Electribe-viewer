# Claude Code — Working Context

## Project

**EMX.PILOT** (working title) — Web app companion pour Korg Electribe 2 (EMX2).

Le cahier des charges complet est dans **`emx-pilot-spec-v0.3.md`** à la racine. Il contient goals, architecture, MIDI foundation, data model, phases d'implémentation, test strategy.

## ⚠️ ALWAYS FIRST

Avant toute action, lis `emx-pilot-spec-v0.3.md` en entier. C'est la source de vérité. Si quelque chose est ambigu dans la spec, demande avant de coder.

## Rules of engagement

- Travailler **par phases** (cf. §10 du spec). Ne saute pas de phase sans go-ahead explicite.
- **ASK** avant toute décision architecturale qui n'est pas couverte par le spec.
- **DECIDE** pour les conventions de code, naming, formatting.
- Si une feature semble logique mais n'est pas dans le spec → ASK d'abord.
- À la fin de chaque tâche : summary structuré (ce qui a été fait, ce qui reste, blockers).

## Git workflow

- Branches : `feature/phase-<N>-<short-desc>` (ex: `feature/phase-1-foundation`, `feature/phase-3-param-mirror`)
- Commits : **Conventional Commits** strict
  - `feat(midi): add device inquiry handshake`
  - `fix(throttle): coalesce duplicate CC values`
  - `test(parser): add fixture for pattern dump roundtrip`
  - `docs(spec): clarify per-part addressing constraint`
  - `refactor`, `chore`, `style`, `perf`, `build`, `ci` aussi valides
- Petits commits ciblés (un commit = une idée logique).
- Avant chaque commit : tests passent + lint clean + types passent.
- Pas de `--force` push sur `main`.
- Avant merge sur main : auto-revue minimum, demander revue humaine si change architectural significatif.

## Code quality

- **TypeScript strict mode** (`"strict": true` dans tsconfig).
- Pas de `any` sans justification commentée.
- ESLint clean, Prettier formatted.
- Tests à côté du code (`foo.test.ts` au même niveau que `foo.ts`) ou dans `tests/`.
- Préférer la composition à l'héritage.
- Pas d'abstractions prématurées (YAGNI).

## Don't over-engineer

- **YAGNI** : implémenter ce qui est spec'd, pas plus.
- **KISS** : préférer la solution simple à la solution clever.
- Pas de design pattern pour le plaisir.
- Si tu hésites entre 2 approches, demande plutôt que de deviner.

## Documentation

- `docs/DECISIONS.md` : un **ADR** par décision architecturale notable. Format :
  ```
  ## ADR-NNN: <titre>
  Date: YYYY-MM-DD
  Status: Proposed | Accepted | Superseded by ADR-NNN
  
  ### Context
  ### Decision
  ### Consequences
  ```
- `docs/MIDI_FINDINGS.md` : observations Phase 0 (sera créé en Phase 0).
- `docs/OPEN_QUESTIONS.md` : questions ouvertes en attente de réponse.
- `README.md` : setup, scripts, structure, deployment.
- Inline comments seulement quand le code n'est pas évident par lui-même.
- JSDoc sur les fonctions exportées non triviales.

## Communication

- Récap structuré à la fin de chaque tâche :
  - **Done** : ce qui a été fait
  - **Next** : ce qui suit logiquement
  - **Blockers** : ce qui empêche d'avancer
  - **Decisions taken** : pointers vers ADRs si applicable
- Pas de yes-man : pousser back si une instruction crée de la dette technique ou conflicts avec les bonnes pratiques.
- Si tu détectes une incohérence dans la spec, signale-la avant de coder autour.

## Phase discipline

| Phase | Status | Output principal |
|---|---|---|
| 0 — MIDI Validation | Done | `docs/MIDI_FINDINGS.md` rempli |
| 1 — Foundation | In Progress | Vite + setup + MIDIClient base |
| 2 — Part Pilot read-only | Pending | Grille 16 parts + metadata locale |
| 3 — Param Mirror | Pending | CC bidirectionnel sur active part |
| 4 — SysEx Pattern Dump | Pending | Hydratation 16 parts au connect |
| 5 — Preset Library | Pending | Save/recall avec CC + SysEx |
| 6 — Pattern Catalog | Pending | 250 slots + metadata + switch |
| 7 — Setlist + XY Pad | Pending | Live builder + fullscreen XY |
| 8 — PWA Polish | Pending | Service worker + export/import |

Met à jour ce tableau au fur et à mesure (Pending → In Progress → Done).

## References (read-only — ne pas modifier)

- `emx-pilot-spec-v0.3.md` : **LE** cahier des charges
- `electribe_MIDIimp.txt` : doc MIDI officielle Korg — référence absolue pour CC/SysEx
- `electribe_PG_E4.pdf` : Parameter Guide (409 OSC, 32 MFX, 38 IFX, scales, grooves, patterns)

## Files irrelevant for development

Ces fichiers sont dans le repo pour référence mais ne sont pas utilisés en dev :

- `DrvTools(115_r63e).exe` : driver Windows USB MIDI (machine est class compliant, pas nécessaire)
- `e2-2016.zip` : bonus patterns Korg (à charger sur la machine via SD si voulu)
- `electribe_system_v202.zip` : firmware updater 2.02 (latest)

## Stack confirmed

- Vite + React 19 + TypeScript strict
- Tailwind CSS v4
- Zustand (state)
- Dexie.js (IndexedDB)
- React Router v6
- vite-plugin-pwa
- dnd-kit (Setlist drag & drop)
- Vitest (unit) + Playwright (E2E)

Cibles : Chrome / Edge / Brave / Opera. Pas Safari/FF (Web MIDI non supporté).
