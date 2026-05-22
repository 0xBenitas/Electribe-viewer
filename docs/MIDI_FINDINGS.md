# MIDI Findings — Phase 0 Validation

> Protocole de validation hands-on de l'EMX2 (Korg Electribe 2) avant d'écrire du
> code. À remplir au fur et à mesure des tests via un MIDI monitor externe.
>
> **Spec de référence** : `emx-pilot-spec-v0.3.md`
> **Doc constructeur** : `electribe_MIDIimp.txt` (Korg MIDI Implementation v1.00, 2015-01-09)
> **Parameter Guide** : `electribe_PG_E4.pdf`

---

## Légende

- ✅ Conforme à la spec
- ⚠️ Conforme avec nuance / précision à ajouter
- ❌ Diverge de la spec → reporter en §99 Anomalies
- ⏳ À tester
- N/A : non applicable

Pour chaque test : noter la **date**, la **version firmware** de la machine, le
**MIDI monitor** utilisé, et les **données brutes** (hex) reçues/envoyées.

---

## 1. Setup recommandé

### 1.0 PRE-FLIGHT BACKUP — IMPORTANT

⚠️ Tous les tests qui écrivent sur la machine (section 6 Pattern Write et tout
autre test destructif) doivent cibler **EXCLUSIVEMENT le slot 250**.

**Pourquoi** : slot 250 est garanti vide d'usine ("Init Pattern"). Si une SD card
est disponible, faire **EXPORT ALL PATTERN** (`Globals → DATA UTILITY → EXPORT
ALL PATTERN`) avant la session de tests, en backup. Sans SD, le slot 250-only
est le seul filet de sécurité.

**Avant chaque test Pattern Write** : naviguer manuellement au slot cible,
confirmer sur le LCD que le nom est bien `Init Pattern` (= vide), puis procéder.

| Champ | Valeur observée |
|---|---|
| Backup SD effectué (EXPORT ALL PATTERN) | OUI / NON / N/A |
| Date du backup | _à remplir_ |
| Slot 250 confirmé `Init Pattern` avant la session | OUI / NON |

### 1.1 Firmware machine

- Vérifier la version firmware EMX2 : maintenir `SHIFT` + power-on, le LCD affiche
  la version (ex: `2.02`).
- Cible recommandée : **2.02** (latest, présent dans `electribe_system_v202.zip`).
- ⚠️ Si firmware < 2.02 : noter le numéro et le mentionner dans toutes les
  observations. Certaines variations de comportement MIDI peuvent dépendre du
  firmware.

| Champ | Valeur observée |
|---|---|
| Firmware EMX2 | _à remplir_ |
| Date des tests | _à remplir_ |
| OS host | _à remplir_ |
| Câble | USB-A ↔ USB-B (interne EMX2) |

### 1.2 MIDI Monitor recommandé

