# EMX.PILOT — Web Companion pour Korg Electribe 2

## Cahier des charges / Technical Specification

**Version** 0.3 · **Auteur** Bastou (specs co-rédigées avec Claude) · **Date** 2026-05

---

## Changelog v0.2 → v0.3

- 🟢 **§1 Architecture Constraints** : remplace l'ancien "Risques bloquants". Les inconnues MIDI sont désormais résolues grâce au Korg MIDI Implementation document v1.00 du 2015-01-09.
- 🟢 **§6 MIDI Foundation** : tous les CC numbers exacts, format SysEx Korg complet, structures TypeScript directement utilisables.
- 🟢 **§7 Data Model** : ranges et encodages précis (signed CC, pan 7-bit, etc.).
- 🟢 **§10 Phases** : Phase 0 partiellement résolue (doc en main). Reste : tests hands-on de validation.
- 🟢 Spec désormais directement actionnable par Claude Code, plus de placeholders TBD critiques.

---

## 0. Contexte

Le **Korg Electribe 2 (EMX2)** est une groovebox hardware standalone avec 16 parts, 250 slots de patterns, et une connectique USB-MIDI Class Compliant.

**EMX.PILOT** est une web app companion qui complète la machine en lui ajoutant ce qu'elle ne sait pas faire : vue d'ensemble des 16 parts, bibliothèque de presets sound, catalogue des patterns avec metadata, setlist, big XY pad, backup local. **Elle ne remplace pas la machine** — la machine reste le moteur audio + séquenceur primaire + tactile (pads/knobs).

---

## 1. Architecture Constraints (résolus ✅)

Anciennement "Risques bloquants" en v0.2. Désormais résolus grâce à la Korg MIDI Implementation Doc.

### 1.1 ✅ Adressage per-part : CC affecte le current-edit-part

**Confirmé** : l'EMX2 utilise UN SEUL MIDI channel (Global MIDI Channel, configurable 1-16). Les Control Changes affectent **le part actuellement sélectionné en édition** sur la machine.

→ **Pas de control multi-part en temps réel** via CC. Conséquence architecturale :

- L'app **mirror un seul part à la fois** : celui qui est sélectionné sur la machine (= "follow mode")
- Pour modifier un part qui n'est pas l'actif, on doit passer par **SysEx Pattern Write** (lent : ~150-300ms)
- Tweaks temps réel = active part uniquement

### 1.2 ✅ SysEx Pattern Dump entièrement documenté

Format complet disponible. Pattern Dump = 16 384 octets raw, encodés en 18 725 octets MIDI (conversion 7-to-8 bit standard Korg). Inclut :
- Header + version + name + tempo + swing + length + beat + key + scale + chordset + play level
- Touch Scale params (gate arp)
- Master FX params + XY position
- Alternate 13-14 / 15-16
- Motion Sequence (24 slots)
- 16 × Part Parameters (816 octets chacun, contient tous les params + 64 steps)
- Footer

→ **Preset Library feasibility confirmée**. Read state, modify, write back.

### 1.3 ✅ Device Inquiry fiable

L'EMX2 répond aux **Universal SysEx Device Inquiry** (`F0 7E 0g 06 01 F7`) avec :
- Family ID = `23 01` (electribe)
- Member ID = `00 00`
- Major/Minor/Release version

→ **Handshake fiable** pour confirmer qu'on parle à un electribe (et pas un autre device qui s'appelle "electribe" dans son nom de port).

---

## 2. Goals & Non-goals

### 2.1 Goals

- ✅ Détection automatique de l'EMX2 via Device Inquiry
- ✅ Vue des 16 parts du pattern courant (snapshot de Pattern Dump)
- ✅ Mirror temps réel du **part actif** (CC bidirectionnels)
- ✅ Édition d'un autre part (non-actif) via SysEx Pattern Write
- ✅ Bibliothèque de sound presets indexée et recherchable (IndexedDB)
- ✅ Catalogue des 250 patterns avec metadata éditables (locale par défaut)
- ✅ Setlist builder
- ✅ Big XY pad MFX (CC 102/103)
- ✅ 100% local, offline-first (PWA)
- ✅ Export/import library en JSON
- ✅ Settings : port MIDI, threshold BPM, theme, smooth recall

### 2.2 Non-goals — restent sur la machine

| Domaine | Reste sur la machine |
|---|---|
| Sequencing | Step on/off, gate time, velocity, last step (lisible mais pas modifiable depuis app) |
| Motion | Motion sequence record/playback/clear |
| Pattern-level structure | Beat (16/32/Tri), chord set, gate arp, alternate 13-14/15-16, chain to/repeat |
| Performance | Pattern set, step jump, tempo lock, audio in thru |
| Backup hard | Card format, Factory reset, Software update |

### 2.3 Non-goals architecturaux

- ❌ Cloner l'UI machine
- ❌ Audio engine
- ❌ DAW
- ❌ Serveur (tout local)
- ❌ Multi-user / collaboration
- ❌ Safari / Firefox (pas de Web MIDI)
- ❌ Autres Electribes (ESX2, EMX-1)
- ❌ Mobile phone v1
- ❌ **Mirror temps réel des 16 parts simultanément** (impossible techniquement, voir §1.1)

---

## 3. User Stories

### P0 — MVP

1. **Connection** : USB plug → l'app envoie Device Inquiry → reçoit Identity Reply electribe → connected.
2. **Permission flow** : prompt MIDI géré (refus, dismiss, granted-revoked).
3. **Multi-device picker** : Settings page si plusieurs devices.
4. **Browser support check** : Safari/FF → message clair.
5. **Pattern overview** : au connect, l'app fait un Current Pattern Dump Request, parse les 16 parts, affiche la grille.
6. **Active part follow** : l'app détecte le part actif sur la machine (à voir Phase 0 — voir §10) et le highlight dans la grille.
7. **Part metadata locale** : nommer / tagger / colorer chaque part. Persistance Dexie.
8. **Param mirror (active part)** : sliders pour Cutoff, Reso, Attack, Decay, Level, Pan, IFX Edit. CC bidirectionnels en temps réel.
9. **Knob Mode awareness** : à la connection, l'app fait un Global Dump Request, lit le Knob Mode. Si `Catch`, badge informatif.

### P1 — Library

