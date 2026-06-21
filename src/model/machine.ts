// Machine read-model — the single shape every panel component renders.
//
// One rendering path for two sources: a LOCAL machine (built from the Web MIDI
// stores, editable) and a REMOTE peer's machine (built from a network
// DeviceSnapshot, read-only). Components take a `Machine` (+ actions when
// editable) and never read global stores directly. This is the merge keystone.

import type { CCParam } from '../midi/ccMap.ts';
import type { PatternInfoSnapshot } from '../core/session/snapshot.ts';

export type ParamValues = Partial<Record<CCParam, number>>;

export interface MachinePart {
  /** 1-based part id. */
  id: number;
  /** User-set name (local only); null otherwise. */
  customName: string | null;
  /** Resolved tile colour (custom colour, else palette default). */
  color: string;
  /** Raw oscillator value, or null if the pattern isn't hydrated. */
  oscType: number | null;
  muted: boolean;
  voiceAssign: number | null;
  filterType: number | null;
  ifxType: number | null;
  lastStep: number | null;
  /** CC-mirrored realtime param values (decoded, app-space). */
  params: ParamValues;
}

/** Pattern header shown in the cockpit — identical to the wire shape. */
export type MachinePatternInfo = PatternInfoSnapshot;

export interface Machine {
  /** "local" for own machine, else the peer id. */
  id: string;
  /** Panel header: owner/player name. */
  label: string;
  /** Device model display string. */
  model: string;
  profileId: string | null;
  /** True only for the local machine; gates every edit path. */
  editable: boolean;
  /** Profile exposes the rich per-part editor (Electribe); else a lite panel. */
  richEditor: boolean;
  /** Connection up (local) / peer present (remote). */
  online: boolean;
  /** Local hardware knob mode; null for remote machines. */
  knobMode: number | null;
  /** Active edit part (ADR-001), 1-based, or null if undetermined. */
  activePartId: number | null;
  /** Part selected in the UI, 1-based. */
  selectedPartId: number;
  /** Always length 16 for the Electribe. */
  parts: MachinePart[];
  pattern: MachinePatternInfo | null;
}

/** Actions a panel may invoke — only provided for an editable machine. */
export interface MachineActions {
  selectPart: (id: number) => void;
  setParam: (param: CCParam, value: number) => void;
  rename: (id: number, name: string) => void;
}
