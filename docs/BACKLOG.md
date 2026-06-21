# Backlog ENSEMBLE — TODO, quick wins, idées

> Parking organisé pour après le périmètre actuel (qui est complet et clean).
> Rien ici n'est engagé : on pioche au fil de l'eau.

## À faire (acté, à la fin)

- [ ] **Mode d'emploi connectique** (`docs/CONNECTIQUE.md`) : branchement par machine
      (Electribe = audio séparé ; Elektron = 1 câble USB Audio+MIDI ; 303/clone ;
      TB-303 vintage = audio-only DIN sync), + qui est hôte, + réglages MIDI Sync.
- [ ] **Validation hardware** : émission clock Electribe (`0xF8`/transport) +
      recette audio Phase 0 sur le VPS (jam à deux via Jamtaba, cf. `docs/DEPLOY.md`).
- [ ] **Build `ninjamsrv`** à valider au premier déploiement (pas d'image officielle).

## Quick wins (petits, fort impact)

- [ ] **Persister nom / room / serveur** en `localStorage` → le formulaire de
      session se re-remplit tout seul.
- [ ] **Lien de session partageable** : URL avec `?room=...&server=...` → un clic
      pour rejoindre, plus de copier-coller.
- [ ] **Mode « écoute seule » explicite** : bouton pour rejoindre une room sans
      machine MIDI (voir tempo/présence/cues + écouter via NINJAM). Marche déjà en
      pratique, juste à rendre clair dans l'UI.
- [ ] **Raccourcis clavier pour les cues** (1–5 = Break/Monte/Baisse/Drop/Coupe) :
      signaler sans lâcher les mains des machines.
- [ ] **Indicateur de latence** : le `ping`/`pong` existe déjà dans le protocole
      (handler stub) — calculer le RTT et l'afficher dans la barre de session.
- [ ] **Phare plein écran** : la position dans la mesure en grand (route `/lighthouse`
      ou plein écran), projetable pendant la jam.
- [ ] **Passer les profils `draft` en `verified`** au fur et à mesure qu'on les
      confirme sur le hardware (Model:Samples, Model:Cycles, le clone 303…).

## Idées (plus gros / R&D)

### Stream vers un lobby Discord (les potes écoutent) 🎯
Le son vit dans NINJAM ; pour que des non-joueurs écoutent :
- **Option A — la plus simple, zéro code** : un pote ouvre **Jamtaba en écoute**
  dans la room, route sa sortie vers Discord (partage d'écran *avec son*, ou un
  *virtual audio cable* → entrée micro Discord). Les autres rejoignent le salon
  vocal. Faisable ce soir.
- **Option B — propre** : le **serveur NINJAM expose un flux** (Ogg/MP3 / Icecast).
  Les potes écoutent via une **URL** (navigateur/VLC). Quick win associé : afficher
  ce « lien d'écoute en direct » dans le panneau Audio d'ENSEMBLE + activer le
  stream dans `ninjamsrv.cfg`.
- **Option C — fancy** : un **bot Discord** qui rejoint la room NINJAM (client
  headless) et diffuse dans un salon vocal. Plus de boulot, mais « un clic » côté
  potes.

### Autres pistes
- [ ] **Enregistrement de la session** (NINJAM server record, ou archive du stream)
      → réécouter / poster les jams.
- [ ] **Reconnexion automatique** du WebSocket (aujourd'hui : on affiche « connexion
      perdue », pas de retry auto).
- [ ] **Visualisation générative live** « voir sa musique » (cf. `OPEN_QUESTIONS.md`
      A.1) : flux MIDI → formes/couleurs, plein écran, projetable.
- [ ] **Co-pilote IA sur les patterns** (cf. `OPEN_QUESTIONS.md` A.2).
- [ ] **Édition fine au-delà de l'Electribe** : reverse-engineering SysEx par
      machine (exige le hardware) pour passer du cockpit « lite » à l'éditeur complet.
- [ ] **Audio dans le navigateur** (Phase 4, R&D) : NINJAM/WASM ou WebRTC. Hors
      chemin critique — ne pas y toucher avant que le reste soit éprouvé en vrai.
- [ ] **Cues : marge adaptative** (+2 mesures si on tire en fin de mesure) pour
      éliminer le ±1 mesure côté pair non-hôte.