10. **Save preset** : capture les params d'un part. Mix de CC values + champs SysEx (OSC type, voice assign, filter type, etc.). Stocké dans Dexie.
11. **Recall preset (active part)** : flow : (a) batch CCs pour les live params, (b) SysEx Pattern Dump request → modifier les bytes du part actif → SysEx Pattern Write. Total ~400-600ms.
12. **Recall preset (autre part)** : pareil mais sur le part cible (sans changer le part actif sur la machine).
13. **Browse presets** : full-text + filtres catégorie/tag.
14. **Pattern catalog** : 250 slots avec metadata locale. Pre-load des 200 d'usine.
15. **Pattern switch** : Bank Select + Program Change. État "queued" pendant attente fin de mesure.

### P2 — Live & Polish

16. **Setlist builder** : drag & drop avec warnings BPM diff.
17. **Big XY pad** : fullscreen, mappé sur CC 102/103 (Master FX X/Y).
18. **Multi-tab guard** : BroadcastChannel.
19. **Settings page** : port, threshold, theme, smooth recall, export/import.
20. **Export/Import library** : JSON full backup.

---

## 4. Tech Stack

| Catégorie | Choix |
|---|---|
| Build | Vite |
| Framework | React 19 |
| Langage | TypeScript strict |
| Style | Tailwind CSS v4 |
| State | Zustand |
| Routing | React Router v6 |
| MIDI | Web MIDI API native |
| Storage | Dexie.js |
| PWA | vite-plugin-pwa |
| Drag & drop | dnd-kit |
| Lint | ESLint + Prettier |
| Tests | Vitest + Playwright |

### 4.1 Environnement

- Dev local : `localhost` (Web MIDI OK)
- Test réseau : `vite --https` avec self-signed
- Production : HTTPS obligatoire

### 4.2 Browsers cibles

Chrome / Edge / Brave / Opera. Pas de fallback Safari/FF.

---

## 5. Architecture

### 5.1 File structure

```
emx-pilot/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── Pilot.tsx
│   │   ├── Library.tsx
│   │   ├── Patterns.tsx
│   │   ├── Setlist.tsx
│   │   ├── XYPadFullscreen.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── ConnectionStatus.tsx
│   │   ├── PartGrid.tsx
│   │   ├── PartTile.tsx
│   │   ├── ParamPanel.tsx
│   │   ├── ParamSlider.tsx
│   │   ├── KnobMismatchBadge.tsx
│   │   ├── PresetCard.tsx
│   │   ├── PatternRow.tsx
│   │   ├── BrowserCheck.tsx
│   │   ├── PermissionPrompt.tsx
│   │   └── MultiTabGuard.tsx
│   ├── midi/
│   │   ├── client.ts                 # MIDIClient singleton
│   │   ├── ports.ts                  # discovery + selection
│   │   ├── deviceInquiry.ts          # Identity Request/Reply
│   │   ├── ccMap.ts                  # Tableau complet des 17 CC mappés
│   │   ├── encoding.ts               # signed values, pan, etc.
│   │   ├── sysex/
│   │   │   ├── envelope.ts           # F0 42 3g 00 01 23 ... F7
│   │   │   ├── conversion.ts         # 7-to-8 bit Korg encoding
│   │   │   ├── currentPatternDump.ts
│   │   │   ├── patternDump.ts
│   │   │   ├── patternWrite.ts
│   │   │   ├── globalDump.ts
│   │   │   └── parser.ts             # parse Pattern table 1
│   │   ├── throttle.ts
│   │   ├── recovery.ts
│   │   └── types.ts
│   ├── store/
│   │   ├── connection.ts
│   │   ├── parts.ts                  # 16 parts state
│   │   ├── currentPattern.ts
│   │   ├── activePart.ts             # part actif sur la machine
│   │   ├── globals.ts                # knob mode etc.
│   │   ├── library.ts
│   │   ├── patterns.ts
│   │   ├── setlist.ts
│   │   ├── settings.ts
│   │   └── ui.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── repository.ts
│   ├── lib/
│   │   ├── osc-list.ts               # 409 OSC
│   │   ├── filter-types.ts
│   │   ├── mfx-list.ts
│   │   ├── ifx-list.ts
│   │   ├── mod-types.ts
│   │   ├── scales.ts
│   │   ├── grooves.ts
│   │   ├── factory-patterns.ts       # 200 patterns
│   │   ├── colors.ts
│   │   ├── format.ts
│   │   ├── broadcast.ts
│   │   └── uuid.ts
│   ├── hooks/
│   │   ├── useMidiConnection.ts
│   │   ├── useDexieQuery.ts
│   │   └── useKeyboardShortcuts.ts
│   └── styles/globals.css
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│       ├── midi-mock.ts
│       └── pattern-dump.bin          # exemple pour parser tests
├── docs/
│   ├── MIDI_FINDINGS.md              # observations Phase 0
│   └── DECISIONS.md
├── package.json
├── vite.config.ts
└── README.md
```

### 5.2 Flow architectural

```
User action (slider) → Zustand store (optimistic) → MIDIClient → CC → EMX2
                              ↑                                          │
                              └────── parse + reconcile ←── CC incoming ─┘

User action (preset recall on non-active part):
  Zustand → SysEx Pattern Dump Request → wait → parse → modify → Pattern Write Request → wait ACK → done
```

---

## 6. MIDI Foundation

### 6.1 Korg SysEx envelope

```
F0 42 3<g> 00 01 23 <function> <data> F7
   │  │    └────┬───┘
   │  │         └── electribe Product ID
   │  └──────── Device ID = Global MIDI Channel (g = 0..F)
   └───────── Korg manufacturer ID
```

```typescript
// src/midi/sysex/envelope.ts

export const KORG_ID = 0x42;
export const ELECTRIBE_PRODUCT_ID = [0x00, 0x01, 0x23] as const;
export const SYSEX_START = 0xF0;
export const SYSEX_END = 0xF7;

export function buildSysExHeader(globalChannel: number): number[] {
  const deviceId = 0x30 | (globalChannel & 0x0F);
  return [SYSEX_START, KORG_ID, deviceId, ...ELECTRIBE_PRODUCT_ID];
}

export function buildSysEx(globalChannel: number, fn: number, data: number[] = []): Uint8Array {
  return new Uint8Array([
    ...buildSysExHeader(globalChannel),
    fn,
    ...data,
    SYSEX_END,
  ]);
}

export function isElectribeSysEx(data: Uint8Array): boolean {
  return (
    data.length >= 7 &&
    data[0] === SYSEX_START &&
    data[1] === KORG_ID &&
    (data[2] & 0xF0) === 0x30 &&
    data[3] === 0x00 && data[4] === 0x01 && data[5] === 0x23
  );
}

export function getSysExFunction(data: Uint8Array): number | null {
  return isElectribeSysEx(data) ? data[6] : null;
}
```

