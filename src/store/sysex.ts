import { create } from 'zustand';

export type SysexEventKind =
  | 'refresh' // côté app : pattern redemandé à la machine (0x10) avant envoi
  | 'refresh-error' // la machine n'a pas répondu : RIEN n'a été envoyé (ADR-006)
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
  /** Un ACK 0x23 a été vu dans cette session (déverrouille l'étape 2). */
  loadOkSeen: boolean;
  /** Garde-fou : le recall n'envoie les params SysOnly (edit buffer) que si validé. */
  fullRecallEnabled: boolean;
  setFullRecall: (on: boolean) => void;
  pushEvent: (kind: SysexEventKind, note?: string) => void;
}

export const useSysexStore = create<SysexStore>((set) => ({
  lastEvent: null,
  loadOkSeen: false,
  fullRecallEnabled: false,
  setFullRecall: (on) => set({ fullRecallEnabled: on }),
  pushEvent: (kind, note) =>
    set((s) => ({
      lastEvent: { kind, at: Date.now(), note },
      loadOkSeen: s.loadOkSeen || kind === 'load-ok',
    })),
}));
