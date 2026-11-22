export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const WS_URL: string = import.meta.env.VITE_WS_URL || API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** JSON fetch helper. Throws ApiError with the server's message. Optional staff Bearer token. */
export async function apiFetch<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method || 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    if (res.status === 401 && opts.token) window.dispatchEvent(new Event('velora:unauthorized'));
    throw new ApiError(res.status, (data && data.error) || `Request failed (HTTP ${res.status})`);
  }
  return data as T;
}