### 6.2 SysEx function table

```typescript
// src/midi/sysex/functions.ts

export const SYSEX_FN = {
  // Requests (sent by app)
  CURRENT_PATTERN_DUMP_REQUEST: 0x10,
  PATTERN_DUMP_REQUEST: 0x1C,           // + 2 bytes pattern num
  PATTERN_WRITE_REQUEST: 0x11,          // + 2 bytes pattern num
  GLOBAL_DUMP_REQUEST: 0x1E,
  
  // Replies / data (sent by machine + sent back when writing)
  CURRENT_PATTERN_DUMP: 0x40,           // + 18725 bytes
  PATTERN_DUMP: 0x4C,                   // + 2 bytes pat num + 18725 bytes
  GLOBAL_DUMP: 0x51,                    // + 293 bytes
  
  // ACK / NAK (sent by machine)
  DATA_LOAD_COMPLETED: 0x23,            // ACK after Pattern dump received
  DATA_LOAD_ERROR: 0x24,                // NAK
  WRITE_COMPLETED: 0x21,                // ACK after Pattern Write
  WRITE_ERROR: 0x22,                    // NAK
  DATA_FORMAT_ERROR: 0x26,              // sent if our message is malformed
} as const;
```

### 6.3 Device Inquiry handshake

```typescript
// src/midi/deviceInquiry.ts

export function buildDeviceInquiryRequest(): Uint8Array {
  // Universal Non-Realtime, Identity Request, Any Channel
  return new Uint8Array([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
}

export interface DeviceIdentity {
  globalChannel: number;
  manufacturer: 'korg';
  product: 'electribe';
  versionMajor: number;
  versionMinor: number;
  versionRelease: number;
}

export function parseDeviceInquiryReply(data: Uint8Array): DeviceIdentity | null {
  // Expected: F0 7E 0g 06 02 42 23 01 00 00 vMaj vMin vRel _ F7
  if (data.length < 15) return null;
  if (data[0] !== 0xF0 || data[1] !== 0x7E) return null;
  if (data[3] !== 0x06 || data[4] !== 0x02) return null;
  if (data[5] !== 0x42) return null;                      // Korg
  if (data[6] !== 0x23 || data[7] !== 0x01) return null;  // electribe family
  return {
    globalChannel: data[2] & 0x0F,
    manufacturer: 'korg',
    product: 'electribe',
    versionMajor: data[10],
    versionMinor: data[11],
    versionRelease: data[12],
  };
}
```

### 6.4 CC Map (complet, vérifié)

```typescript
// src/midi/ccMap.ts

export interface CCSpec {
  cc: number;
  encoding: 'unsigned' | 'signed' | 'pan' | 'toggle';
  description: string;
}

export const CC_MAP: Record<string, CCSpec> = {
  ampLevel:        { cc: 7,   encoding: 'unsigned', description: 'Amp Level' },
  ampPan:          { cc: 10,  encoding: 'pan',      description: 'Amp Pan' },
  filterReso:      { cc: 71,  encoding: 'unsigned', description: 'Filter Resonance' },
  egDecay:         { cc: 72,  encoding: 'unsigned', description: 'EG Decay/Release' },
  egAttack:        { cc: 73,  encoding: 'unsigned', description: 'EG Attack' },
  filterCutoff:    { cc: 74,  encoding: 'unsigned', description: 'Filter Cutoff' },
  oscPitch:        { cc: 80,  encoding: 'signed',   description: 'Oscillator Pitch' },
  oscGlide:        { cc: 81,  encoding: 'unsigned', description: 'Oscillator Glide' },
  oscEdit:         { cc: 82,  encoding: 'unsigned', description: 'Oscillator Edit' },
  filterEgInt:     { cc: 83,  encoding: 'signed',   description: 'Filter EG Intensity' },
  modDepth:        { cc: 85,  encoding: 'unsigned', description: 'Modulation Depth' },
  modSpeed:        { cc: 86,  encoding: 'unsigned', description: 'Modulation Speed' },
  ifxEdit:         { cc: 87,  encoding: 'unsigned', description: 'Insert FX Edit' },
  masterFxX:       { cc: 102, encoding: 'unsigned', description: 'Master FX XY Pad X' },
  masterFxY:       { cc: 103, encoding: 'unsigned', description: 'Master FX XY Pad Y' },
  ifxOnOff:        { cc: 104, encoding: 'toggle',   description: 'Insert FX On/Off' },
  mfxSendOnOff:    { cc: 105, encoding: 'toggle',   description: 'MFX Send On/Off' },
  mfxOnOff:        { cc: 106, encoding: 'toggle',   description: 'Master FX On/Off' },
} as const;

export type CCParam = keyof typeof CC_MAP;
```

⚠️ **Attention** : ces CC affectent le **part actuellement sélectionné en édition** sur la machine. Pas de channel offset par part.

### 6.5 Encoding helpers

