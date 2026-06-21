# DESIGN — brief & orientation du design system

> Pour la passe design (Claude design). But : un **design system cohérent** pour
> ENSEMBLE, sans toucher à la logique. Tout le rendu vit dans
> `src/components/` + les tokens dans `src/styles/globals.css`. Les composants
> consomment un read-model `Machine` et des callbacks → **restyle librement**.

## Le produit, le public, la vibe

Un **cockpit de jam** pour une crew de musique électronique **hardware**
(grooveboxes, synthés acid, Elektron…). Pas de grand public : on est entre nerds,
on assume l'opinionated. Outil **de performance live**, souvent en lumière basse,
parfois **projeté**.

Mots-clés : **cockpit, acid, psyché, rave, tempo, lisible à distance, calé à la
mesure, couleurs = sens**.

## Direction artistique : acid / psyché / rave-flyer 🎯

Réf. fournie par le client : un poster **« ACID SOCIETY »** — illustration flat
très contrastée sur **noir**, **contours noirs épais**, couleurs **électriques**
(jaune, cyan, rouge/corail, vert, magenta), formes **liquides/qui fondent**,
motifs **yeux, smileys, soucoupes, champignons, étincelles**, lettrage **gras
arrondi en 3D** (extrude/ombre portée). Énergie sticker-pack / flyer rave.

On veut **cette énergie**, mais **très fonctionnel** :
- Le psyché vit dans la **chrome** : wordmark/logo, en-têtes, **héros (le phare)**,
  accents, **états vides**, fonds/textures, le **plein écran projetable**, les
  micro-animations. Les **zones de données denses** (grille de parts, sliders de
  params, listes) restent **nettes et sobres** — lisibilité d'abord.
- **Contours épais + à-plats** plutôt que dégradés mous ; bordures marquées
  (tokeniser une épaisseur de trait « acid »).
- **Palette électrique sur noir** : la palette actuelle (`@theme`) est déjà dans
  ce ton — on peut **pousser la saturation** et l'utiliser plus franchement. Les
  16 couleurs de parts collent parfaitement à l'esprit rave (les garder, cf.
  daltonisme).
- **Typo bi-niveau** : un **display gras/arrondi** (style « acid ») pour le
  wordmark, le BPM géant et les gros titres ; **mono** (IBM Plex Mono ou autre)
  pour les **données/valeurs**. Le contraste display↔mono fait tout le style.
- **Motifs/illustrations** réutilisables (œil, smiley qui fond, étincelle,
  soucoupe) comme système d'icônes/ornements — utiles aussi pour la **présence**
  (avatars/marqueurs de joueurs) et le **feedback de cue**.
- **Motion** trippy mais au service du sens : pulsation du beat, fonte/“drip” sur
  le flash de cue « MAINTENANT », étincelles sur un événement. Jamais distrayant
  sur les données.
- **Contraste & lisibilité scène** non négociables : c'est joué en live, parfois
  projeté. Du fun, mais on lit tout d'un coup d'œil.

Garde-fou : le **fun est dans l'habillage**, la **fonction reste reine**. Si une
fioriture nuit à la lecture en live, elle saute.

## Principes de design

1. **Lisible d'un coup d'œil, à distance.** On joue les mains sur les machines ;
   l'info clé (tempo, mesure, cue qui arrive) doit se lire sans fixer l'écran.
   Le **phare** (position dans la mesure) est le héros visuel.
2. **Sombre par défaut.** Fond quasi noir, contraste maîtrisé pour la scène.
3. **La couleur porte du sens** (statut), elle n'est pas décorative :
   vert = actif/ok, jaune = attention, rouge = erreur, bleu = accent/action,
   orange = marque. Les 16 couleurs de parts identifient les pistes.
4. **Densité d'instrument, pas de tableau de bord vide.** Compact, aligné,
   typo mono → ça respire « gear ». Mais hiérarchie claire (titres discrets en
   majuscules espacées, valeurs en avant).
5. **Capability-driven.** L'UI ne montre que ce que la machine sait faire
   (éditeur complet Electribe vs panneau « lite »). Jamais de bouton mort.
6. **Projetable.** Le mode plein écran (`LighthouseOverlay`) doit rester ultra
   contrasté et géant.

## Tokens actuels (`src/styles/globals.css`, `@theme`)

Déjà en place, à faire évoluer en système :

- **Fonds** : `--color-bg #0a0a0b`, `bg-2 #131316`, `bg-3 #1c1c20`,
  `line #2a2a2f`, `line-bright #3a3a42`.
- **Texte** : `text #e8e6e3`, `text-dim #8a8a90`, `text-muted #5a5a60`.
- **Accents** : `blue #4dabf7` (+ `blue-bright`), `orange #ff6b35` (marque),
  `green #51cf66`, `yellow #fcc419`, `red #ff5252`.
- **16 couleurs de parts** : `--color-part-01..16` (palette HSL équidistante,
  **testée daltonisme**, spec §9.1).
- **Typo** : IBM Plex Mono (chargée dans `index.html`, modifiable).

Utilisation Tailwind v4 : les tokens deviennent des classes (`bg-bg-2`,
`text-text-dim`, `border-line`, `text-blue`…). On ajoute un token = on ajoute la
classe.

