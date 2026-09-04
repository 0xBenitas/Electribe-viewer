// Coffre des dumps (Phase 5b, ADR-006) : chaque Current Pattern Dump reçu de la
// machine est gardé en IndexedDB, téléchargeable en `.syx` rejouable par
// n'importe quel outil SysEx (SysEx Librarian, MIDI-OX, amidi…).
// Filet de sécurité : si un envoi vers l'edit buffer remplace le pattern de
// travail, l'original reçu juste avant reste ici.

import { db } from '../db/schema.ts';
import { buildCurrentPatternDump } from './sysex/write.ts';

export interface DumpRow {
  id: string;
  receivedAt: number;
  /** Nom du pattern lu dans le dump (pour retrouver le bon fichier). */
  name: string;
  tempo: number;
  /** 16384 octets décodés, tels que reçus. */
  raw: Uint8Array;
}

/** Nombre de dumps conservés (≈ 16 Ko chacun). */
export const DUMP_KEEP = 30;

const pad = (n: number): string => String(n).padStart(2, '0');

/** `jamboree_<nom>_<AAAAMMJJ-HHMMSS>.syx` — nom lisible, sans caractère exotique. */
export function dumpFileName(name: string, receivedAt: number): string {
  const d = new Date(receivedAt);
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const safe =
    name
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'pattern';
  return `jamboree_${safe}_${stamp}.syx`;
}

/** Le fichier `.syx` = le message 0x40 complet (F0 … F7), rejouable tel quel. */
export function syxBytes(globalChannel: number, raw: Uint8Array): Uint8Array {
  return buildCurrentPatternDump(globalChannel, raw);
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Garde le dump (sauf s'il est identique au dernier gardé) et élague au-delà de DUMP_KEEP. */
export async function saveDump(row: Omit<DumpRow, 'id'>): Promise<boolean> {
  const last = await db.dumps.orderBy('receivedAt').last();
  if (last && sameBytes(last.raw, row.raw)) return false;
  await db.dumps.add({ id: crypto.randomUUID(), ...row });
  const stale = await db.dumps
    .orderBy('receivedAt')
    .reverse()
    .offset(DUMP_KEEP)
    .primaryKeys();
  if (stale.length) await db.dumps.bulkDelete(stale);
  return true;
}

/** Les dumps gardés, du plus récent au plus ancien. */
export function listDumps(limit = DUMP_KEEP): Promise<DumpRow[]> {
  return db.dumps.orderBy('receivedAt').reverse().limit(limit).toArray();
}