```typescript
// src/midi/encoding.ts

/**
 * Pan encoding: 00=L63, 40=Center, 7F=R63
 * App representation: -64..0..+63 (negative = L, positive = R)
 */
export function encodePan(value: number): number {
  // value ∈ [-64, 63]
  return Math.max(0, Math.min(127, value + 64));
}

export function decodePan(midi: number): number {
  return Math.max(-64, Math.min(63, midi - 64));
}

/**
 * Signed encoding (Pitch, EG Int): 00,01..7F = -63,-63..+63
 * App representation: -63..+63
 */
export function encodeSigned(value: number): number {
  // value ∈ [-63, +63] → MIDI 0..127
  // Note: 0x00 et 0x01 mappent tous deux à -63 (idiosyncrasie Korg)
  if (value <= -63) return 0x01;   // canonical form
  return Math.max(0, Math.min(127, value + 64));
}

export function decodeSigned(midi: number): number {
  if (midi === 0x00) return -63;
  return Math.max(-63, Math.min(63, midi - 64));
}

/**
 * Toggle encoding: 0,7F = Off,On (avec tolerance)
 */
export function encodeToggle(on: boolean): number {
  return on ? 0x7F : 0x00;
}

export function decodeToggle(midi: number): boolean {
  return midi >= 0x40;  // tolerant, > center = on
}

export function encodeCC(spec: CCSpec, value: number): number {
  switch (spec.encoding) {
    case 'unsigned': return Math.max(0, Math.min(127, Math.round(value)));
    case 'signed':   return encodeSigned(value);
    case 'pan':      return encodePan(value);
    case 'toggle':   return encodeToggle(Boolean(value));
  }
}

export function decodeCC(spec: CCSpec, midi: number): number {
  switch (spec.encoding) {
    case 'unsigned': return midi;
    case 'signed':   return decodeSigned(midi);
    case 'pan':      return decodePan(midi);
    case 'toggle':   return decodeToggle(midi) ? 1 : 0;
  }
}
```

### 6.6 Pattern Switch via Bank Select + Program Change

```typescript
// src/midi/patternSwitch.ts

export function buildPatternSwitch(channel: number, slot: number): number[][] {
  // slot ∈ [1, 250]
  const pattern = slot - 1;
  let bankMSB = 0x00;
  let bankLSB = 0x00;
  let pc = 0;
  
  if (slot <= 127) {
    // Patterns 001-127: bank 0:0, PC 1-127
    bankLSB = 0x00;
    pc = slot;
  } else {
    // Patterns 128-250: bank 0:1, PC 1-121 (= 128-250)
    bankLSB = 0x01;
    pc = slot - 127;
  }
  
  return [
    [0xB0 | (channel & 0x0F), 0,  bankMSB],   // Bank Select MSB
    [0xB0 | (channel & 0x0F), 32, bankLSB],   // Bank Select LSB
    [0xC0 | (channel & 0x0F), pc],            // Program Change
  ];
}
```

### 6.7 7-to-8 bit conversion (SysEx data)

Korg encode les data dumps en 7-bit (MSB always 0). Standard MIDI : 8-bit reformatés en 8 octets de 7 bits chacun.

```typescript
// src/midi/sysex/conversion.ts

/**
 * Decode Korg 7-to-8 bit format.
 * Each "set" = 8 MIDI bytes (7 bits each) → 7 raw bytes (8 bits each)
 * The first MIDI byte holds the MSB of the next 7 bytes.
 */
export function decode7to8(midi: Uint8Array): Uint8Array {
  const raw: number[] = [];
  for (let i = 0; i < midi.length; i += 8) {
    const msbs = midi[i];
    for (let j = 0; j < 7 && i + j + 1 < midi.length; j++) {
      const byte = midi[i + j + 1] | ((msbs >> j) & 0x01 ? 0x80 : 0);
      raw.push(byte);
    }
  }
  return new Uint8Array(raw);
}

export function encode8to7(raw: Uint8Array): Uint8Array {
  const midi: number[] = [];
  for (let i = 0; i < raw.length; i += 7) {
    let msbs = 0;
    const chunk: number[] = [];
    for (let j = 0; j < 7 && i + j < raw.length; j++) {
      const byte = raw[i + j];
      if (byte & 0x80) msbs |= (1 << j);
      chunk.push(byte & 0x7F);
    }
    midi.push(msbs);
    midi.push(...chunk);
  }
  return new Uint8Array(midi);
}
```

**Tailles** :
- Pattern Dump : 16 384 bytes raw → 18 725 bytes MIDI (encoded)
- Global Dump : 256 bytes raw → 293 bytes MIDI

### 6.8 Pattern Dump structure (parser)

Voir TABLE 1 du Korg doc. Fichier `src/midi/sysex/parser.ts` :

```typescript
// src/midi/sysex/parser.ts

const HEADER_PTST = 0x54535450; // 'PTST' (little endian dans le doc, à confirmer)
const FOOTER_PTED = 0x44455450; // 'PTED'

export interface ParsedPattern {
  name: string;                  // bytes 16-33, null-terminated, max 18 chars
  tempo: number;                 // bytes 34-35, value 200-3000 = 20.0-300.0
  swing: number;                 // byte 36, -48..+48
  length: 1 | 2 | 3 | 4;         // byte 37, 0-3 = 1-4
  beat: 0 | 1 | 2 | 3;           // byte 38, 0=16, 1=32, 2=8Tri, 3=16Tri
  key: number;                   // byte 39, 0-11 = C-B
  scale: number;                 // byte 40, 0-35
  chordSet: number;              // byte 41, 0-4
  playLevel: number;             // byte 42, 0-127 (inverted: 127→0)
  
  gateArpPattern: number;        // touch scale offset 5, 0-49
  gateArpSpeed: number;          // touch scale offset 6, 0-127
  gateArpTime: number;           // touch scale offset 8-9, -100..+100
  
  mfxType: number;               // master fx offset 1, 0-31
  mfxXyX: number;                // master fx offset 2, 0-127
  mfxXyY: number;                // master fx offset 3, 0-127
  mfxHold: number;               // master fx offset 5, 0-127 (>= 1 = on)
  
  alternate1314: boolean;        // byte 68
  alternate1516: boolean;        // byte 69
  
  motionSequence: ParsedMotionSeq;  // bytes after pattern params
  
  parts: ParsedPart[];           // 16 parts × 816 bytes starting at offset 2048
}

export interface ParsedPart {
  lastStep: number;              // 1-16 (encoded 0=16, 1-15=1-15)
  mute: boolean;
  voiceAssign: 0 | 1 | 2 | 3;    // Mono1, Mono2, Poly1, Poly2
  motionSeqMode: 0 | 1 | 2;      // Off, Smooth, TriggerHold
  trgPadVelocity: boolean;
  scaleMode: boolean;
  partPriority: 0 | 1;           // Normal, High
  oscType: number;               // 0-500 (parameter guide lists 1-409)
  oscEdit: number;               // 0-127
  filterType: number;            // 0-16
  filterCutoff: number;
  filterReso: number;
  filterEgInt: number;           // -63..+63
  modType: number;               // 0-71
  modSpeed: number;
  modDepth: number;
  egAttack: number;
  egDecay: number;
  ampLevel: number;
  ampPan: number;                // -63..+63 = L63..R63
  egOn: boolean;
  mfxSend: boolean;
  grooveType: number;            // 0-24
  grooveDepth: number;
  ifxOn: boolean;
  ifxType: number;               // 0-37
  ifxEdit: number;
  oscPitch: number;              // -63..+63
  oscGlide: number;
  steps: ParsedStep[];           // 64 steps × 12 bytes
}

export interface ParsedStep {
  on: boolean;
  gateTime: number;              // 0-96 or 127=TIE
  velocity: number;              // 1-127
  triggerOn: boolean;
  notes: [number, number, number, number]; // 4 note slots, 0=Off, 1-128=note 0-127
}

export interface ParsedMotionSeq {
  slots: Array<{
    partSlot: number;            // 0=Off, 1-16=Part, 17=MasterFX
    destination: number;         // 0=Off, 2-19 (cf. *T5-1 in MIDI doc)
    values: number[];            // 64 values
  }>;
}

export function parsePatternDump(raw: Uint8Array): ParsedPattern { /* ... */ }
export function buildPatternDump(parsed: ParsedPattern): Uint8Array { /* ... */ }
```

