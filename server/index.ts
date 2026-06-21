// JAMBOREE session server — thin `ws` adapter over the pure SessionHub.
// Run with: npm run server   (tsx watch)   /   npm run server:start
//
// The browser carries NO audio (that's the native NINJAM client). This process
// only relays presence, the host's BPM, device snapshots and cues.

import { WebSocketServer, type WebSocket } from 'ws';
import { SessionHub, type Outbound } from './hub.ts';
import type { ClientMessage } from '../src/core/session/protocol.ts';

const PORT = Number(process.env.PORT ?? 8787);

const hub = new SessionHub();
const sockets = new Map<string, WebSocket>();
let nextId = 1;

function deliver(out: Outbound[]): void {
  for (const { recipients, msg } of out) {
    const data = JSON.stringify(msg);
    for (const id of recipients) sockets.get(id)?.send(data);
  }
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const peerId = `p${nextId++}`;
  sockets.set(peerId, ws);

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return; // ignore malformed frames
    }
    deliver(hub.handle(peerId, msg));
  });

  ws.on('close', () => {
    deliver(hub.disconnect(peerId));
    sockets.delete(peerId);
  });

  ws.on('error', () => {
    // 'close' will follow; nothing to do here.
  });
});

console.log(`JAMBOREE session server listening on ws://localhost:${PORT}`);
