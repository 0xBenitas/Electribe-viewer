# Architecture Decision Records

Un ADR par décision architecturale notable. Format dans `CLAUDE.md`.

---

## ADR-001: Modèle d'adressage per-part et détection du current edit part

Date: 2026-05-22
Status: Accepted

### Context

La spec §1.1 supposait que l'EMX2 utilise un seul canal MIDI global et que les
CC affectent le part en cours d'édition (« current edit part »), avec une grosse
inconnue : **comment l'app peut-elle savoir quel part est sélectionné ?** (aucun
message MIDI documenté pour ça — cf. spec §10, §12 et `MIDI_FINDINGS.md` §9).

Les tests hands-on de Phase 0 (firmware 2.02, voir `MIDI_FINDINGS.md`) ont
révélé une **asymétrie** entre émission et réception MIDI :

- **Émission (machine → app)** : chaque part émet ses notes ET les tweaks de
  knob sur **son propre canal MIDI** (Part N → canal N). Vérifié : notes parts
  2/3/10/11 sur ch2/3/10/11 ; knobs du part sélectionné (Part 6) sur ch6.
- **Réception (app → machine)** : la machine applique les CC reçus au **part
  actuellement sélectionné**, pas au part correspondant au canal. Vérifié :
  - Part 6 sélectionné + CC74 sur ch6 → Part 6 bouge ✅
  - Part 1 sélectionné + CC74 sur ch6 → Part 6 **ne bouge pas** ❌

### Decision

1. **Contrôle CC temps réel = part actif uniquement.** On ne pilote pas un part
   non-sélectionné via son canal. La contrainte spec §1.1 est confirmée.
2. **Édition d'un part non-actif = SysEx Pattern Dump → modify → Pattern Write**
   (lent, ~150-300 ms attendu), comme prévu par la spec, pour les params qui le
   nécessitent.
3. **Émission CC : toujours sur le canal du part actif.** Validé fonctionnel
   (test 2). Détail à épingler en Phase 3 : la machine ignore-t-elle totalement
   le canal en RX, ou exige-t-elle le canal du part actif ? Défaut sûr retenu =
   émettre sur le canal du part actif.
4. **Détection du current edit part = canal des CC entrants (Méthode E).** À
   chaque CC reçu, `part actif = (canal MIDI du message)`. Mise à jour du
   highlight en temps réel, dès le premier knob touché. Aucun polling SysEx.
   - État initial « indéterminé » tant qu'aucun CC n'est arrivé après connexion.
     Fallback : sélection manuelle ou invite à tourner un knob.

### Consequences

- ✅ Résout la principale inconnue de la spec (détection active part) à coût quasi
  nul, sans polling, latence instantanée.
- ✅ Confirme la faisabilité de l'archi « follow mode » de la spec (mirror du part
  actif).
- ⚠️ Pas de mirror/contrôle temps réel des 16 parts simultanément (conforme
  non-goal spec §2.3). L'édition multi-part reste via SysEx Pattern Write.
- ⚠️ L'app doit gérer un état « part actif indéterminé » au démarrage (avant tout
  CC entrant). Impact UI à prévoir (badge / invite).
- ➡️ Le store `activePart` (spec §5.1) est piloté par le canal des CC entrants.
- ➡️ Le throttler/émetteur CC (spec §6.11) cible le canal du part actif courant.

### Validé par

`docs/MIDI_FINDINGS.md` §4.1 (CC entrants per-part), anomalie 99.1 (résolution),
§9.5 (méthode E), tests d'émission CC du 2026-05-22.

---

## ADR-002: Mapping valeur SysEx « Oscillator Type » → nom d'oscillateur

Date: 2026-05-23
Status: Accepted (offset confirmé sur hardware le 2026-05-23)

### Context

Le Pattern Dump expose un champ `oscType` par part (parser : `raw[base+8] |
raw[base+9]<<8`). La doc MIDI Korg (`electribe_MIDIimp.txt`, offset 8~9) le
documente « Oscillator Type | 0~500 ». Le Parameter Guide
(`electribe_PG_E4.pdf`) liste **409 oscillateurs nommés**, numérotés 1..409 à
l'affichage machine. L'UI n'affichait que la valeur brute (« OSC 137 »).

Les 409 noms + catégories ont été extraits du PDF (table complète, 0 trou) vers
`src/data/oscillators.ts`. Reste l'ambiguïté du **décalage** entre la valeur
brute (plage déclarée 0~500) et le numéro d'affichage (1..409) : les valeurs du
fixture `Init Pattern` (1..405) sont cohérentes sous l'hypothèse 1-based comme
0-based — un simple off-by-one (ex. brut 230 → Guiro vs Cabasa) indiscernable
sans point de vérité matériel.

### Decision

- Table `OSCILLATORS` indexée à 0 = oscillateur n°1 affiché.
- Lookup `oscByRaw(raw) = OSCILLATORS[raw - 1 + OSC_RAW_OFFSET]`.
- `OSC_RAW_OFFSET = 1` : **confirmé sur EMX2 le 2026-05-23**. La confrontation
  à l'écran machine a montré un décalage d'un cran (app affichait l'oscillateur
  n°brut, machine affichait n°brut+1) → interprétation 0-based, brut 0 ==
  oscillateur n°1. Numéro d'affichage machine = valeur brute + 1.