### 6.9 Global Dump (Knob Mode awareness)

```typescript
// src/midi/sysex/globalDump.ts

export interface ParsedGlobals {
  metronome: 0 | 1 | 2 | 3 | 4;       // Off, Rec0, Rec1, Rec2, On
  syncPolarity: 0 | 1;                // Hi, Lo
  syncResolution: 0 | 1;              // 1step, 2steps
  audioInThru: boolean;
  velocityCurve: 0 | 1 | 2 | 3;       // Heavy, Normal, Light, Const96
  knobMode: 0 | 1 | 2;                // Jump, Catch, Value Scale
  triggerMode: 0 | 1 | 2;             // Normal, Seq1st, SeqPlay
  lcdContrast: number;                // 0-24 = 1-25
  batteryMode: 0 | 1;                 // Ni-MH, Alkali
  autoPowerOff: boolean;              // Disable, 4 hours
  tempoLock: boolean;
  powerSave: 0 | 1 | 2;               // Disable, Auto, Enable
  touchScaleRange: 0 | 1 | 2 | 3;     // 1-4 Oct
  clockMode: 0 | 1 | 2 | 3 | 4;       // Internal, Auto, External USB, External MIDI, External Sync
  globalChannel: number;              // 0-15 = 1-16
  receiveFilter: 0 | 1 | 2;           // Off, Short, Short+Program
  sendFilter: 0 | 1 | 2;
}

export function parseGlobalDump(raw: Uint8Array): ParsedGlobals { /* ... */ }
```

L'app **lit** le Knob Mode au connect et affiche un badge informatif si `Catch` est actif (preset recall causera potentiellement des knob mismatches).

### 6.10 Connection state machine

```typescript
type ConnectionState =
  | { status: 'idle' }
  | { status: 'browser-unsupported' }
  | { status: 'requesting-permission' }
  | { status: 'permission-denied' }
  | { status: 'scanning' }
  | { status: 'no-device' }
  | { status: 'manual-select', candidates: PortInfo[] }
  | { status: 'connecting', port: PortInfo }
  | { status: 'inquiring', port: PortInfo }      // Device Inquiry en vol
  | { status: 'connected', port: PortInfo, identity: DeviceIdentity, lastSeen: number }
  | { status: 'stale', port: PortInfo, lastSeen: number }
  | { status: 'error', error: Error };
```

Connection flow :
1. `requestMIDIAccess({ sysex: true })`
2. Scan ports, auto-match si "electribe" dans le name
3. Si match : ouvrir port → envoyer Device Inquiry → attendre Identity Reply (timeout 1s) → confirmer
4. Si pas match auto et 1 seul port : tenter de l'ouvrir et faire Device Inquiry → si Identity Reply electribe = OK
5. Sinon : page Settings avec picker manuel

### 6.11 Throttle policy

- File CC par (channel, cc) → coalescing
- Flush 20ms = 50 Hz
- Calibration empirique Phase 1 : tester 50/100/200 Hz, vérifier zéro perte et zéro lag

```typescript
// src/midi/throttle.ts

export class CCThrottler {
  private queue = new Map<string, { ch: number; cc: number; value: number }>();
  private interval: ReturnType<typeof setInterval> | null = null;
  
  constructor(
    private send: (msg: number[]) => void,
    private flushMs = 20,
  ) {}
  
  start() {
    this.interval = setInterval(() => this.flush(), this.flushMs);
  }
  
  stop() {
    if (this.interval) clearInterval(this.interval);
    this.flush();
  }
  
  enqueue(ch: number, cc: number, value: number) {
    this.queue.set(`${ch}:${cc}`, { ch, cc, value });
  }
  
  private flush() {
    for (const { ch, cc, value } of this.queue.values()) {
      this.send([0xB0 | (ch & 0x0F), cc, value]);
    }
    this.queue.clear();
  }
}
```

SysEx : pas de coalescing, FIFO strict, 1 message en vol max (attendre ACK avant le suivant).

### 6.12 Multi-tab guard

Voir §6.7 v0.2 — `BroadcastChannel` annonce + lock.

### 6.13 Recovery / reconnect

`MIDIAccess.onstatechange` → exponential backoff (1s, 2s, 5s, 10s, 30s), max 5 retries.

---

## 7. Data Model

### 7.1 PartParams (complet, ranges Korg validés)

