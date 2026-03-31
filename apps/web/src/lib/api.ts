const BASE = '/api/v1';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('meridian_token');
  }

  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new ApiError(res.status, err.detail || 'Request failed', err);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  get<T>(path: string) { return this.fetch<T>(path); }
  post<T>(path: string, body?: unknown) { return this.fetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
  patch<T>(path: string, body: unknown) { return this.fetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }); }
  del(path: string) { return this.fetch(path, { method: 'DELETE' }); }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

export const api = new ApiClient();
