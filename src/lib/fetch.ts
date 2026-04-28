const CSRF_HEADER = 'X-Requested-With';
const CSRF_VALUE = 'NextSMS';

export function safeFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutation) {
    const headers = new Headers(init?.headers);
    if (!headers.has(CSRF_HEADER)) {
      headers.set(CSRF_HEADER, CSRF_VALUE);
    }
    return fetch(url, { ...init, headers });
  }

  return fetch(url, init);
}