| Plateforme | Outil principal | Alternatives |
|---|---|---|
| **macOS** | [MIDI Monitor (Snoize)](https://www.snoize.com/MIDIMonitor/) — gratuit, affiche SysEx complet, timestamps ms | `Receive MIDI` dans Logic ; `mmonitor` CLI |
| **Linux** | `aseqdump -p <client:port>` (alsa-utils) pour CC/notes ; `amidi -p hw:X,Y,Z -d` pour SysEx raw ; **MIDI-OX** non dispo, alternative GUI = `gmidimonitor` | `qjackctl` + `qmidiroute` pour viz |
| **Windows** | [MIDI-OX](http://www.midiox.com/) — référence absolue, log SysEx + timestamps + injection arbitraire | `Pocket MIDI` plus simple |
| **Cross-platform** | [Web MIDI Tools](https://midi.studio.cool/) (Chrome) — utile pour tester depuis le browser même | `node-midi` + script custom |

**Pour cette Phase 0** : sur le poste de dev (host de l'app), utiliser un monitor
qui supporte **SysEx complet** ET timestamps ms — c'est non négociable pour
mesurer les latences round-trip.

### 1.3 Connexion

1. Brancher l'EMX2 en USB direct sur le host (pas de hub passif si possible —
   noter si on doit en utiliser un).
2. La machine est USB MIDI Class Compliant → aucun driver requis sur Mac/Linux.
   Sur Windows, le driver Korg est dans `DrvTools(115_r63e).exe` mais pas obligatoire.
3. Vérifier que le MIDI monitor liste deux ports :
   - `electribe` IN (ce que la machine envoie au host)
   - `electribe` OUT (ce que le host envoie à la machine)
4. **Note exact du nom de port tel qu'affiché par le browser** (Chrome / Edge) —
   utile pour la détection auto en Phase 1.

| Champ | Valeur observée |
|---|---|
| Nom port IN (OS) | _à remplir_ |
| Nom port OUT (OS) | _à remplir_ |
| Nom port (Chrome `MIDIInput.name`) | **`electribe2`** (observé 2026-05-22) |
| Nom port (Chrome `MIDIOutput.name`) | _à remplir_ |
| `MIDIInput.manufacturer` | _à remplir_ |
| `MIDIInput.id` (stable ?) | _à remplir_ |

⚠️ Détection auto Phase 1 : matcher sur `/electribe/i` (le name observé est
`electribe2`, sans espace).

### 1.4 Réglages machine recommandés avant tests

Aller dans `GLOBAL EDIT` (SHIFT + bouton GLOBAL) et noter / régler :

- **Global MIDI Channel** : noter la valeur (1-16). Toutes les commandes app
  seront émises sur ce canal. Recommandé : `1` (channel index `0`) pour tests.
- **Clock Mode** : `Internal` pour les tests (sinon la machine attend une horloge
  externe).
- **Receive Filter** : `Off` (sinon certains messages sont ignorés en réception).
- **Send Filter** : `Off`.
- **Knob Mode** : noter (Jump / Catch / Value Scale). Tester d'abord en `Jump`,
  retester en `Catch` pour le test §6.x.

| Réglage | Valeur observée |
|---|---|
| Global Channel | _à remplir_ |
| Clock Mode | _à remplir_ |
| Receive Filter | _à remplir_ |
| Send Filter | _à remplir_ |
| Knob Mode | _à remplir_ |

---

## 2. Détection / Identity Reply (Device Inquiry)

**But** : confirmer que l'Universal SysEx Identity Request reçoit bien une
réponse conforme à la spec §6.3.

### 2.1 Test — Identity Request « Any Channel »

**Procédure** :
1. Depuis le MIDI monitor, envoyer le SysEx suivant vers `electribe OUT` :
   ```
   F0 7E 7F 06 01 F7
   ```
2. Capturer le ou les messages reçus sur `electribe IN` dans les 1000 ms qui
   suivent.

**Attendu (selon spec §6.3 et `electribe_MIDIimp.txt` §1-3)** :
```
F0 7E 0g 06 02 42 23 01 00 00 vMaj vMin vRel 00 F7
                                            ^^^^^ (15 octets)
```
- Octet 2 : `0g` où `g` = Global MIDI Channel (0..F)
- Octets 5-7 : `42 23 01` (Korg + electribe family low+high)
- Octets 8-9 : `00 00` (member)
- Octets 10-12 : version major/minor/release

**Données à noter** :
- Hex brut complet de la réponse
- Délai de réponse (ms) — utile pour calibrer le timeout (spec : 1 s, mais en pratique souvent < 50 ms)
- `g` extrait → doit matcher le Global Channel réglé en §1.4

**Findings (2026-05-22)** :

```
[x] Réponse reçue              : OUI
[x] Hex brut                   : F0 7E 00 06 02 42 23 01 00 00 02 02 00 00 F7
[x] Latence (ms)               : ~21 ms (envoi .169 → réponse .190)
[x] Global Channel décodé (g)  : 0  (= MIDI channel 1)
[x] Version (octets bruts)     : 02 02 00 00  → firmware machine connu = 2.02
[x] Conforme spec              : ✅ (family 23 01, member 00 00 conformes §6.3)
[x] Notes                      : réponse reçue 2× (les 2 ports d'entrée USB, cf. 99.2).
                                  Device ID dans la réponse = 00 (la requête utilisait
                                  7F = Any). Décodage version à revoir : la spec lit
                                  data[10..12] = 02,02,00 → "2.2.0" mais le firmware
                                  réel est "2.02". Voir anomalie 99.4.
```

### 2.2 Test — Identity Request « Channel-spécifique »

**Procédure** : envoyer `F0 7E 0g 06 01 F7` avec `g` = Global Channel observé en
§2.1, puis avec un autre `g` (ex: `0F`).

**Attendu** : la machine répond seulement quand `g` = son Global Channel **ou**
quand `g = 7F` (Any). Confirmer.

**Findings** :

```
[ ] Réponse sur g=Global       : OUI / NON
[ ] Réponse sur g=Any (7F)     : OUI / NON
[ ] Réponse sur g=autre        : OUI / NON  (attendu: NON)
[ ] Notes                      :
```

### 2.3 Test — Robustesse (changement de Global Channel à chaud)

**Procédure** : changer le Global Channel sur la machine pendant que l'app est
théoriquement connectée (ex: 1 → 5). Renvoyer un Identity Request. Vérifier que
le Device ID dans la réponse a changé.

**Findings** :

```
[ ] Le Device ID reflète le nouveau channel : OUI / NON
[ ] Notes                                   :
```

---

## 3. CC outbound (host → EMX2)

**But** : valider que chacun des 17 CC mappés dans §6.4 du spec produit bien
l'effet documenté sur la machine.

**Pré-requis** :
- Régler le Global Channel à 1 (= MIDI ch 0).
- Sur la machine : sélectionner Part 1 comme current edit part (touche `PART <` /
  `PART >` ou pad de part). Le LCD doit afficher les params de Part 1.
- Mettre le knob mode à **Jump** pour ne pas avoir de catching pendant les tests.

### Procédure générique pour chaque CC

1. Noter la valeur affichée sur le LCD avant test pour le param.
2. Depuis le MIDI monitor, envoyer 3 valeurs distinctes (ex: `0x00`, `0x40`, `0x7F`)
   au CC testé sur le canal 0 :
   ```
   B0 <CC> 00
   B0 <CC> 40
   B0 <CC> 7F
   ```
3. Pour chaque envoi :
   - Vérifier que le LCD/affichage de la machine a changé.
   - Noter la valeur lue à l'écran.
   - Vérifier audio si possible (pour Cutoff/Reso/Level).
4. Pour les params **signed** : vérifier le mapping `0x00→-63 / 0x40→0 / 0x7F→+63`.
5. Pour **pan** : vérifier `0x00→L63 / 0x40→Center / 0x7F→R63`.
6. Pour **toggle** : vérifier `0x00→Off / 0x7F→On` ; tester aussi `0x3F` et
   `0x40` pour valider la frontière (spec : `>= 0x40 = on`).

### 3.1 — `ampLevel` (CC 7, unsigned)

| Send | Hex | Affichage attendu | Affichage observé |
|---|---|---|---|
| 0 | `B0 07 00` | Level 0 (silence) | _à remplir_ |
| 64 | `B0 07 40` | Level 64 | _à remplir_ |
| 127 | `B0 07 7F` | Level 127 (max) | _à remplir_ |

**Result** : ⏳ — Notes : _à remplir_

### 3.2 — `ampPan` (CC 10, pan)

| Send | Hex | Affichage attendu | Affichage observé |
|---|---|---|---|
| 0 | `B0 0A 00` | L63 | _à remplir_ |
| 64 | `B0 0A 40` | Center (CNT) | _à remplir_ |
| 127 | `B0 0A 7F` | R63 | _à remplir_ |

**Result** : ⏳ — Notes : _à remplir_

### 3.3 — `filterReso` (CC 71, unsigned)

| Send | Affichage attendu | Affichage observé |
|---|---|---|
| 0 | Reso 0 | _à remplir_ |
| 64 | Reso 64 | _à remplir_ |
| 127 | Reso 127 | _à remplir_ |

**Result** : ⏳ — Notes :

### 3.4 — `egDecay` (CC 72, unsigned)

⏳ — _à remplir mêmes 3 valeurs_

### 3.5 — `egAttack` (CC 73, unsigned)

⏳

### 3.6 — `filterCutoff` (CC 74, unsigned)

⏳ (param critique pour le throttle test §7)

### 3.7 — `oscPitch` (CC 80, signed)

| Send | Hex | Affichage attendu | Observé |
|---|---|---|---|
| 0 | `B0 50 00` | -63 (limite basse) | _à remplir_ |
| 1 | `B0 50 01` | -63 (idem, idiosyncrasie Korg, cf. spec §6.5) | _à remplir_ |
| 64 | `B0 50 40` | 0 | _à remplir_ |
| 127 | `B0 50 7F` | +63 | _à remplir_ |

**Result** : ⏳ — Vérifier que `00` et `01` mappent tous deux à -63 (cohérent avec l'encodage spec).

### 3.8 — `oscGlide` (CC 81, unsigned)

⏳

### 3.9 — `oscEdit` (CC 82, unsigned)

⏳ (effet dépend du type d'OSC du part actif)

### 3.10 — `filterEgInt` (CC 83, signed)

⏳ (mêmes points que §3.7)

### 3.11 — `modDepth` (CC 85, unsigned)

⏳

### 3.12 — `modSpeed` (CC 86, unsigned)

⏳

### 3.13 — `ifxEdit` (CC 87, unsigned)

⏳

### 3.14 — `masterFxX` (CC 102, unsigned)

⏳ — **Important** : le Master FX est **pattern-level**, pas part-level.
Vérifier que ce CC affecte bien le XY MFX du pattern indépendamment du current
edit part.

### 3.15 — `masterFxY` (CC 103, unsigned)

⏳ — idem §3.14.

### 3.16 — `ifxOnOff` (CC 104, toggle)

| Send | Hex | Attendu | Observé |
|---|---|---|---|
| 0x00 | `B0 68 00` | IFX Off | _à remplir_ |
| 0x3F | `B0 68 3F` | Off (spec: `< 0x40`) | _à remplir_ |
| 0x40 | `B0 68 40` | On (spec: `>= 0x40`) | _à remplir_ |
| 0x7F | `B0 68 7F` | On | _à remplir_ |

**Result** : ⏳ — vérifier la frontière `0x40`. Si la machine ne suit pas cette tolérance, noter en anomalie et envisager d'envoyer toujours `0x00 / 0x7F` côté app.

### 3.17 — `mfxSendOnOff` (CC 105, toggle)

⏳ — mêmes points.

### 3.18 — `mfxOnOff` (CC 106, toggle)

⏳ — Master FX (pattern-level), même remarque que §3.14.

### 3.19 — Test négatif : CC sur un autre canal MIDI

**Procédure** : envoyer `B5 4A 7F` (Cutoff sur canal 5 alors que Global = 0).
**Attendu** : aucun effet sur la machine.

**Findings** :
```
[ ] Aucun effet : ✅ / ❌
[ ] Notes       :
```

### 3.20 — Test négatif : CC non mappé

**Procédure** : envoyer `B0 0B 7F` (CC 11 = Expression, non mappé).
**Attendu** : aucun effet visible.

**Findings** :
```
[ ] Aucun effet : ✅ / ❌
[ ] Notes       :
```

---

## 4. CC inbound (EMX2 → host)

**But** : valider que les knobs / boutons physiques émettent les CC attendus
quand l'utilisateur les manipule.

**Pré-requis** :
- Send Filter = Off.
- Démarrer la capture sur le MIDI monitor (filtrer pour ne voir que les CC sur
  le Global Channel).
- Sélectionner Part 1 comme current edit part.

### Procédure générique

Pour chaque param testé :
1. Tourner le knob physique de la valeur min à max **lentement** (~3 secondes).
2. Noter le CC reçu et la plage de valeurs (typiquement `0..127`).
3. Vérifier la résolution (combien de valeurs distinctes émises sur la course
   complète) — utile pour dimensionner le throttle.
4. Tourner **rapidement** : noter si la machine émet à un débit plus haut
   (estimer Hz max si possible).

### 4.1 Tableau de résultats

**Findings (2026-05-22)** : test fait avec **Part 6 sélectionné** sur la machine.
**TOUS les CC reçus sont arrivés sur le canal MIDI 6** (`B5 ...`) → confirme que
les knobs émettent sur le canal du **part sélectionné** (Part 6 → ch6). Voir
anomalie 99.1 (résolution). Tous les numéros de CC conformes à §6.4.

| Knob / bouton | CC attendu | CC reçu | Canal | Plage observée | Conforme |
|---|---|---|---|---|---|
| Level | 7 | **7** | ch6 | 100→89 (descendant) | ✅ |
| Pan | 10 | **10** | ch6 | 125→121 (zone droite) | ✅ |
| Resonance | 71 | **71** | ch6 | 10↔22 | ✅ |
| EG Decay/Release | 72 | **72** | ch6 | 20↔32 | ✅ |
| EG Attack | 73 | **73** | ch6 | 63↔76 | ✅ |
| Cutoff | 74 | **74** | ch6 | 99↔126 | ✅ |
| OSC Pitch | 80 | **80** | ch6 | 62↔63 (≈ centre 64, signed) | ✅ |
| Glide | 81 | — | — | non testé | ⏳ |
| OSC Edit | 82 | **82** | ch6 | 88↔101 | ✅ |
| Filter EG Int | 83 | **83** | ch6 | 54↔64 (≈ centre 64, signed) | ✅ |
| Mod Depth | 85 | **85** | ch6 | 107↔118 | ✅ |
| Mod Speed | 86 | **86** | ch6 | 53↔56 | ✅ |
| IFX Edit | 87 | **87** | ch6 | 15↔23 | ✅ |
| Master FX X (touch) | 102 | — | — | non testé | ⏳ |
| Master FX Y (touch) | 103 | — | — | non testé | ⏳ |
| IFX On/Off button | 104 | — | — | non testé | ⏳ |
| MFX Send On/Off | 105 | — | — | non testé | ⏳ |
| MFX On/Off button | 106 | — | — | non testé | ⏳ |

**Reste à tester en inbound** : Glide (81), Master FX X/Y (102/103, via le ruban
tactile), et les 3 toggles (104/105/106, via les boutons). Plus : confirmer le
mapping part→canal en sélectionnant d'autres parts (Part 1 → ch1 ? Part 16 → ch16 ?).

### 4.2 Test — débit max sur tournage rapide

**Procédure** : tourner Cutoff à fond (rotation manuelle aussi rapide qu'un
humain peut le faire) et logger le nombre de messages CC 74 reçus sur 1 s.

**Findings** :
```
[ ] Pic de débit observé (msg/s) : ____
[ ] Notes                        :
```

Cette valeur sert de référence pour calibrer le throttle outbound de l'app
(spec §6.11 : flush 20 ms = 50 Hz).

### 4.3 Test — boutons On/Off émettent bien `0x00` et `0x7F` ?

Pour CC 104, 105, 106 : appuyer sur le bouton physique et noter la valeur émise.
Si la machine envoie autre chose que `0x00`/`0x7F`, le décodeur tolérant (spec
§6.5 `decodeToggle = midi >= 0x40`) doit gérer.

**Findings** :
```
[ ] CC 104 émet : ____ (off) / ____ (on)
[ ] CC 105 émet : ____ (off) / ____ (on)
[ ] CC 106 émet : ____ (off) / ____ (on)
```

---

## 5. SysEx — Current Pattern Dump round-trip

**But** : mesurer le temps de réponse à un Current Pattern Dump Request, vérifier
la taille et la structure.

### 5.1 Test — Request + reception complète

**Procédure** :
1. S'assurer que la machine est sur un pattern stable (pas en train de modifier
   un step).
2. Envoyer `F0 42 3g 00 01 23 10 F7` (où `g` = Global Channel) — `0x10` = `CURRENT_PATTERN_DUMP_REQUEST` (cf. spec §6.2).
3. Capturer le SysEx entrant. Mesurer **t0** = envoi → **t1** = première donnée
   reçue → **t2** = `F7` final reçu.

**Attendu** :
- Header reçu : `F0 42 3g 00 01 23 40 ...` (`0x40` = `CURRENT_PATTERN_DUMP`)
- Taille totale : **18 725 + 8 = 18 733 octets** (spec §6.7 : data raw 16 384 → 18 725 encoded MIDI ; + envelope 7 bytes header + 1 footer).

**Findings** :

```
[ ] Request envoyé hex            : F0 42 3_ 00 01 23 10 F7
[ ] Premier byte reçu après (ms)  : ____
[ ] F7 final reçu après (ms)      : ____  (= round-trip total)
[ ] Taille du SysEx reçu (bytes)  : ____
[ ] Header décodé (data[0..6])    : ____ ____ ____ ____ ____ ____ ____
[ ] Function byte (data[6])       : ____  (attendu: 0x40)
[ ] Conforme spec                 : ✅ / ⚠️ / ❌
[ ] Notes                         :
```

### 5.2 Test — Round-trip répété (jitter & stabilité)

Répéter le test §5.1 **10 fois** avec ~1 s entre chaque request. Noter les
latences pour évaluer la variance.

| # | Latence first byte (ms) | Latence F7 (ms) |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
| 9 | | |
| 10 | | |

**Stats** :
```
[ ] Latence F7 min  : ____ ms
[ ] Latence F7 max  : ____ ms
[ ] Latence F7 méd  : ____ ms
[ ] Latence F7 moy  : ____ ms
```

### 5.3 Test — Capture binaire pour la fixture parser

**Procédure** : sauver une capture brute du Current Pattern Dump (un seul
exemplaire suffit) au format binaire dans `tests/fixtures/pattern-dump.bin` (à
créer en Phase 4). Notes : nom du pattern, slot machine, à quoi il ressemble
(quels parts ont du contenu, etc.) pour pouvoir vérifier les valeurs après parsing.

**Findings** :
```
[ ] Fichier sauvé             : tests/fixtures/pattern-dump.bin
[ ] Pattern name              : ____
[ ] Slot machine              : ____
[ ] BPM                       : ____
[ ] Parts non-vides           : ____
[ ] Notes pour le parser test :
```

### 5.4 Test — Comportement durant playback

**Procédure** : démarrer la lecture d'un pattern (touche PLAY), envoyer le
Current Pattern Dump Request pendant qu'il joue.

**Question** : la machine répond-elle pendant le playback ? Y a-t-il un drop
audio, un glitch, ou une latence accrue ?

**Findings** :
```
[ ] Réponse reçue pendant playback : OUI / NON
[ ] Glitch audio observé           : OUI / NON / N/A
[ ] Latence F7 pendant playback    : ____ ms
[ ] Notes                          :
```

---

## 6. SysEx — Pattern Write round-trip + ACK

**But** : valider la séquence Pattern Dump → modify → Pattern Write → ACK
nécessaire au flow de Preset Recall sur part non-actif (§8.3 spec).

⚠️ **Précaution destructive** : tous les tests de cette section **écrivent** sur
la machine. **Cible obligatoire = slot 250 uniquement** (vide d'usine, "Init
Pattern"). Voir §1.0 PRE-FLIGHT BACKUP.

**Pré-vérification commune (à faire avant CHAQUE test de la section 6)** :
1. Sur la machine, naviguer manuellement au **slot 250**.
2. Confirmer sur le LCD que le nom affiché est bien `Init Pattern`.
3. Si ce n'est pas `Init Pattern` → **NE PAS PROCÉDER**, restaurer depuis le
   backup SD ou abandonner les tests d'écriture.

### 6.1 Test — Write d'un Pattern Dump existant (no-op) sur slot 250

Le plus prudent : capturer le pattern courant (§5.1), le ré-écrire tel quel sur
le **slot 250**. Le contenu du slot 250 sera remplacé par le pattern courant ;
on mesure le round-trip Write + ACK sans toucher aux autres slots.

**Procédure** :
1. ✅ Pré-vérification : slot 250 affiche `Init Pattern` sur le LCD.
2. Capturer le Current Pattern Dump (§5.1) → `dump_raw.bin`.
3. Construire un Pattern Write Request **vers slot 250** :
   `F0 42 3g 00 01 23 11 PH PL <18725 bytes data> F7`
   - `0x11` = `PATTERN_WRITE_REQUEST`
   - `PH PL` = encode du slot **250** (slot index `249` = `0xF9`). Convention
     Korg exacte (high/low, 7-bit) à valider durant le test — partir des
     candidats les plus probables :
     - `01 79` (high=1, low=0x79=121, `1*128 + 121 = 249`)  ← le plus probable
     - `00 F9` (single 8-bit) — peu probable car non 7-bit
   - Documenter la convention qui produit un ACK.
4. Envoyer le SysEx. Mesurer **t0** = envoi → **t_ack** = ACK reçu.
5. **Attendu** ACK : `F0 42 3g 00 01 23 21 F7` (`0x21` = `WRITE_COMPLETED`).
6. **NAK possible** : `F0 42 3g 00 01 23 22 F7` (`0x22` = `WRITE_ERROR`) ou
   `0x26` (`DATA_FORMAT_ERROR`) si SysEx malformé.

**Findings** :

```
[ ] Pré-vérif slot 250 = Init     : OUI / NON
[ ] Slot ciblé                    : 250 (fixe)
[ ] Convention PH PL retenue      : ____ (la valeur qui a produit un ACK)
[ ] ACK reçu                      : OUI / NON
[ ] Function byte ACK (data[6])   : 0x____ (attendu: 0x21)
[ ] Latence ACK (ms)              : ____
[ ] Latence après laquelle la
    machine est ré-utilisable     : ____ ms (peut être > latence ACK)
[ ] Notes                         :
```

**Cleanup recommandé après §6.1** : si tu veux remettre le slot 250 à `Init
Pattern` entre les tests, capturer une copie d'un slot connu vide, ou réinitialiser
manuellement. Sinon, le slot 250 reste avec le contenu écrit jusqu'à la fin de
la session — c'est OK, c'est le slot sacrifié.

### 6.2 Test — Write avec SysEx volontairement malformé (sur slot 250)

**Procédure** :
1. ✅ Pré-vérification : naviguer au slot 250 et confirmer sur le LCD que c'est
   bien le slot ciblé (le nom peut être `Init Pattern` ou ce qui a été écrit
   en §6.1, peu importe — l'important est de cibler 250 dans le SysEx).
2. Envoyer un Pattern Write **vers slot 250** avec data tronquée (ex: 100 bytes
   seulement). Attendu : NAK `0x26` (`DATA_FORMAT_ERROR`) — la machine **doit**
   refuser et **ne pas** corrompre le slot.

**Findings** :
```
[ ] Pré-vérif slot 250 ciblé   : OUI / NON
[ ] NAK reçu                   : OUI / NON
[ ] Function byte              : 0x____
[ ] Latence                    : ____ ms
[ ] La machine reste stable    : OUI / NON
[ ] Slot 250 préservé (pas
    écrasé silencieusement)    : ✅ / ❌
```

### 6.3 Test — Round-trip répété (jitter Write) sur slot 250

10 itérations de §6.1 (toutes vers le **slot 250**), noter la variance comme en §5.2.

✅ Pré-vérification : avant la 1ʳᵉ itération, confirmer slot 250 sur le LCD.
Entre les itérations, pas besoin de re-vérifier car on cible toujours le même
slot.

| # | Latence ACK (ms) |
|---|---|
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |
| 6 | |
| 7 | |
| 8 | |
| 9 | |
| 10 | |

**Stats** :
```
[ ] Latence ACK min  : ____ ms
[ ] Latence ACK max  : ____ ms
[ ] Latence ACK méd  : ____ ms
[ ] Latence ACK moy  : ____ ms
```

Cible spec (§1.2) : 150-300 ms. Si réel > 300 ms, alerter — impacte UX preset
recall.

### 6.4 Test — Write pendant playback (sur slot 250)

Question critique : peut-on écrire un pattern pendant que la machine joue ?
Glitch ? Refus ?

**Procédure** :
1. ✅ Pré-vérification : slot 250 ciblé.
2. Démarrer le playback d'un autre pattern (pas 250).
3. Envoyer le Pattern Write vers **slot 250** comme en §6.1.

**Findings** :
```
[ ] ACK reçu pendant playback : OUI / NON / NAK
[ ] Glitch audio              : OUI / NON
[ ] Notes                     :
```

---

## 7. Latence Program Change (Pattern Switch)

**But** : mesurer combien de temps / combien de mesures avant que le pattern
change réellement après envoi de `Bank Select + Program Change`.

> **Validation passive (2026-05-22)** : en changeant de pattern sur la machine,
> celle-ci a **émis** la séquence sur le canal global (ch1) :
> ```
> B0 00 00   ; Bank Select MSB = 0
> B0 20 01   ; Bank Select LSB = 1
> C0 4C      ; Program Change = 76  → slot 127 + 76 = 203
> ...
> C0 4D      ; Program Change = 77  → slot 204
> ```
> ✅ Confirme le **format §6.6** pour les slots > 127 (bankLSB=1, pc = slot−127)
> et que le switch pattern passe par le **canal global**, pas un canal de part.
> Reste à mesurer la **latence** quand l'app **émet** ce switch (tests ci-dessous).

### 7.1 Test — Switch arrêté (machine en stop)

**Procédure** :
1. Machine en STOP, sur pattern 1.
2. Envoyer la séquence (§6.6 spec) pour switcher vers pattern 5 :
   ```
   B0 00 00     ; Bank Select MSB = 0
   B0 20 00     ; Bank Select LSB = 0
   C0 05        ; Program Change = 5
   ```
3. Mesurer le délai entre envoi et changement effectif (LCD machine met-il à
   jour le numéro de pattern immédiatement ?).

**Findings** :
```
[ ] LCD switch après (ms)    : ____
[ ] Pattern courant changé   : ✅ / ❌
[ ] Notes                    :
```

### 7.2 Test — Switch en playback (timing musical)

**Procédure** :
1. Machine en PLAY, pattern 1, BPM 120 (= 500 ms / beat, 2 s / mesure 4/4).
2. Envoyer le PC vers pattern 5 à un moment arbitraire (mi-mesure).
3. Observer : la machine attend-elle la fin de la mesure courante ? La fin du
   pattern courant (selon longueur) ? Switch immédiat avec coupure ?

**Findings** :
```
[ ] Comportement observé  : Immédiat / Fin mesure / Fin pattern / Autre
[ ] Délai effectif (ms)   : ____
[ ] Délai en mesures      : ____
[ ] Glitch audio          : OUI / NON
[ ] Notes                 :
```

→ Implication spec : le state "queued" de l'app doit refléter le comportement
réel observé ici.

### 7.3 Test — Switch slot 128+ (bank LSB = 1)

**Procédure** : tester la convention slot > 127 (spec §6.6). Ex: slot 200.
- Slot 200 : `bankLSB = 0x01`, `pc = 200 - 127 = 73`
  ```
  B0 00 00
  B0 20 01
  C0 49     ; PC 73
  ```

**Findings** :
```
[ ] Pattern 200 chargé : ✅ / ❌
[ ] Notes              :
```

### 7.4 Test — PC sans Bank Select préalable

**Procédure** : envoyer juste `C0 05` sans Bank Select. La machine garde-t-elle
la dernière banque, ou y a-t-il un fallback ?

**Findings** :
```
[ ] Comportement : ____
[ ] Notes        :
```

---

## 8. Throttle CC saturation

**But** : déterminer le débit CC max que l'EMX2 peut absorber sans perte ni lag,
pour calibrer le throttle outbound (spec §6.11).

### 8.1 Test — Burst à 50 Hz sur Cutoff (CC 74)

**Procédure** :
1. Émettre depuis le MIDI monitor (ou un script CLI) **50 messages CC 74 / s
   pendant 10 s** avec valeurs croissantes (0..127..0..127...).
2. Observer la machine :
   - Le LCD/affichage suit-il fluide ?
   - Le filtre audio bouge-t-il en continu ou par paliers ?
   - Y a-t-il un retard cumulé entre la dernière valeur envoyée et la valeur
     finalement appliquée ?

**Findings** :
```
[ ] Réactivité visuelle  : Fluide / Saccadée / Retardée
[ ] Lag final estimé     : ____ ms
[ ] Notes                :
```

### 8.2 Test — Burst à 100 Hz

Idem mais 100 msg/s pendant 10 s.

**Findings** :
```
[ ] Réactivité visuelle  : Fluide / Saccadée / Retardée
[ ] Lag final estimé     : ____ ms
[ ] Erreurs / drops      : OUI / NON
[ ] Notes                :
```

### 8.3 Test — Burst à 200 Hz

Idem mais 200 msg/s.

**Findings** :
```
[ ] Réactivité visuelle  : Fluide / Saccadée / Retardée
[ ] Lag final estimé     : ____ ms
[ ] Erreurs / drops      : OUI / NON
[ ] Saturation observée  : OUI / NON
[ ] Notes                :
```

### 8.4 Test — Mix CC simultanés (réalisme)

**Procédure** : envoyer en parallèle 50 Hz sur CC 74, 50 Hz sur CC 71, 50 Hz sur
CC 7 (= 150 msg/s total) — ce qui est plus représentatif d'un usage XY pad +
sliders multiples.

**Findings** :
```
[ ] Réactivité  : Fluide / Saccadée / Retardée
[ ] Lag         : ____ ms
[ ] Notes       :
```

### 8.5 Recommandation throttle (à dériver des résultats)

Sur la base des observations §8.1-§8.4, recommander un débit max safe pour le
throttle de l'app :

```
[ ] Débit max safe (msg/s, par CC)       : ____
[ ] Débit max safe (msg/s, total stream) : ____
[ ] Flush interval recommandé (ms)       : ____  (vs spec : 20 ms)
[ ] Notes / décisions                    :
```

---

## 9. ⚠️ Détection du current edit part (grosse inconnue)

**But** : trouver une méthode permettant à l'app de connaître le part actif sur
la machine (§1.1 + §6.x spec : pas de message documenté pour ça).

**Importance** : l'UX du Part Pilot dépend du highlight de l'active part dans
la grille 16 parts. Si on ne peut pas le détecter, on doit **demander à
l'utilisateur** de cliquer manuellement → expérience dégradée.

### 9.1 Hypothèse A — Sniff complet pendant changement de part

**Procédure** :
1. Démarrer une capture exhaustive (CC + SysEx + System Real Time + Notes) du
   port `electribe IN` côté host.
2. Sur la machine, changer le current edit part en pressant `PART >` ou un pad
   en mode édition. Faire 5-6 changements (1→2→7→3→16→1).
3. Examiner toute la capture : trouve-t-on **n'importe quel message** émis au
   moment du changement de part ?

**Hypothèses sous-hypothèses** :
- Sub-A1 : un CC NRPN propriétaire / hors mappés est émis ?
- Sub-A2 : un SysEx propriétaire est émis ?
- Sub-A3 : la machine envoie un Current Pattern Dump implicitement ?
- Sub-A4 : rien n'est émis du tout (cas le plus probable selon `electribe_MIDIimp.txt` qui ne documente aucun "part select").

**Findings** :
```
[ ] Capture complète sauvée    : OUI / NON  (chemin: ________)
[ ] Messages observés au switch:
    - Sub-A1 NRPN              : OUI / NON  (détails: ________)
    - Sub-A2 SysEx             : OUI / NON  (détails: ________)
    - Sub-A3 Pattern Dump auto : OUI / NON
    - Sub-A4 Rien              : OUI / NON
[ ] Conclusion hypothèse A     : VIABLE / NON / PARTIEL
[ ] Notes                      :
```

### 9.2 Hypothèse B — Inférence par échos CC

**Idée** : quand l'utilisateur tourne un knob physique sur la machine, la machine
émet un CC sur le Global Channel. Ce CC reflète la valeur du **part actif**.
Donc :
- L'app a un cache local des 16 parts (via Pattern Dump).
- À la réception d'un CC inbound, comparer la valeur reçue avec la valeur
  cachée pour chaque part : le part avec la plus petite Δ (ou Δ=0) est
  probablement l'actif.
- Faiblesse : ambiguë si plusieurs parts ont la même valeur ; et seulement
  pertinent **après** que l'utilisateur ait tourné un knob.

**Procédure** :
1. Faire un Current Pattern Dump pour avoir un snapshot.
2. Sur la machine, switcher de Part 1 vers Part 5 (sans rien tourner).
3. Tourner Cutoff sur Part 5. Le host reçoit un `B0 4A xx`.
4. Comparer `xx` avec `cache[part5].cutoff` — match attendu.
5. Tester aussi : switcher vers Part 5 puis tourner un knob qui n'est pas
   modifié sur les autres parts (pour avoir une signature unique).

**Findings** :
```
[ ] CC reçu après tournage     : OUI / NON
[ ] La valeur reçue match
    cache[part5]               : ✅ / ❌
[ ] Inférence fiable en
    pratique                   : ✅ / ⚠️ / ❌
[ ] Notes                      :
```

### 9.3 Hypothèse C — Polling Pattern Dump périodique + diff

**Idée** : toutes les N secondes, l'app envoie un Current Pattern Dump Request,
parse le résultat, le compare au snapshot précédent. Le ou les parts dont les
valeurs ont changé révèlent le part actif (ou en tout cas le part en cours
d'édition).

**Coûts** :
- 18 725 octets MIDI / poll. À 1 Hz = ~150 kbit/s sur le bus MIDI USB. C'est
  beaucoup.
- Latence du dump : ~50-200 ms (à mesurer en §5.2).
- Interférence audio possible (à vérifier en §5.4).

**Procédure** :
1. Faire un dump initial → snapshot S0.
2. Switcher de part sur la machine, tourner un knob.
3. Faire un dump → snapshot S1. Comparer S0 vs S1.
4. Mesurer si la fréquence de poll soutenable (sans glitch audio ni saturation
   du bus) est compatible avec l'UX (réaction < 1 s).

**Findings** :
```
[ ] Dump périodique sans glitch : ✅ / ❌
[ ] Fréquence safe              : ____ Hz
[ ] Latence détection switch    : ____ ms
[ ] Coûts CPU host              : ____
[ ] Verdict                     : VIABLE / DÉGRADÉ / NON
[ ] Notes                       :
```

### 9.4 Hypothèse D — Trigger pads emitting Note On

**Idée** : en mode normal (non-édition), presser un pad de part déclenche le
son et émet potentiellement une `Note On` sur le Global Channel avec une
note distincte par part (ex: pad Part 1 = note 36, pad Part 2 = note 37,
etc.).

→ Si oui, on peut **inférer** quel pad a été touché en dernier comme proxy
du part actif (mais en mode édition pure, sans déclenchement audio, ça ne
marchera pas).

**Procédure** :
1. Désactiver Local pour ne pas avoir d'audio (si possible) ou juste écouter.
2. Presser chacun des 16 pads en mode normal. Noter les Notes On émises.

**Findings** :
```
[ ] Notes émises mappées par pad (note number par part 1..16) :
    Part 1  → ____   Part 2  → ____   Part 3  → ____   Part 4  → ____
    Part 5  → ____   Part 6  → ____   Part 7  → ____   Part 8  → ____
    Part 9  → ____   Part 10 → ____   Part 11 → ____   Part 12 → ____
    Part 13 → ____   Part 14 → ____   Part 15 → ____   Part 16 → ____
[ ] Mapping cohérent / consécutif : ✅ / ❌
[ ] Utilisable comme proxy        : ✅ / ⚠️ / ❌
[ ] Notes                         :
```

### 9.5 Synthèse — méthode retenue

À remplir après les tests §9.1-§9.4 :

```
[ ] Méthode retenue              : A / B / C / D / Combinaison / Aucune
[ ] Stratégie hybride proposée   :
[ ] Précisions techniques        :
[ ] Impact UX (latence détection):
[ ] Décision à acter en ADR ?    : OUI / NON  → ADR-NNN
```

---

## 10. Tests bonus (si temps disponible)

### 10.1 Comportement CC sur param sous Motion Sequence

**Question (spec §12)** : si un param est enregistré dans la motion sequence du
pattern, le CC envoyé override-t-il la motion ou est-il ignoré ?

**Procédure** : créer une motion sur Cutoff Part 1 avec des valeurs claires (0
au step 1, 127 au step 9). Pendant playback, envoyer `B0 4A 40` (Cutoff = 64).
Observer.

**Findings** :
```
[ ] Comportement : Override / Ignore / Mix
[ ] Notes        :
```

### 10.2 Mute via SysEx Pattern Write (sur slot 250)

**Question (spec §12)** : peut-on mute/unmute un part en flippant juste l'octet
Mute du PartParam dans un Pattern Write ? La latence serait celle du Write
(150-300 ms).

⚠️ Test **destructif** — cible obligatoire = **slot 250**.

**Procédure** :
1. ✅ Pré-vérification : naviguer au slot 250 sur le LCD.
2. Capturer un dump (depuis n'importe quel slot avec du contenu pour avoir un
   pattern audible), flipper le byte mute du Part 1 (offset 2048 + champ Mute,
   à confirmer via TABLE 6 de la doc Korg), Pattern Write **vers slot 250**.
3. Charger le slot 250 sur la machine et vérifier que Part 1 est bien muté.

**Findings** :
```
[ ] Pré-vérif slot 250 : OUI / NON
[ ] Mute appliqué      : ✅ / ❌
[ ] Latence            : ____ ms
[ ] Notes              :
```

### 10.3 Audio In behavior (#409 OSC type)

**Question (spec §12)** : comportement MIDI quand un part utilise OSC type 409
(Audio In).

**Findings** : _à explorer si pertinent_.

### 10.4 All Note Off behavior

**Procédure** : envoyer `B0 7B 00` (CC 123 = All Note Off, doc §2-1). Vérifier
qu'aucun son ne reste suspendu.

**Findings** :
```
[ ] All Note Off coupe les voies  : ✅ / ❌
[ ] Notes                         :
```

### 10.5 Hot plug / unplug USB

Débrancher / rebrancher pendant que l'app théorique est connectée.
- Le port disparaît-il proprement de l'OS (`onstatechange`) ?
- Au replug, l'ID du port est-il stable ? Le `name` est-il stable ?

**Findings** :
```
[ ] Détection unplug          : OK / Lag / Crash
[ ] Détection replug          : OK / Manual scan
[ ] ID port stable            : ✅ / ❌
[ ] Notes                     :
```

---

## 99. Anomalies

> Toutes les divergences entre ce qu'on observe et ce que la spec / la doc Korg
> annoncent. Format : titre court, ce qui est attendu, ce qui se passe, impact.

### 99.1 Les parts transmettent les notes sur des canaux MIDI individuels (contredit §1.1)

**Observation (2026-05-22, capture playback ~80 BPM, firmware à confirmer)** :
pendant la lecture d'un pattern, l'EMX2 a émis des Note On/Off sur **plusieurs
canaux MIDI distincts** — un par part :

| Canal MIDI observé | Status hex | Part présumé |
|---|---|---|
| 2 | `91` / `81` | Part 2 |
| 3 | `92` / `82` | Part 3 |
| 10 | `99` / `89` | Part 10 |
| 11 | `9A` / `8A` | Part 11 |

Toutes les notes : note 60 (`0x3C`), vélocité 96. Mapping apparent **part N →
canal MIDI N** (à confirmer en déclenchant chaque part individuellement).

**Attendu (spec §1.1 + §1.3)** : "l'EMX2 utilise UN SEUL canal MIDI (Global MIDI
Channel)" et "les CC affectent le part actuellement sélectionné en édition". La
spec a posé l'archi entière (mirror 1 part à la fois, SysEx Pattern Write lent
pour éditer un part non-actif) sur cette hypothèse.

**Observé** : au moins pour les **notes**, chaque part a son propre canal MIDI.

**Impact app (potentiellement majeur)** :
- Si les **CC** se comportent aussi par canal (à tester !), on peut adresser
  chaque part directement → **la contrainte §1.1 tombe**, et le workaround SysEx
  Pattern Write (~150-300 ms) pour les parts non-actifs devient **inutile** pour
  les params CC-mappés. Énorme simplification + UX temps réel multi-part.
- Ça change aussi la stratégie de détection du "current edit part" (§9) : le
  canal des notes révèle quels parts **jouent**, pas lequel est sélectionné en
  édition — mais c'est un signal exploitable de plus.

**À NE PAS conclure trop vite** : seules les **notes** ont été observées. Le
comportement des **CC** (knobs) n'a PAS encore été testé. Tout dépend de ça.

**Tests requis pour trancher** :
1. Déclencher chaque part 1→16 isolément, confirmer le mapping part→canal.
2. Tourner un knob (ex: Cutoff) sur un part donné → le CC arrive-t-il sur le
   canal de ce part, ou sur un canal global ?
3. Envoyer un CC sur le canal d'un part **non sélectionné** → modifie-t-il ce
   part (sans toucher l'edit part) ?

**Action proposée** : **NE PAS coder l'archi §1.1 telle quelle.** Tester les 3
points ci-dessus, puis réviser §1.1 avec Bastou. Candidat **ADR-001 : modèle
d'adressage per-part (canal MIDI vs current-edit-part + SysEx)**.

**MISE À JOUR (2026-05-22, capture knobs §4.1)** : confirmation partielle. Avec
Part 6 sélectionné, **tous les CC des knobs sont émis sur le canal 6**. Donc :
- ✅ Point 2 (CC suit le canal du part) : **confirmé en RÉCEPTION**.
- ✅ Mapping part N → canal N : fortement étayé (notes ch2/3/10/11 + CC ch6).
- ⏳ Point 3 (ENVOYER un CC sur le canal d'un part le pilote-t-il, même non
  sélectionné ?) : **reste à confirmer en ÉMISSION**. C'est le dernier test
  manquant pour valider l'archi multi-part temps réel. À faire en ajoutant un
  bouton d'envoi CC au probe, ou tôt en Phase 1/3.

→ Hypothèse d'archi forte : **on peut mirror et piloter les 16 parts en temps
réel via leurs canaux MIDI respectifs** (pour les params CC-mappés). Le SysEx
Pattern Write ne reste nécessaire que pour les params **SysEx-only** (OSC type,
voice assign, filter type, etc.). À acter en ADR-001 une fois l'émission confirmée.

### 99.2 Chaque message MIDI apparaît en double dans le log

**Observation** : chaque Note On/Off est loggé 2× à ~1 ms d'intervalle.

**Cause probable** : l'EMX2 expose vraisemblablement **deux endpoints d'entrée
USB-MIDI** (fréquent chez Korg), tous deux relayant le même flux ; OU le probe a
attaché son handler deux fois (init cliqué 2×, on voit 2 "Accès accordé").

**Impact app** : il faudra, en Phase 1, **dédupliquer** ou choisir explicitement
le bon port d'entrée (ne pas attacher de listener à tous les inputs aveuglément).

**Action proposée** : améliorer le probe pour étiqueter le port source de chaque
message, et lister les ports observés. Noter le nombre exact de ports IN/OUT.

### 99.3 _(template — à dupliquer pour chaque nouvelle anomalie)_

**Observation** : ___
**Attendu (spec / doc Korg, ref §___)** : ___
**Observé** : ___
**Impact app** : ___
**Workaround possible** : ___
**Action proposée** : ___ (mise à jour spec / ADR / ticket)

---

## 100. Synthèse

À remplir une fois tous les tests passés :

- [ ] **Tous les CC §6.4 fonctionnent comme spec** : ✅ / ⚠️ / ❌
- [ ] **Device Inquiry fiable < 100 ms** : ✅ / ⚠️ / ❌
- [ ] **Current Pattern Dump round-trip mesuré** : médiane ____ ms
- [ ] **Pattern Write + ACK mesuré** : médiane ____ ms — dans la cible 150-300 ms : ✅ / ❌
- [ ] **Throttle CC 50 Hz validé sans perte** : ✅ / ⚠️ / ❌
- [ ] **Méthode de détection current edit part** : retenue : ____
- [ ] **Anomalies bloquantes** : ____

**Décisions à prendre suite à Phase 0** :

1.
2.
3.

**ADRs à rédiger** :

- ADR-001 : ____
- ADR-002 : ____
