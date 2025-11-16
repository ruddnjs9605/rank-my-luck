const BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:8080/api';

async function req(path: string, options: RequestInit) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.message || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (path: string) => req(path, { method: 'GET' }),
  post: (path: string, body: any) => req(path, { method: 'POST', body: JSON.stringify(body) })
};
