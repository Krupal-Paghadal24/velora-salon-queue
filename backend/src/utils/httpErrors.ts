import type { Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Maps errors thrown by the domain engine / DB to HTTP responses.
 * Engine business-rule errors are plain Errors -> 409 (or 404 when "not found").
 * Unexpected database errors -> 500, except unique violations -> 409.
 */
export function sendError(res: Response, err: any): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err && err.code === '23505') {
    res.status(409).json({ error: 'That action conflicts with the current queue state. Please refresh.' });
    return;
  }
  if (err && typeof err.code === 'string') {
    console.error('[DB Error]:', err);
    res.status(500).json({ error: 'Database error' });
    return;
  }
  const message = err?.message || 'Request failed';
  if (/not found/i.test(message)) {
    res.status(404).json({ error: message });
    return;
  }
  res.status(409).json({ error: message });
}
