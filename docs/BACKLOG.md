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

### Stream vers un lobby Discord (les potes écoutent) 🎯 — finalité de la finalité

But : les potes cliquent sur un **salon vocal Discord** et entendent la jam en
direct, zéro setup pour eux. Le son vit dans NINJAM. Chemin progressif (chaque
étape réutilise la précédente) :

- **Option A — ce soir, zéro code** : un pote ouvre **Jamtaba en écoute** dans la
  room et le route vers Discord (partage d'écran *avec son*, ou *virtual audio
  cable* → micro Discord).
- **Option B — propre** : le **serveur NINJAM expose un flux** (Ogg/MP3 via sa
  config) → écoute via une **URL** (navigateur/VLC). Quick win : afficher ce
  « lien d'écoute en direct » dans le panneau Audio + activer le stream dans
  `ninjamsrv.cfg`.
- **Option C — le bot Discord** = l'objectif final. À réfléchir, donc capturé ici :

  **Insight clé** : ne PAS faire du bot un client NINJAM. Le serveur NINJAM émet
  déjà un flux mixé (Option B) ; le bot est un simple **relais « flux → Discord »** :
  il lit l'URL, transcode en Opus (ffmpeg) et pousse dans le salon vocal
  (Node + `@discordjs/voice`, cohérent avec la stack). Le bot ignore le protocole
  NINJAM → bien plus simple et robuste.

  **En notre faveur** : les auditeurs Discord sont passifs → la latence (délai
  NINJAM + buffers) ne les gêne pas. Pas de contrainte temps-réel.

  **Décisions à trancher** :
  - source audio : flux serveur NINJAM (recommandé) vs client headless ;
  - hébergement : un service Docker de plus sur le VPS ;
  - déclenchement : slash commands (`/listen`, `/stop`) vs auto avec la jam vs
    bouton « inviter le bot » dans le cockpit ;
  - token + appli Discord à enregistrer ; bitrate, mono/stéréo, un bot par room.

  **Dépendances (pourquoi en dernier)** : suppose le VPS déployé avec le flux
  activé (Option B), une jam stable, et un nouveau service long-running. Tant que
  l'audio NINJAM n'est pas validé en vrai, le bot n'a rien à relayer.

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
