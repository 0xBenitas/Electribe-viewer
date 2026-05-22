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
