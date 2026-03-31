import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';

export function useWebSocket() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event?.startsWith('flow.')) queryClient.invalidateQueries({ queryKey: ['flows'] });
        if (msg.event?.startsWith('artifact.')) queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        if (msg.event?.startsWith('evidence.')) queryClient.invalidateQueries({ queryKey: ['evidence'] });
        if (msg.event?.startsWith('task.')) queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setTimeout(() => { /* reconnect handled by effect re-run */ }, 3000);
    };

    return () => { ws.close(); };
  }, [token, queryClient]);
}
