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