- UI : nom + catégorie sur les tuiles (`PartTile`) et le détail (`PartDetail`),
  numéro brut conservé en référence (`#<raw>`).

### Consequences

- ✅ L'utilisateur voit ses instruments par nom, pas un index opaque.
- ✅ Offset confirmé hardware (2026-05-23) : `OSC_RAW_OFFSET = 1`. À consigner
  aussi dans `MIDI_FINDINGS.md` à la prochaine passe doc.
- ➡️ Hors scope volontaire (YAGNI) : noms des types de filtre / IFX / modulation /
  MFX (toujours affichés en index brut pour l'instant).

---

## ADR-003: Persistance des métadonnées de part — globale par slot (v1)

Date: 2026-05-23
Status: Accepted

### Context

Le nommage/coloration de part (`customName`, `customColor`, `customTag`) vivait
uniquement dans le store Zustand en mémoire → perdu à chaque reload. La spec §7.1
place ces champs dans `PartState`, lui-même imbriqué dans `PatternState.parts`
(donc **par-pattern**), mais le schéma Dexie §7.4 ne prévoit **aucune table** pour
les métadonnées de part, et l'app actuelle n'a qu'un store de 16 parts **global**
(non lié à un slot de pattern). Le modèle par-pattern dépend du suivi du slot
courant, qui relève de la Phase 6 (Pattern Catalog).

### Decision

- Persistance **globale par slot de part (1..16)** via une table Dexie `partMeta`
  (`src/db/schema.ts`, store `partMeta: 'id'`), hors du modèle par-pattern de la
  spec pour l'instant.
- Écriture *fire-and-forget* dans `setMetadata`, lecture via `loadMetadata()`
  appelée une fois au démarrage (`main.tsx`).
- Schéma Dexie créé en version 1 avec `partMeta` + `settings` seulement ; les
  tables `presets / patternMeta / setlists` (spec §7.4) seront ajoutées en
  version 2 lors de la Phase 5+ (YAGNI).

### Consequences

- ✅ Les noms/couleurs survivent au reload (vérifié Playlist e2e : set → reload →
  présent).
- ⚠️ Sémantique « globale » : un nom posé sur la part 1 s'affiche pour tous les
  patterns. Acceptable en v1 ; à migrer vers le modèle par-pattern
  (`PatternMeta.partOverview`, spec §7.3) quand le slot courant sera suivi (Phase 6).
- ➡️ Socle IndexedDB en place pour la Preset Library (Phase 5).

---

## ADR-004: Recall des params SysEx-only via edit buffer (Phase 5b) — infra hors-hardware d'abord

Date: 2026-05-23
Status: Proposed (infra prête + testée ; envoi hardware NON validé)

### Context

Le recall complet d'un preset (oscillateur, type de filtre/IFX, mod, voice — params
que les CC ne savent pas régler) exige de renvoyer des données SysEx à la machine.
Deux chemins :
- **Current Pattern Dump (0x40)** renvoyé → chargé dans le **edit buffer** (volatile,
  n'écrase **aucun** slot flash). ACK attendu `DATA_LOAD_COMPLETED` (0x23).
- **Pattern Write Request (0x11)** vers un slot → **écriture flash destructive**.
  ACK `WRITE_COMPLETED` (0x21).

⚠️ `MIDI_FINDINGS §6` (séquence Pattern Write + ACK) a ses cases **non cochées** :
l'écriture hardware n'a **jamais été validée** sur la machine, et la convention
PH/PL du slot reste « à valider » (candidat probable 250 → `01 79`).

### Decision

1. **Recall = edit buffer (0x40), non destructif.** On part du dernier dump reçu
   (stocké brut dans `currentPattern.raw`), on patche **uniquement** les octets
   « son » SysEx-only du part visé (`patchPartSound`, offsets alignés sur le
   parser), et on reconstruit un Current Pattern Dump (`buildCurrentPatternDump`).
   Aucun slot n'est écrasé ; l'utilisateur revient à l'état d'origine en rechargeant
   le pattern sur la machine.
2. **Pattern Write (0x11) implémenté mais réservé** au futur « save vers slot »,
   gardé derrière une validation hardware sur slot 250 (§6).
3. **Aucun envoi câblé pour l'instant.** Le module `write.ts` ne fait que CONSTRUIRE
   des octets, prouvés byte-exact par `write.test.ts` (encode/decode roundtrip +
   patch chirurgical qui ne touche pas les parts voisins). La 1re écriture réelle
   passera par une session de validation sur la machine (le 0x40 charge-t-il bien
   l'edit buffer ? quel ACK ? comportement en playback ?).

### Consequences

- ✅ Progression à risque nul : toute la sérialisation est vérifiée hors-hardware.
- ✅ Garde-fou clair : pas d'octet envoyé à la machine sans validation préalable.
- ⏳ À faire avant de câbler l'envoi : valider sur hardware (slot 250 pour tout test
  0x11), remplir `MIDI_FINDINGS §6`, puis brancher l'envoi edit-buffer au bouton
  Recall (étendre le message « 14 params deferred » → appliqués).
- ➡️ Patch limité aux params « son » (oscType, voiceAssign, filterType, modType,
  ifxType, egOn, partPriority) ; mute / lastStep / groove / motionSeq restent hors
  preset (état de séquence, pas de son).

---

## ADR-005: Fusion EMX.PILOT × ENSEMBLE — un seul produit, le viewer comme panneau par-machine

Date: 2026-06-20
Status: Accepted

### Context

Deux specs coexistaient : **EMX.PILOT** (éditeur mono-machine, local, offline pour
la Korg Electribe 2 — ce repo) et **ENSEMBLE** (`docs/` externe : cockpit de jam
multijoueur à distance au-dessus de NINJAM). Décision produit de Bastou : ne pas
maintenir deux apps. ENSEMBLE doit **englober** le viewer. Objectif final : on va
sur ENSEMBLE même pour jouer/éditer seul, et EMX.PILOT disparaît en tant qu'app
séparée. En session, chacun **voit la machine des autres** (réplication
read-only) ; chacun ne **pilote que la sienne**.

Tension à arbitrer : « pas de bricolage — s'il faut reconstruire, on reconstruit »,
mais « faire évoluer ce repo » (historique + cœur MIDI gardés).

### Decision

1. **Un seul produit, ce repo.** On fait évoluer le repo existant vers ENSEMBLE
   (historique conservé). Le code éditeur d'EMX.PILOT n'est pas jeté : il devient
   le **panneau par-machine** d'ENSEMBLE. Jouer/éditer seul = une session à un
   joueur.

2. **Le joint de fusion = l'état device, pas l'UI.** L'archi existante
   (`bridge.ts` → stores Zustand → composants) sépare déjà MIDI et UI. On exploite
   ce joint : une machine locale est pilotée par Web MIDI ; la machine d'un pote
   est un `DeviceSnapshot` venu du réseau, injecté dans **les mêmes composants**.
   `src/core/session/snapshot.ts` définit ce contrat.

3. **Réplication read-only en v1.** On diffuse l'état des machines (parts, sons,
   params, part actif) ; le contrôle distant des machines d'autrui est explicitement
   reporté (conflits, latence, autorisations). Voir `protocol.ts`.

