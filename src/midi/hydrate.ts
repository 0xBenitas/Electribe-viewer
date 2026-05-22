// Map a parsed Pattern Dump into the CC-mirror param store (Phase 4).
// Lets sliders show the machine's real values before any knob is touched.

import type { ParsedPart, ParsedPattern } from './sysex/parser.ts';
import type { ParamValues } from '../store/params.ts';

/**
 * Per-part CC-mapped values derived from a parsed part.
 * masterFxX/Y and mfxOnOff are pattern-level (not per-part), so excluded.
 */
export function partToParamValues(part: ParsedPart): ParamValues {
  return {
    ampLevel: part.ampLevel,
    ampPan: part.ampPan,
    filterReso: part.filterReso,
    egDecay: part.egDecay,
    egAttack: part.egAttack,
    filterCutoff: part.filterCutoff,
    oscPitch: part.oscPitch,
    oscGlide: part.oscGlide,
    oscEdit: part.oscEdit,
    filterEgInt: part.filterEgInt,
    modDepth: part.modDepth,
    modSpeed: part.modSpeed,
    ifxEdit: part.ifxEdit,
    ifxOnOff: part.ifxOn ? 1 : 0,
    mfxSendOnOff: part.mfxSend ? 1 : 0,
  };
}

/** Map all 16 parts to param values keyed by 1-based part id. */
export function patternToParams(
  pattern: ParsedPattern,
): Record<number, ParamValues> {
  const out: Record<number, ParamValues> = {};
  pattern.parts.forEach((part, i) => {
    out[i + 1] = partToParamValues(part);
  });
  return out;
}
