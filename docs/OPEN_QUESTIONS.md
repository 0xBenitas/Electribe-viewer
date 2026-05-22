# Open Questions & Idées en attente

> Questions techniques ouvertes + idées de features capturées en cours de route.
> Rien ici n'est engagé : c'est un parking à idées pour ne rien perdre. Chaque
> entrée sera triée (spec'd / V2 / rejetée) au moment opportun, après le MVP.

---

## A. Idées de features (capturées — à spec'er post-MVP)

### A.1 — Visualisation générative live « voir sa musique » 🎯 (idée de Bastou)

**Le pitch (mots de Bastou)** : convertir le flux MIDI en **fonctions +
couleurs**, quelque chose de « complexe, beau et infini », pour **voir sa
musique** en temps réel. Ouvrable sur une **2ᵉ page / fenêtre en plein écran**,
pour la projeter pendant qu'on joue.

**Ce qui rend ça faisable (réel)** :
- Le flux MIDI live nous donne, à chaque instant :
  - quel **part** joue (canal MIDI per-part — confirmé Phase 0), à quel moment
    (timestamps ms), à quelle **vélocité** ;
  - chaque **CC** tweaké (Cutoff, Reso, etc.) avec sa valeur ;
  - le **tempo** déductible des intervalles entre notes (~80 BPM mesuré).
- À partir de ça on peut générer une viz pilotée par les données :
  formes/particules par part (couleur = couleur de part de la palette §9.1 spec),
  intensité = vélocité, mouvement = CC, pulsation = tempo. Mapping → fonctions
  paramétriques (Lissajous, champs de bruit, etc.).
- Techniquement : Canvas 2D / WebGL (shader), `requestAnimationFrame`, alimenté
  par le même MIDIClient que l'app. Plein écran sur une route dédiée
  (`/visualizer`) ou une fenêtre séparée synchronisée via `BroadcastChannel`.

**Limite honnête** : c'est piloté par les **données de contrôle** (notes, CC,
timing), **pas par l'audio**. On ne « voit » pas le timbre du son, on visualise
la performance MIDI. C'est déjà très riche.

**Statut** : 💡 idée V2 confirmée par Bastou comme « à intégrer ». À spec'er
proprement après le MVP (Phases 0-5). Lien spec §12 « Visualisation steps en
temps réel ».

**Questions ouvertes pour le jour où on la spec** :
- Fenêtre séparée (`window.open`) vs route plein écran dans la même app ?
- Presets de styles visuels ? Personnalisables ?
- Performance : combien de parts/CC simultanés avant de devoir throttler le rendu ?
- Enregistrer / exporter une session visuelle (vidéo / gif) ?

### A.2 — Co-pilote IA sur les patterns 🎯 (idée de Bastou)

**Le pitch** : une IA qui « comprend » un pattern et **aide à créer** sur
l'Electribe.

**Ce qui est faisable** : l'IA lit les **données du Pattern Dump SysEx** (OSC
types, filtres, enveloppes, steps, notes, motion) et peut :
- décrire/analyser la structure (genre, gamme, densité, rôle des parts) ;
- suggérer des variations, basslines, réglages de synthèse ;
- expliquer ce que fait un paramètre en langage simple (aide à l'apprentissage).

**Limite honnête** : travaille sur les **données symboliques**, pas sur l'audio.
Comme un musicien qui lit une partition sans l'entendre.

**Statut** : 💡 idée V2. Lien spec §12 « Tutorial mode synthesis 101 ». À
spec'er après MVP. Implique probablement un appel API (clé, coût, offline-first
à reconsidérer).

---

## B. Questions techniques ouvertes (Phase 0 et au-delà)

> Synchronisées avec spec §12. Statut mis à jour au fil des tests (voir
> `MIDI_FINDINGS.md`).

| # | Question | Statut |
|---|---|---|
| B.1 | Adressage per-part : peut-on **émettre** un CC sur le canal d'un part pour le piloter (même non sélectionné) ? | 🟡 Réception confirmée (CC suit le part sélectionné, ch6). **Émission à confirmer.** Bloque ADR-001. |
| B.2 | Mapping exact part N → canal MIDI N sur les 16 parts ? | 🟡 Fortement étayé (notes ch2/3/10/11, CC ch6). À confirmer part par part. |
| B.3 | Détection du **current edit part** depuis l'app (aucun message documenté) ? | 🔴 Ouvert. Le canal des CC knobs révèle le part sélectionné quand on tweak un knob → piste forte (cf. MIDI_FINDINGS §9). |
| B.4 | Comportement CC quand un param a une **motion sequence** enregistrée : override ou ignore ? | 🔴 Ouvert (spec §12). |
| B.5 | Mute / Solo per part via SysEx Pattern Write (byte Mute) ? | 🔴 Ouvert (spec §12). |
| B.6 | Latence réelle Program Change (ms / mesures) à l'**émission** ? | 🔴 À mesurer (format §6.6 validé en réception). |
| B.7 | Audio In (#409) comportement en MIDI ? | 🔴 Ouvert (spec §12). |
| B.8 | Décodage version firmware : octets `02 02 00 00` → afficher « 2.02 » et non « 2.2.0 ». | 🟡 Cosmétique, voir MIDI_FINDINGS 99.4. |
| B.9 | L'EMX2 expose 2 ports d'entrée USB → dédupliquer / choisir le bon en Phase 1. | 🟡 Identifié (MIDI_FINDINGS 99.2). |

---

## C. Décisions architecturales en attente (futurs ADR)

- **ADR-001** — Modèle d'adressage per-part : canaux MIDI per-part (pour params
  CC) + SysEx Pattern Write (pour params SysEx-only). À rédiger une fois B.1
  confirmé. **Révise la contrainte spec §1.1.**
