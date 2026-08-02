/**
 * Thin fetch wrapper that:
 *   - Prepends API_BASE_URL
 *   - Attaches Bearer token if we have one
 *   - JSON-serializes the body
 *   - Throws ApiError on non-2xx (so React Query routes it through `error`)
 *   - Handles 204 No Content cleanly (returns undefined)
 *
 * Intentionally tiny — we'll grow it before swapping to a full generated
 * client (TODO: replace with @hey-api/openapi-ts before shipping).
 */
import { API_BASE_URL } from '../config';
import { getAccessToken, getRefreshToken, saveTokens } from './storage';

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public data?: unknown,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Global hook for "the token we sent was rejected." The AuthProvider
 * registers a handler that clears tokens and flips isAuthenticated -> false,
 * which sends the user back to LoginScreen. Only fires for requests that
 * actually carried a token (skipAuth=false) — login attempts with bad
 * credentials don't trigger logout.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(cb: (() => void) | null) {
	onUnauthorized = cb;
}

// Deduplicates concurrent refresh attempts so multiple 401s don't race.
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
	const rt = await getRefreshToken();
	if (!rt) return null;

	try {
		const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
			method:  'POST',
			headers: { 'Content-Type': 'application/json' },
			body:    JSON.stringify({ refresh_token: rt }),
		});
		if (!res.ok) return null;
		const data = await res.json();
		await saveTokens(data.access_token, data.refresh_token);
		return data.access_token as string;
	} catch {
		return null;
	}
}

interface RequestOptions {
	method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
	body?: unknown;
	/** Skip the Bearer token (e.g. for login / register). */
	skipAuth?: boolean;
	/** Query string fragments to append; values get URL-encoded. Arrays repeat the key. */
	query?: Record<string, string | number | string[] | undefined>;
}

export async function apiFetch<T>(
	path: string,
	options: RequestOptions = {},
): Promise<T> {
	const { method = 'GET', body, skipAuth, query } = options;

	// Build URL with optional query string
	let url = `${API_BASE_URL}${path}`;
	if (query) {
		const parts: string[] = [];
		for (const [k, v] of Object.entries(query)) {
			if (v === undefined) continue;
			if (Array.isArray(v)) {
				for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(item)}`);
			} else {
				parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
			}
		}
		if (parts.length) url += `?${parts.join('&')}`;
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept:         'application/json',
	};
	if (!skipAuth) {
		const token = await getAccessToken();
		if (token) headers.Authorization = `Bearer ${token}`;
	}

	const jsonBody = body !== undefined ? JSON.stringify(body) : undefined;

	let response = await fetch(url, { method, headers, body: jsonBody });

	// On 401, attempt a silent token refresh and retry once.
	if (response.status === 401 && !skipAuth) {
		if (!refreshPromise) {
			refreshPromise = tryRefresh().finally(() => { refreshPromise = null; });
		}
		const newToken = await refreshPromise;

		if (newToken) {
			headers.Authorization = `Bearer ${newToken}`;
			response = await fetch(url, { method, headers, body: jsonBody });
		}
	}

	if (response.status === 204) {
		return undefined as T;
	}

	let parsed: unknown = null;
	try {
		parsed = await response.json();
	} catch {
		// Non-JSON or empty body — leave parsed as null
	}

	if (!response.ok) {
		const message = extractErrorMessage(parsed) ?? response.statusText;
		if (__DEV__) {
			// eslint-disable-next-line no-console
			console.warn(`[api] ${method} ${path} -> ${response.status}`, parsed);
		}
		if (response.status === 401 && !skipAuth) {
			onUnauthorized?.();
		}
		throw new ApiError(response.status, message, parsed);
	}

	return parsed as T;
}

/**
 * FastAPI returns errors as `{ detail: "..." }` for business errors (409/404),
 * but as `{ detail: [{ msg: "...", loc: [...] }, ...] }` for Pydantic validation
 * failures (422). Handle both — plus a generic message fallback.
 */
function extractErrorMessage(parsed: unknown): string | null {
	if (!parsed || typeof parsed !== 'object') return null;
	const obj = parsed as Record<string, unknown>;

	const detail = obj.detail;
	if (typeof detail === 'string') return detail;

	if (Array.isArray(detail)) {
		const messages = detail
			.map((d) => {
				if (d && typeof d === 'object' && 'msg' in d) {
					const msg = (d as { msg: unknown }).msg;
					return typeof msg === 'string' ? msg : null;
				}
				return null;
			})
			.filter((m): m is string => m !== null);
		if (messages.length) return messages.join('. ');
	}

	if (typeof obj.message === 'string') return obj.message;
	return null;
}