### Ce qui manque pour un vrai système (à formaliser)
- **Échelle d'espacement** et de **rayons** cohérente (aujourd'hui valeurs au cas
  par cas : `p-4`, `rounded-lg`, `gap-2/3/6`…).
- **Échelle typographique** (tailles/poids nommés : titre section, valeur, label,
  mono-données).
- **Élévation** (bordures vs ombres — actuellement tout en bordures `line`).
- **Motion** : la pulsation du beat / le flash de cue « MAINTENANT » méritent des
  durées/easings tokenisés (cf. `animate-pulse` ad hoc).
- **Variantes de boutons** (primaire/secondaire/ghost/danger) — aujourd'hui
  réécrites inline (ex. `inputCls` dupliqué dans `SessionBar` et `DeviceSetup`).
- **Police display « acid »** (gras/arrondie) pour wordmark + gros titres + BPM
  géant, en plus de la mono pour les données.
- **Épaisseur de trait « acid »** tokenisée (contours épais) + éventuelles
  textures de fond.
- **Système de motifs/icônes** (œil, smiley, étincelle, soucoupe) réutilisable
  (présence, feedback de cue, ornements, états vides).

## Inventaire des composants (`src/components/`)

| Composant | Rôle | États / notes design |
|---|---|---|
| `SessionBar` | Rejoindre une room / présence / latence / lien partageable | form (déconnecté) ↔ barre verte (connecté) ; badge « écoute », « connexion perdue », hôte |
| `TransportBar` | Phare compact : BPM + mesure/temps + points de beat | running / arrêté / en attente ; bouton plein écran |
| `LighthouseOverlay` | **Phare plein écran projetable** | mesure géante + points de beat + BPM ; Esc pour fermer |
| `CueDeck` | Boutons de cues + révélation calée à la mesure | boutons (raccourcis 1–5) ; cue `pending` → `active` (flash) |
| `AudioPanel` | Adresse du serveur NINJAM à coller dans le client natif | note « pas d'audio navigateur » |
| `MachinePanel` | Une machine (locale éditable / pair lecture seule) | `richEditor` → éditeur ; sinon **panneau lite** ; en-tête nom+modèle+online |
| `PartGrid` / `PartTile` | Grille des 16 parts (Electribe) | couleur de part, mute, part actif/sélectionné |
| `PartDetail` | Détail d'un part (oscillateur, filtre…) | hydraté / non hydraté ; champ nom (local) |
| `ParamPanel` / `ParamSlider` | Params temps réel (sliders/toggles) | désactivé hors part actif (ADR-001) / lecture seule |
| `ConnectionStatus` | État connexion MIDI + choix d'appareil | idle/scanning/connected/error/manual-select |
| `DeviceSetup` | Setup guidé machine inconnue → JSON | formulaire + preview JSON + copier/télécharger |
| `PatternInfo`, `KnobModeBadge`, `PresetLibrary`, `SysexLab` | Infos pattern / avertissement / presets / labo SysEx (Electribe) | outils locaux |
| `BrowserCheck`, `PermissionPrompt`, `MultiTabGuard` | Écrans d'état (navigateur/permission/multi-onglet) | pleine page, ton orange/rouge |

## À PRÉSERVER (ne pas casser)

- **La palette de parts** `--color-part-01..16` (testée daltonisme) — on peut
  ajuster, mais garder l'identification claire des 16 pistes.
- **La sémantique des couleurs de statut** (vert/jaune/rouge/bleu) — c'est de
  l'information, pas du style.
- **Le découplage logique/UI** : les composants reçoivent un `Machine` + des
  callbacks. Ne pas remonter de logique dans le rendu.
- **Le capability-driven** : éditeur vs lite selon `machine.richEditor`.
- **Le plein écran projetable** : très gros, très contrasté.

## Où travailler / ne pas toucher

- ✅ `src/components/**`, `src/styles/globals.css`, `index.html` (typo).
- ⛔ `src/core/**`, `src/model/**`, `src/midi/**`, `src/store/**`, `src/net/**`,
  `server/**` — c'est la logique. Si un changement design *exige* un nouveau champ
  de read-model, l'ajouter proprement côté `model/` (pas de logique dans l'UI).

## Pistes / opportunités

- **Hero « phare »** : faire du transport/mesure le centre de gravité visuel
  (animation de beat fluide, peut-être via la `phase` — note : la `phase` n'est
  pas exposée aujourd'hui dans `useSharedTransport`, l'ajouter côté `model` si on
  veut une pulsation continue plutôt que par beat).
- **Feedback de cue** plus expressif (l'instant « MAINTENANT » au downbeat).
- **Présence** : avatars/couleurs par joueur, qui est hôte, qui joue quoi.
- **Modes de densité** (compact scène / confort) ou un thème clair de secours.
- **Système de boutons** unifié (primaire/secondaire/ghost/danger) pour retirer
  les classes inline dupliquées.

## Pour voir l'app en vrai

```sh
npm run dev      # cockpit
npm run server   # relais WS (pour tester session/présence/cues à 2 onglets)
```

Tester sans matériel : ouvrir 2 onglets, rejoindre la même room (un en joueur,
un en « écouter seulement ») pour voir présence + transport + cues. Le détail
Electribe (grille de parts) n'apparaît qu'avec la machine branchée — sinon
panneau **lite**.
