// Écriture SysEx (Phase 5b) — construction de dumps à renvoyer à la machine.
//
// ⚠️ Aucune fonction d'envoi ici : ce module ne fait que CONSTRUIRE des octets,
// vérifiables hors-hardware par roundtrip. L'envoi réel (et la validation sur la
// machine, slot 250, cf. MIDI_FINDINGS §6) est gardé séparément.
//
// Stratégie recall (cf. docs/DECISIONS.md ADR-004) : patcher uniquement les octets
// « son » SysEx-only d'un part dans une COPIE byte-exacte du dump courant, puis
// renvoyer un Current Pattern Dump (0x40) → chargé dans le edit buffer (volatile,
// n'écrase AUCUN slot). Pattern Write (0x11) reste réservé au save-vers-slot.

import { encode8to7 } from './conversion.ts';
import { buildSysEx } from './envelope.ts';
import { SYSEX_FN } from './functions.ts';
import { PART_BASE, PART_COUNT, PART_STRIDE } from './parser.ts';
import type { PartSound } from '../../db/types.ts';

const clampByte = (v: number): number =>
  Math.max(0, Math.min(255, Math.round(v)));

const signed8 = (v: number): number => Math.max(-128, Math.min(127, Math.round(v))) & 0xff;
const bit = (b: boolean): number => (b ? 1 : 0);

/**
 * Patche le SON complet d'un part dans une COPIE du dump brut décodé (16384
 * octets) : oscillateur, filtre, EG, amp, modulation, IFX, groove, voice —
 * tout ce qu'un preset capture (`PartSound`). Offsets relatifs au bloc part,
 * alignés sur le parser (`parsePart`). N'écrit PAS la séquence (steps), ni les
 * états de jeu (mute, lastStep, motion seq, trigger pad, scale mode).
 *
 * Renvoyé via `resendCurrentPattern` (edit buffer, ADR-006), c'est ce qui permet
 * d'appliquer un son sauvegardé sur N'IMPORTE QUELLE piste, pas seulement le
 * part actif (les CC ne touchent que celui-ci, ADR-001).
 */
export function patchPartSound(
  raw: Uint8Array,
  partIndex: number,
  sound: PartSound,
): Uint8Array {
  if (partIndex < 0 || partIndex >= PART_COUNT) {
    throw new RangeError(`partIndex hors plage: ${partIndex}`);
  }
  const out = new Uint8Array(raw); // copie défensive
  const base = PART_BASE + partIndex * PART_STRIDE;
  out[base + 2] = clampByte(sound.voiceAssign);
  out[base + 6] = clampByte(sound.partPriority);
  out[base + 8] = sound.oscType & 0xff; // oscType lo
  out[base + 9] = (sound.oscType >> 8) & 0xff; // oscType hi
  out[base + 11] = clampByte(sound.oscEdit);
  out[base + 12] = clampByte(sound.filterType);
  out[base + 13] = clampByte(sound.filterCutoff);
  out[base + 14] = clampByte(sound.filterReso);
  out[base + 15] = signed8(sound.filterEgInt);
  out[base + 16] = clampByte(sound.modType);
  out[base + 17] = clampByte(sound.modSpeed);
  out[base + 18] = clampByte(sound.modDepth);
  out[base + 20] = clampByte(sound.egAttack);
  out[base + 21] = clampByte(sound.egDecay);
  out[base + 24] = clampByte(sound.ampLevel);
  out[base + 25] = signed8(sound.ampPan);
  out[base + 26] = bit(sound.egOn);
  out[base + 27] = bit(sound.mfxSend);
  out[base + 28] = clampByte(sound.grooveType);
  out[base + 29] = clampByte(sound.grooveDepth);
  out[base + 32] = bit(sound.ifxOn);
  out[base + 33] = clampByte(sound.ifxType);
  out[base + 34] = clampByte(sound.ifxEdit);
  out[base + 36] = signed8(sound.oscPitch);
  out[base + 37] = clampByte(sound.oscGlide);
  return out;
}

/**
 * Current Pattern Dump (0x40) prêt à renvoyer — chargé dans le edit buffer de la
 * machine (volatile, non destructif). `raw` = 16384 octets décodés.
 */
export function buildCurrentPatternDump(
  globalChannel: number,
  raw: Uint8Array,
): Uint8Array {
  return buildSysEx(globalChannel, SYSEX_FN.CURRENT_PATTERN_DUMP, [
    ...encode8to7(raw),
  ]);
}

/** Index slot (1..250) → octets PH/PL 7-bit (convention Korg, slot 250 = 01 79). */
export function encodeSlot(slot: number): [number, number] {
  const idx = slot - 1; // 1-based → 0-based
  return [(idx >> 7) & 0x7f, idx & 0x7f];
}

/**
 * Pattern Write Request (0x11) vers un slot — DESTRUCTIF (écrit en flash).
 * Réservé au futur « save vers slot », à valider sur slot 250 (MIDI_FINDINGS §6).
 */
export function buildPatternWriteRequest(
  globalChannel: number,
  slot: number,
  raw: Uint8Array,
): Uint8Array {
  const [ph, pl] = encodeSlot(slot);
  return buildSysEx(globalChannel, SYSEX_FN.PATTERN_WRITE_REQUEST, [
    ph,
    pl,
    ...encode8to7(raw),
  ]);
}