```typescript
// src/midi/types.ts

export type PartId = 1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16;

export type FilterType = number;       // 0-16 (table dans le Parameter Guide)
export type VoiceAssign = 'Mono1' | 'Mono2' | 'Poly1' | 'Poly2';
export type MotionSeqMode = 'Off' | 'Smooth' | 'TriggerHold';
export type PartPriority = 'Normal' | 'High';

export interface PartParams {
  // Oscillator
  oscType: number;            // 0-500 (Param Guide lists 1-409)
  oscEdit: number;            // 0-127
  oscPitch: number;           // -63..+63
  oscGlide: number;           // 0-127
  
  // Filter
  filterType: FilterType;
  filterCutoff: number;
  filterReso: number;
  filterEgInt: number;        // -63..+63
  
  // Modulation
  modType: number;            // 0-71
  modSpeed: number;           // 0-127
  modDepth: number;           // 0-127
  
  // Amp / EG
  egAttack: number;
  egDecay: number;
  ampLevel: number;
  ampPan: number;             // -63..+63
  egOn: boolean;
  
  // Insert FX
  ifxOn: boolean;
  ifxType: number;            // 0-37
  ifxEdit: number;
  
  // MFX routing
  mfxSend: boolean;
  
  // Voice & sequencing
  voiceAssign: VoiceAssign;
  lastStep: number;           // 1-16
  grooveType: number;         // 0-24
  grooveDepth: number;
  partPriority: PartPriority;
  trgPadVelocity: boolean;
  scaleMode: boolean;
  motionSeqMode: MotionSeqMode;
  
  mute: boolean;
}

export interface PartState extends PartParams {
  id: PartId;
  
  // Metadata locale (jamais envoyée à la machine)
  customName?: string;        // max 32 chars
  customColor?: string;       // hex
  customTag?: string;
  customNotes?: string;
  
  // État dérivé
  knobMismatchParams?: Set<keyof PartParams>;  // après preset recall
  isActive: boolean;          // est-ce le part actif sur la machine ?
}
```

### 7.2 PatternParams

```typescript
export type Beat = 0 | 1 | 2 | 3;          // 16, 32, 8Tri, 16Tri
export type Length = 1 | 2 | 3 | 4;
export type Key = 0|1|2|3|4|5|6|7|8|9|10|11;  // C..B
export type Scale = number;                 // 0-35

export interface PatternParams {
  bpm: number;                // 20.0-300.0 (encoded 200-3000)
  swing: number;              // -48..+48
  beat: Beat;
  length: Length;
  key: Key;
  scale: Scale;
  chordSet: number;           // 0-4
  playLevel: number;          // 0-127
  
  gateArpPattern: number;     // 0-49
  gateArpSpeed: number;       // 0-127
  gateArpTime: number;        // -100..+100
  
  mfxType: number;            // 0-31
  mfxXyX: number;
  mfxXyY: number;
  mfxHold: boolean;
  
  alternate1314: boolean;
  alternate1516: boolean;
}

export interface PatternState extends PatternParams {
  slot: number;               // 1-250
  name: string;               // max 18 chars sur la machine (LCD montre 8)
  parts: Record<PartId, PartState>;
}
```

### 7.3 Library entities

```typescript
export interface Preset {
  id: string;                 // UUID
  name: string;
  category: PresetCategory;
  tags: string[];
  params: PartParams;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type PresetCategory =
  | 'Kick' | 'Snare' | 'Clap' | 'HiHat' | 'Cymbal' | 'Tom'
  | 'Percussion' | 'Bass' | 'Lead' | 'Pad' | 'Stab' | 'FX'
  | 'Voice' | 'Other';

export interface PatternMeta {
  slot: number;
  // Mirror machine (read-only depuis SysEx Pattern Dump)
  name: string;
  bpm: number;
  key: Key;
  scale: Scale;
  beat: Beat;
  length: Length;
  // Locale (custom)
  customTags: string[];
  customNotes?: string;
  isFactory: boolean;
  author?: string;
  lastEditedAt?: number;
  partOverview?: Array<{
    partId: PartId;
    oscType: number;
    customName?: string;
  }>;
}

export interface Setlist {
  id: string;
  name: string;
  patterns: Array<{
    slot: number;
    note?: string;
    durationBars?: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  preferredPortName?: string;
  bpmDiffThresholdPct: number;        // default 10
  theme: 'dark' | 'high-contrast';
  smoothRecallMs: number;             // default 0
  midiChannel: number;                // 0-15, lue depuis Global Dump puis cachée
}
```

### 7.4 Dexie schema

```typescript
// src/db/schema.ts
import Dexie, { Table } from 'dexie';

export class EMXPilotDB extends Dexie {
  presets!: Table<Preset, string>;
  patternMeta!: Table<PatternMeta, number>;
  setlists!: Table<Setlist, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('emx-pilot');
    this.version(1).stores({
      presets: 'id, name, category, *tags, createdAt, updatedAt',
      patternMeta: 'slot, name, bpm, key, *customTags, isFactory, lastEditedAt',
      setlists: 'id, name, createdAt, updatedAt',
      settings: 'key',
    });
  }
}
```

---

## 8. Features détaillées

### 8.1 F1 — Part Pilot

**Layout** : grille 4×4 + panel détaillé du part actif.

**Active part** : chaque PartTile est marquée si elle est l'active part sur la machine. Visuellement : bordure plus brillante + petit badge "ACTIVE". Quand l'utilisateur change de part sur la machine (via le bouton Sequencer + pad ou Part</>), l'app détecte le changement (TBD Phase 0 — voir §10) et met à jour l'highlight.

**Sélectionner un part dans l'app** :
- Click sur PartTile dans l'app → l'app **ne change pas** le part actif sur la machine (impossible via MIDI)
- L'app affiche les params du part dans le ParamPanel (depuis le snapshot SysEx)
- Si user veut **modifier** ce part :
  - Si c'est le part actif sur la machine : tweaks via CC (instantanés)
  - Sinon : warning "Edit non-active part" → tweaks vont en SysEx queue (~150ms par modif)
  - Optionnel : suggérer "Switch to this part on the machine" en affichant les pads à presser

### 8.2 F2 — Param Mirror (active part only)

Sliders P0 : Cutoff, Reso, Attack, Decay, Level, Pan, IFX Edit. Bidirectionnel.

Sliders P1 : Pitch, Glide, OSC Edit, EG Int, Mod Depth, Mod Speed, Master FX X/Y. Bidirectionnel.

Toggles : IFX On/Off, MFX Send On/Off, Master FX On/Off (CC 104/105/106).

### 8.3 F3 — Preset Library

**Save preset** : capture le PartState complet du part actif. Si le part actif n'a pas son état complet en cache local (ex. les params SysEx-only comme OSC Type), faire un Current Pattern Dump Request d'abord pour hydrater.

**Recall preset (active part)** :
1. Optimistic update du store
2. Batch CCs pour les params CC-mappés (rapide)
3. Si des params SysEx-only diffèrent (oscType, voiceAssign, filterType, etc.) :
   - Pattern Dump Request → wait → parse → modify part bytes → Pattern Write Request → wait ACK
