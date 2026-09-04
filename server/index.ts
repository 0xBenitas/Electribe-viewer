// JAMBOREE session server — thin `ws` adapter over the pure SessionHub.
// Run with: npm run server   (tsx watch)   /   npm run server:start
//
// Relays presence, the host's BPM, device snapshots and cues (JSON), and —
// since ADR-007 — the browser audio as opaque binary frames fanned out to the
// other members of the room (players and listeners alike).
//
// Hardening (audit 2026-09-04): bounded payloads, no crash on garbage, size and
// rate caps in the hub, backpressure (drop audio for slow readers, cut the
// hopeless ones), per-IP connection cap, ghost sweep.

import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import { SessionHub, MAX_AUDIO_FRAME_BYTES, type Outbound } from './hub.ts';
import { toDownFrame } from '../src/core/session/audioFrame.ts';

const PORT = Number(process.env.PORT ?? 8787);
/** Snapshots run ~10-20 KiB; anything bigger is not ours. */
const MAX_PAYLOAD = 64 * 1024;
/** Slow reader: skip its audio above this, cut it above the hard limit. */
const BACKPRESSURE_SKIP = 256 * 1024;
const BACKPRESSURE_CUT = 2 * 1024 * 1024;
const MAX_CONNECTIONS_PER_IP = 6;
const SWEEP_MS = 10000;

const hub = new SessionHub();
const sockets = new Map<string, WebSocket>();
const perIp = new Map<string, number>();
let nextId = 1;

function clientIp(req: IncomingMessage): string {
  // Only Caddy reaches this port: trust its X-Forwarded-For (first hop).
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

function sendTo(id: string, data: string | Uint8Array, audio: boolean): void {
  const ws = sockets.get(id);
  if (!ws) return;
  if (ws.bufferedAmount > BACKPRESSURE_CUT) {
    ws.terminate(); // hopeless reader: its 'close' cleans the hub
    return;
  }
  if (audio && ws.bufferedAmount > BACKPRESSURE_SKIP) return; // real time: drop, never queue
  ws.send(data, { binary: audio });
}

function deliver(out: Outbound[]): void {
  for (const { recipients, msg } of out) {
    const data = JSON.stringify(msg);
    for (const id of recipients) sendTo(id, data, false);
  }
}

const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_PAYLOAD });

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  const n = (perIp.get(ip) ?? 0) + 1;
  if (n > MAX_CONNECTIONS_PER_IP) {
    ws.close(1013, 'too many connections');
    return;
  }
  perIp.set(ip, n);
  const peerId = `p${nextId++}`;
  sockets.set(peerId, ws);

  ws.on('message', (raw, isBinary) => {
    try {
      if (isBinary) {
        const len = Buffer.isBuffer(raw) ? raw.length : (raw as ArrayBuffer).byteLength;
        if (len > MAX_AUDIO_FRAME_BYTES) return;
        const recipients = hub.audioRecipients(peerId, len); // membership + caps BEFORE any copy
        if (recipients.length === 0) return;
        const bytes = Buffer.isBuffer(raw) ? new Uint8Array(raw) : new Uint8Array(raw as ArrayBuffer);
        const down = toDownFrame(peerId, bytes);
        if (!down) return;
        for (const id of recipients) sendTo(id, down, true);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return; // malformed JSON: ignored
      }
      deliver(hub.handle(peerId, parsed));
    } catch (e) {
      // Whatever happened, one socket never takes the relay down.
      console.error('message handling failed', peerId, e);
      try {
        ws.close(1008, 'protocol error');
      } catch {
        // already gone
      }
    }
  });

  ws.on('close', () => {
    try {
      deliver(hub.disconnect(peerId));
    } finally {
      sockets.delete(peerId);
      const left = (perIp.get(ip) ?? 1) - 1;
      if (left <= 0) perIp.delete(ip);
      else perIp.set(ip, left);
    }
  });

  ws.on('error', () => {
    // 'close' will follow; nothing to do here.
  });
});

// Ghosts (no message for 30 s, not even a ping) are removed and cut off.
setInterval(() => {
  try {
    const { removed, out } = hub.sweep();
    deliver(out);
    for (const id of removed) sockets.get(id)?.terminate();
  } catch (e) {
    console.error('sweep failed', e);
  }
}, SWEEP_MS).unref();

console.log(`JAMBOREE session server listening on ws://localhost:${PORT}`);
