// Validation des messages entrants du relais (audit sécurité 2026-09-04).
//
// Le relais est public et sans authentification : tout ce qui arrive est
// hostile jusqu'à preuve du contraire. On ne garde QUE les champs connus, aux
// bonnes formes et tailles ; le reste est rejeté (null) et ignoré. Module pur,
// partagé et testé — la seule porte d'entrée de `SessionHub.handle`.

import type { ClientMessage, Cue, PeerInfo, TransportTick } from './protocol.ts';
import type { DeviceSnapshot } from './snapshot.ts';

export const MAX_ROOM_LEN = 64;
export const MAX_NAME_LEN = 32;
export const MAX_LABEL_LEN = 64;
export const MAX_CLIENT_ID_LEN = 64;
export const MAX_PARTS = 16;
export const MAX_PARAMS_PER_PART = 128;

const CUE_KINDS = new Set(['break', 'up', 'down', 'drop', 'cut', 'custom']);

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : null;

function info(v: unknown): PeerInfo | null {
  if (!isObj(v)) return null;
  const name = str(typeof v.name === 'string' ? v.name.trim() : v.name, MAX_NAME_LEN);
  if (!name) return null;
  const out: PeerInfo = { name };
  if (v.color !== undefined) {
    if (typeof v.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(v.color)) return null;
    out.color = v.color;
  }
  if (v.listener !== undefined) {
    if (typeof v.listener !== 'boolean') return null;
    out.listener = v.listener;
  }
  if (v.clientId !== undefined) {
    const id = str(v.clientId, MAX_CLIENT_ID_LEN);
    if (!id) return null;
    out.clientId = id;
  }
  return out;
}

function transport(v: Record<string, unknown>): TransportTick | null {
  if (!finite(v.bpm) || v.bpm < 0 || v.bpm > 999) return null;
  if (!Number.isInteger(v.bar) || (v.bar as number) < 0 || (v.bar as number) > 1e7) return null;
  if (!Number.isInteger(v.beat) || (v.beat as number) < 0 || (v.beat as number) > 64) return null;
  if (typeof v.running !== 'boolean') return null;
  return { bpm: v.bpm, bar: v.bar as number, beat: v.beat as number, running: v.running };
}

function snapshot(v: unknown): DeviceSnapshot | null {
  if (!isObj(v)) return null;
  if (!Array.isArray(v.parts) || v.parts.length > MAX_PARTS) return null;
  for (const p of v.parts) {
    if (!isObj(p)) return null;
    if (p.params !== undefined && (!isObj(p.params) || Object.keys(p.params).length > MAX_PARAMS_PER_PART)) return null;
  }
  if (v.pattern !== null && v.pattern !== undefined && !isObj(v.pattern)) return null;
  if (!finite(v.updatedAt)) return null;
  if (v.profileId !== undefined && v.profileId !== null && typeof v.profileId !== 'string') return null;
  if (v.model !== undefined && typeof v.model !== 'string') return null;
  // Forme validée ; le contenu des parts est opaque pour le relais (rejoué tel quel,
  // borné par MAX_PARTS / MAX_PARAMS_PER_PART et par maxPayload en amont).
  return v as unknown as DeviceSnapshot;
}

function cue(v: unknown): Cue | null {
  if (!isObj(v)) return null;
  const id = str(v.id, MAX_LABEL_LEN);
  if (!id || typeof v.kind !== 'string' || !CUE_KINDS.has(v.kind)) return null;
  if (!Number.isInteger(v.landAtBar) || !finite(v.createdAt)) return null;
  const out: Cue = { id, kind: v.kind as Cue['kind'], landAtBar: v.landAtBar as number, createdAt: v.createdAt };
  if (v.label !== undefined) {
    const label = str(v.label, MAX_LABEL_LEN);
    if (!label) return null;
    out.label = label;
  }
  return out;
}

/** Message client valide, ou null (à ignorer). N'accepte que les champs connus. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isObj(raw) || typeof raw.t !== 'string') return null;
  switch (raw.t) {
    case 'join': {
      const room = str(typeof raw.room === 'string' ? raw.room.trim() : raw.room, MAX_ROOM_LEN);
      const i = info(raw.info);
      return room && i ? { t: 'join', room, info: i } : null;
    }
    case 'leave':
      return { t: 'leave' };
    case 'transport': {
      const tick = transport(raw);
      return tick ? { t: 'transport', ...tick } : null;
    }
    case 'device': {
      const s = snapshot(raw.snapshot);
      return s ? { t: 'device', snapshot: s } : null;
    }
    case 'cue': {
      const c = cue(raw.cue);
      return c ? { t: 'cue', cue: c } : null;
    }
    case 'ping':
      return finite(raw.ts) ? { t: 'ping', ts: raw.ts } : null;
    case 'lobbies':
      return { t: 'lobbies' };
    case 'grid':
      return finite(raw.bpm) && finite(raw.bpi) ? { t: 'grid', bpm: raw.bpm, bpi: raw.bpi } : null;
    default:
      return null;
  }
}
