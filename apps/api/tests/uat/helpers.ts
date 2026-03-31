const API_BASE = process.env.API_URL || 'http://localhost:3001/api/v1';

export interface AuthContext {
  token: string;
  user: { id: string; email: string; name: string };
  org: { id: string; name: string; slug: string };
}

export async function apiRequest<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

export async function login(email: string, password: string = 'demo1234'): Promise<AuthContext> {
  const { status, data } = await apiRequest('POST', '/auth/login', { email, password });
  if (status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.access_token, user: data.user, org: data.org };
}

export const get = <T = any>(path: string, token: string) => apiRequest<T>('GET', path, undefined, token);
export const post = <T = any>(path: string, body: unknown, token: string) => apiRequest<T>('POST', path, body, token);
export const patch = <T = any>(path: string, body: unknown, token: string) => apiRequest<T>('PATCH', path, body, token);
export const del = (path: string, token: string) => apiRequest('DELETE', path, undefined, token);
