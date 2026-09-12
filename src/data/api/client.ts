/* Thin HTTP client for the FastAPI backend.
 *
 * Deliberately minimal: build a URL, fetch, throw a clear error on anything
 * that isn't a successful JSON response. No retry, no caching, no silent
 * fallback — if the API is unreachable, the caller must know. */

// The local FastAPI server is explicitly bound to IPv4 in the demo command.
// `localhost` can resolve to IPv6 first in a browser, producing an avoidable
// "backend unreachable" error even while 127.0.0.1:8000 is healthy.
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';

function baseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  return (fromEnv && fromEnv.trim()) || DEFAULT_BASE_URL;
}

export class ApiUnavailableError extends Error {
  constructor(url: string, cause: unknown) {
    super(
      `OceanLens backend unreachable at ${url}. Start it with ` +
        `\`cd backend && uvicorn app.main:app --reload --port 8000\`, or set ` +
        `VITE_API_BASE_URL to point at a running instance.`,
    );
    this.name = 'ApiUnavailableError';
    this.cause = cause;
  }
}

export class ApiResponseError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : JSON.stringify(body);
    super(`OceanLens backend returned ${status} for ${url}: ${detail}`);
    this.name = 'ApiResponseError';
  }
}

export interface QueryParams {
  readonly [key: string]:
    | string
    | number
    | boolean
    | readonly (string | number)[]
    | undefined
    | null;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl() + '/');
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  const url = buildUrl(path, params);
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  } catch (cause) {
    throw new ApiUnavailableError(url, cause);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body; leave body null, the status code still drives the error
  }
  if (!res.ok) {
    throw new ApiResponseError(url, res.status, body);
  }
  return body as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiUnavailableError(url, cause);
  }
  let result: unknown = null;
  try { result = await res.json(); } catch { /* status remains useful */ }
  if (!res.ok) throw new ApiResponseError(url, res.status, result);
  return result as T;
}

export { baseUrl as apiBaseUrl };