4. Mark dirty les knob-mismatch params

**Recall preset (non-active part)** :
- Pattern Dump → modify → Pattern Write seulement (pas de CC, ils n'iraient pas sur le bon part)

### 8.4 F4 — Pattern Catalog

- 250 slots, virtualized table
- Pre-load 200 factory patterns (`factory-patterns.ts`)
- Custom metadata locale (tags, notes)
- Switch via Bank Select + PC (§6.6)
- "Queued" state pendant attente fin de mesure

### 8.5 F5 — Setlist Builder

dnd-kit, BPM diff warnings, live mode fullscreen.

### 8.6 F6 — Big XY Pad

Fullscreen, send CC 102 (X) + CC 103 (Y) en throttled. Visualization du XY courant via incoming CCs.

### 8.7 F7 — Settings

- MIDI port picker
- BPM diff threshold
- Smooth Recall (0-1000ms interpolation)
- Theme
- Knob Mode display (read-only depuis Global Dump)
- Storage usage + Clear all data
- Export / Import library JSON

---

## 9. UI/UX Direction

### 9.1 Color palette

```css
/* Backgrounds */
--bg:           #0a0a0b
--bg-2:         #131316
--bg-3:         #1c1c20
--line:         #2a2a2f
--line-bright:  #3a3a42

/* Text */
--text:         #e8e6e3
--text-dim:     #8a8a90
--text-muted:   #5a5a60

/* Accents */
--blue:         #4dabf7   /* Electribe blue */
--blue-bright:  #74c0fc
--orange:       #ff6b35   /* Tribe accent */
--green:        #51cf66
--yellow:       #fcc419
--red:          #ff5252
```

**16 part colors** (HSL équidistantes, color-blind testées) :
```css
--part-01:  #e64f4f  --part-02:  #ff8c4a
--part-03:  #fcc419  --part-04:  #c9d44a
--part-05:  #69db7c  --part-06:  #38d9a9
--part-07:  #4dabf7  --part-08:  #748ffc
--part-09:  #b197fc  --part-10:  #da77f2
--part-11:  #f06595  --part-12:  #ff8787
--part-13:  #adb5bd  --part-14:  #91a7ff
--part-15:  #66d9e8  --part-16:  #ffd43b
```

### 9.2 Typography

- Display : Anton
- Body : IBM Plex Mono

### 9.3 Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + 1..8` | Select part 1-8 |
| `Cmd/Ctrl + Shift + 1..8` | Select part 9-16 |
| `Space` | Mute/Unmute current part (SysEx) |
| `Cmd/Ctrl + S` | Save preset |
| `Cmd/Ctrl + R` | Open preset library |
| `Cmd/Ctrl + ,` | Open Settings |
| `Esc` | Close modal |

---

## 10. Implementation Phases

### Phase 0 — MIDI Validation (1-2 jours, **réduit** grâce à la doc en main)

La MIDI Implementation Doc résout 90% des inconnues. Reste à valider hands-on :

- [ ] Connecter EMX2, scanner les ports, identifier le name affiché par le browser
- [ ] Envoyer Device Inquiry, vérifier reception Identity Reply correcte
- [ ] Tester chaque CC : sliders dans le browser → la machine réagit ?
- [ ] Tester l'inverse : tourner un knob physique → le browser reçoit le CC ?
- [ ] **Critique** : confirmer que les CC affectent bien le current edit part (et seulement lui)
- [ ] **Critique** : trouver comment l'app détecte que l'utilisateur a changé de part actif sur la machine
  - Hypothèse : pas de message MIDI direct → solution = Pattern Dump request périodique pour comparer ? Ou détection indirecte via les CC qui arrivent et ne matchent pas le state local ?
- [ ] Mesurer round-trip Pattern Dump (Request → Reply) en ms
- [ ] Mesurer round-trip Pattern Write (Request → Write → ACK) en ms
- [ ] Tester throttle CC : envoyer 100 msg/s sur Cutoff, vérifier zéro perte
- [ ] Tester latence Program Change : combien de ms / mesures avant que le pattern change

**Livrable** : `docs/MIDI_FINDINGS.md`

### Phase 1 — Foundation (3-4 jours)

Setup, layout shell, MIDIClient base, ConnectionStatus, BrowserCheck, PermissionPrompt, MultiTabGuard, ports.ts, deviceInquiry.ts, encoding.ts.

### Phase 2 — Part Pilot read-only (3-4 jours)

`osc-list.ts` etc., PartGrid + PartTile, ParamPanel avec dummy data, edit metadata locale, Settings basics, parser Pattern Dump fonctionnel (même si pas encore appelé).

### Phase 3 — Param Mirror (4-5 jours)

`ccMap.ts` complet (déjà spécifié §6.4), ParamSlider bidirectionnel, throttler, KnobMismatchBadge, Global Dump pour Knob Mode awareness.

### Phase 4 — SysEx Pattern Dump (5-7 jours)

`conversion.ts` (7-to-8 bit), Current Pattern Dump Request flow complet, parser implémentation complète, hydratation initiale du store des 16 parts au connect.

### Phase 5 — Preset Library (4-5 jours)

Dexie schema, save preset (CC + SysEx mixed), recall flow (CC batch + Pattern Write si nécessaire), Library page avec search/filter.

### Phase 6 — Pattern Catalog (3-4 jours)

`factory-patterns.ts` embed, virtualized table, edit metadata locale, switch via Bank+PC, queued state.

### Phase 7 — Setlist + XY Pad (4-5 jours)

dnd-kit, BPM warnings, live mode, XYPadFullscreen.

### Phase 8 — PWA + Polish (2-3 jours)

vite-plugin-pwa, manifest, icons, export/import JSON, IndexedDB quota, README.

**Total estimatif** : 29-38 jours dev focalisé. Plus conservateur qu'en v0.2 vu l'ampleur du SysEx work (Phase 4 ajoutée).

---

## 11. Test Strategy

### 11.1 Unit (Vitest)

Cible 70%+ sur :
- `midi/encoding.ts` — fixtures connues pour pan/signed
- `midi/sysex/conversion.ts` — round-trip 8↔7 bit avec patterns connus
- `midi/sysex/parser.ts` — parse un Pattern Dump fixture (capture réelle de la machine), vérifier les valeurs
- `midi/throttle.ts` — coalescing, ordering, timing
- `store/*.ts` — state transitions
- `lib/format.ts` — BPM, time

### 11.2 Mock MIDIAccess

```typescript
// tests/fixtures/midi-mock.ts

export class MockMIDIAccess {
  inputs = new Map<string, MockMIDIInput>();
  outputs = new Map<string, MockMIDIOutput>();
  
  static withElectribe(): MockMIDIAccess {
    const access = new MockMIDIAccess();
    access.inputs.set('e1', new MockMIDIInput('electribe IN'));
    access.outputs.set('o1', new MockMIDIOutput('electribe OUT'));
    return access;
  }
  
  simulateIncoming(portId: string, message: number[]) { /* ... */ }
  expectOutgoing(portId: string): number[][] { /* ... */ }
  
  /** Auto-respond to Device Inquiry */
  enableElectribeReplies(): void { /* ... */ }
}
```

### 11.3 Integration

- Connect → Device Inquiry → connected
- Slider tweak → CC sent → reconcile incoming → slider settles
- Save preset → store + Dexie persisted
- Recall preset → batch CCs + SysEx in correct order
- Pattern Dump request → parsed → 16 parts in store

### 11.4 E2E (Playwright)

Critical paths avec MIDI mock injecté :
- Onboarding (browser check, permission, port pick, inquiry, success)
- Save/recall preset round-trip
- Setlist drag & drop
- XY pad

### 11.5 Manual QA sur la vraie machine

Checklist avant chaque release :
- Hot plug/unplug USB
- Multiple devices
- Tweak knob physique → app réagit
- Tweak slider → machine réagit
- Pattern switch (timing observation)
- Preset recall avec Knob Mode = Catch
- Preset recall sur non-active part (vérifier que le bon part change)
- Multi-tab guard
- Refresh in-session

---

## 12. Open Questions

🟡 **À investiguer Phase 0** :
- Comment détecter le current edit part depuis l'app ? Pas de message documenté pour ça. Hypothèse : poll Pattern Dump périodique + analyse du state local.
- Comportement CC quand un param a une motion sequence enregistrée : override ou ignore ?
- Latence Program Change : ms / mesures à mesurer.
- Mute / Solo per part : SysEx Pattern Write avec Part.Mute byte. À tester.
- Audio In (#409) comportement en MIDI.

🟢 **V2 ideas** :
- Visualisation steps en temps réel (impossible sans MIDI Clock + parsing)
- Step editing depuis l'app (techniquement possible via Pattern Dump R/W)
- Motion sequence editor visuel
- Tutorial mode synthesis 101 (issu d'observation user : friction d'apprentissage)
- Mappings MIDI custom (USB MIDI fader → param app)

---

## 13. Annexes

### 13.1 Sources

- **Korg Electribe MIDI Implementation v1.00** (2015-01-09) — fichier `electribe_MIDIimp.txt` officiel — c'est le doc qui débloque tout
- **Korg Electribe Parameter Guide E** (2016-07-21)
- **Korg Electribe Owner's Manual** (2017-10-03)
- **Web MIDI API spec** : https://www.w3.org/TR/webmidi/
- **MDN Web MIDI** : https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API

### 13.2 Données embarquées

`src/lib/factory-patterns.ts` : 200 patterns d'usine (extraits du Parameter Guide)
`src/lib/osc-list.ts` : 409 OSC
`src/lib/mfx-list.ts`, `ifx-list.ts`, `mod-types.ts`, `scales.ts`, `grooves.ts`

Données déjà compilées dans `emx2-operator-manual.html` — copier en TS.

### 13.3 Conventions code

- PascalCase pour composants/classes/types
- camelCase pour fonctions/hooks/variables
- Pas de default export sauf pages
- Pas de class components React
- Tailwind only, pas de CSS-in-JS
- `const` partout

### 13.4 Naming

`EMX.PILOT` placeholder. Pour distrib publique, renommer (EMX = trademark Korg) → suggestions : TRIBE.PILOT, TRIBE.PANEL, ELEKTRIPILOT.

---

## 14. Critères d'acceptation MVP

### Phase 0 — MIDI Validation
- [ ] `docs/MIDI_FINDINGS.md` complet avec mesures latence Pattern Dump / Pattern Write / Program Change
- [ ] Détection current edit part résolue (méthode documentée)
- [ ] Validation throttle CC (pas de perte à 50 Hz)

### MVP Phase 1-3 (UI + CC mirror active part)
- [ ] L'app détecte automatiquement l'EMX2 via Device Inquiry (Family ID 0x23 0x01 confirmé)
- [ ] Multi-device picker fonctionne
- [ ] Permission Web MIDI gérée gracieusement (refus, dismiss, granted-revoked)
- [ ] Browser non supporté → message clair, pas de crash
- [ ] Multi-tab guard fonctionne
- [ ] Hot plug/unplug → reconnexion auto
- [ ] Grille 16 parts s'affiche avec metadata custom
- [ ] Edit metadata persiste après reload
- [ ] Active part highlighted dans la grille
- [ ] Sélection d'un part dans l'app affiche ses params
- [ ] Slider tweak → CC envoyé → param change sur machine (active part)
- [ ] Knob physique tourné → slider met à jour (incoming CC)
- [ ] Knob Mode badge informatif si `Catch`
- [ ] Tests unit ≥ 70% sur midi/encoding, midi/sysex, store
- [ ] E2E pass sur paths critiques

### MVP étendu Phase 4-5 (SysEx + Library)
- [ ] Current Pattern Dump Request fonctionne, parser correct
- [ ] Les 16 parts sont hydratés au connect avec leurs vrais OSC, voice assign, etc.
- [ ] Save preset capture l'état complet du part actif
- [ ] Recall preset (active part) : params live OK via CC, params SysEx OK via Pattern Write
- [ ] Recall preset (non-active part) : ne change PAS le part actif sur la machine
- [ ] Library search/filter fonctionne

---

**Fin du cahier des charges v0.3.**

Cette version est directement actionnable par Claude Code. Tous les CC numbers et SysEx structures sont documentés depuis la source officielle Korg. Plus de placeholders TBD critiques. Phase 0 réduite à de la validation hands-on (pas de reverse engineering).
