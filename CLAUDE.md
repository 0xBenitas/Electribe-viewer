# CLAUDE.md — orientation du repo

**JAMBOREE** : outil de jam collaboratif à distance pour une crew de musique
électronique hardware. On voit/édite sa machine, on voit celles des potes, on
joue calé au tempo (malgré la latence), avec des cues calés à la mesure. L'audio
passe par NINJAM (client natif, pas le navigateur). Vision : `docs/JAMBOREE.md`.

## Lancer

```sh
npm install
npm run dev        # cockpit (Vite, localhost — Web MIDI OK en contexte sécurisé)
npm run server     # relais de session WebSocket (port 8787)
```

Vérifs (tout doit rester vert) :

```sh
npm run typecheck  # tsc app + tests + serveur
npm test           # vitest (124 tests)
npm run lint       # eslint
npm run build      # tsc + build vite
```

## Carte du code — logique vs présentation

**Sépare bien les deux.** La logique ne doit pas vivre dans les composants ; les
composants consomment un read-model et des hooks.

| Zone | Rôle | Toucher pour… |
|---|---|---|
| `src/core/` | Domaine pur, agnostique du produit : `clock`, `profiles`, `transport`, `session` (types + fonctions pures, testées) | logique métier |
| `src/model/` | Read-model `Machine` + adaptateurs snapshot + hooks (`useLocalMachine`, `useClock`, `useSharedTransport`) | logique d'app |
| `src/midi/` | Adaptateur Web MIDI (client, SysEx, CC) | MIDI |
| `src/store/` | État Zustand (connexion, parts, params, session, cues, clock) | état |
| `src/net/` | Client WebSocket + dispatch + diffusion | réseau |
| `src/components/` | **UI cockpit** — c'est ici qu'on style/redesigne | **design** |
| `src/styles/globals.css` | Tokens (`@theme`) + base | **design** |
| `server/` | Relais de session (hub pur + adaptateur `ws`) | serveur |
| `device-profiles/` | Profils machines (JSON, un par machine) | matériel |
| `infra/`, `docs/` | Déploiement (`DEPLOY.md`), vision/décisions/backlog | infra/doc |

## Règle d'or pour une passe design

Tout le rendu vit dans **`src/components/`** + les tokens dans
**`src/styles/globals.css`**. Les composants reçoivent un `Machine` (read-model)
et des callbacks en props — **on peut les restyler librement sans toucher** à
`core/model/midi/store/net/server`. Brief design complet : **`docs/DESIGN.md`**.

## Conventions

- TypeScript strict ; imports avec extension `.ts`/`.tsx` ; `import type` pour les
  types (verbatimModuleSyntax).
- Tests colocalisés `*.test.ts` (vitest). Garder vert.
- Décisions notables = un ADR dans `docs/DECISIONS.md`.
- Hardware « EMX2 »/« Electribe » = la vraie machine Korg (ne pas renommer).
