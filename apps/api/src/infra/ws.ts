import type { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { eventBus } from './events.js';

interface WsClient {
  orgId: string;
  socket: import('ws').WebSocket;
}

const clients: Set<WsClient> = new Set();

export function broadcast(orgId: string, event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.orgId === orgId && client.socket.readyState === 1) {
      client.socket.send(message);
    }
  }
}

export async function registerWebSocket(app: FastifyInstance) {
  await app.register(websocket);

  app.get('/api/v1/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as Record<string, string>).token;
    if (!token) { socket.close(4001, 'Token required'); return; }

    try {
      const payload = app.jwt.verify<{ sub: string; org_id: string; role: string }>(token);
      const client: WsClient = { orgId: payload.org_id, socket };
      clients.add(client);

      socket.on('close', () => { clients.delete(client); });
      socket.on('error', () => { clients.delete(client); });
    } catch {
      socket.close(4001, 'Invalid token');
    }
  });

  // Subscribe to domain events and broadcast
  const events = [
    'flow.created', 'flow.updated', 'flow.stage_changed',
    'artifact.generated', 'artifact.approved',
    'evidence.collected', 'task.updated', 'policy.evaluated',
  ];
  for (const event of events) {
    eventBus.on(event, (data: { org_id: string; [key: string]: unknown }) => {
      broadcast(data.org_id, event, data);
    });
  }
}
