import { create } from 'zustand';

export type SysexEventKind =
  | 'load-ok' // 0x23 DATA_LOAD_COMPLETED — dump chargé dans l'edit buffer
  | 'load-error' // 0x24 DATA_LOAD_ERROR
  | 'write-ok' // 0x21 WRITE_COMPLETED
  | 'write-error' // 0x22 WRITE_ERROR
  | 'format-error' // 0x26 DATA_FORMAT_ERROR
  | 'sent'; // côté app : on vient d'émettre un dump (pas encore d'ACK)

export interface SysexEvent {
  kind: SysexEventKind;
  at: number;
  note?: string;
}

interface SysexStore {
  lastEvent: SysexEvent | null;
  /** Garde-fou : le recall n'envoie les params SysOnly (edit buffer) que si validé. */
  fullRecallEnabled: boolean;
  setFullRecall: (on: boolean) => void;
  pushEvent: (kind: SysexEventKind, note?: string) => void;
}

export const useSysexStore = create<SysexStore>((set) => ({
  lastEvent: null,
  fullRecallEnabled: false,
  setFullRecall: (on) => set({ fullRecallEnabled: on }),
  pushEvent: (kind, note) => set({ lastEvent: { kind, at: Date.now(), note } }),
}));