4. **Stack : on garde Vite + un serveur WS autonome — PAS Next.js.** La spec
   ENSEMBLE imposait Next ; on la révise. Web MIDI / Web USB sont strictement
   navigateur (impossibles en SSR), donc Next n'apporte aucune valeur ici et serait
   une couche d'impédance. Le choix *propre* (cohérent avec « pas de bricolage »)
   est un SPA client (stack EMX.PILOT rodée) + un process Node WebSocket séparé pour
   présence / BPM / réplication / cues.

5. **Transport audio abstrait (§8), backend NINJAM natif en v1.**
   `src/core/transport/` : interface `AudioTransport` + `NinjamTransport`. Le
   navigateur **ne porte jamais l'audio** en v1 (client natif Jamtaba/Reaper à
   côté). Jamulus/WebRTC = backends futurs sans toucher au cockpit.

6. **Device Profiles = JSON versionnés** sous `/device-profiles` (un fichier par
   machine), chargés par `src/core/profiles/`. Le savoir Electribe (CC map,
   identité SysEx, 16 parts) est transcrit dans `korg-electribe-2.json` (status
   `verified`). `elektron-model-samples.json` livré en `draft` (non validé hardware).

### Consequences

- ✅ Le travail MIDI testé (`ports.ts`, `deviceInquiry.ts`, `client.ts`, SysEx,
  CC map) est réutilisé tel quel ; il alimente directement l'auto-détection §4.
- ✅ « Jouer seul sur ENSEMBLE » tombe gratuitement (session de un).
- ✅ Le différenciateur (cues calés à la mesure) a son contrat dès maintenant
  (`Cue`, `landAtBar`) : le décalage d'une mesure devient le médium du signal.
- ⚠️ Reste à construire (neuf, hors repo aujourd'hui) : lecture clock MIDI →
  BPM + position dans la mesure ; le serveur WS ; le câblage stores ↔ snapshot ;
  l'orchestration NINJAM réelle ; l'UI cockpit.
- ➡️ Étape structurelle suivante : passer en monorepo (`apps/web`, `apps/ws-server`,
  `packages/midi`, `device-profiles/`) et renommer EMX.PILOT → ENSEMBLE dans
  README/manifeste. Faite séparément pour ne pas déstabiliser l'app qui marche.
- ➡️ `src/core/` accueille le domaine agnostique du produit (profiles, transport,
  session) ; `src/midi/` reste l'adaptateur Web MIDI ; `src/store|components/`
  l'éditeur, bientôt alimentable par snapshot réseau.

### Livré par ce commit (squelette, non câblé)

`src/core/profiles/` (types + registry + 2 profils JSON + tests),
`src/core/transport/` (AudioTransport + NinjamTransport),
`src/core/session/` (protocole WS + DeviceSnapshot). Typecheck + lint + 40 tests OK.
