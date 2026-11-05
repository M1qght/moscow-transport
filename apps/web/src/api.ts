let accessToken: string | null = null;
let pendingRefresh: Promise<unknown> | null = null;
export function setToken(token: string | null) { accessToken = token; }
export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    pendingRefresh ??= api<{ accessToken: string }>('/auth/refresh', { method: 'POST' }, false)
      .then(session => { setToken(session.accessToken); }).finally(() => { pendingRefresh = null; });
    try { await pendingRefresh; } catch { setToken(null); throw new Error('Сессия истекла. Войдите снова.'); }
    return api<T>(path, init, false);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message ?? `Ошибка ${response.status}`);
  return body as T;
}
export const json = (value: unknown, method = 'POST'): RequestInit => ({ method, body: JSON.stringify(value) });
