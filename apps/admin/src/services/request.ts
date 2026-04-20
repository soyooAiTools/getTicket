const DEFAULT_API_BASE_URL = '/api';
const API_BASE_URL_STORAGE_KEY = 'ticketing.admin.apiBaseUrl';
const API_SECRET_STORAGE_KEY = 'ticketing.admin.apiSecret';

function readBrowserSetting(key: string) {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const value = window.localStorage.getItem(key)?.trim();
    return value ? value : undefined;
  } catch {
    return undefined;
  }
}

function buildApiUrl(path: string) {
  const baseUrl = readBrowserSetting(API_BASE_URL_STORAGE_KEY) ?? DEFAULT_API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function readErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (typeof payload?.message === 'string' && payload.message.length > 0) {
      return payload.message;
    }
  }

  const text = await response.text().catch(() => '');

  if (text.length > 0) {
    return text;
  }

  return `Admin request failed: ${response.status}`;
}

export async function request<TResponse>(
  path: string,
  init: globalThis.RequestInit = {},
): Promise<TResponse> {
  const headers = new Headers(init.headers);
  const adminSecret = readBrowserSetting(API_SECRET_STORAGE_KEY);

  headers.set('accept', 'application/json');

  if (adminSecret && !headers.has('x-admin-secret')) {
    headers.set('x-admin-secret', adminSecret);
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export function jsonRequest<TResponse>(
  path: string,
  method: 'PATCH' | 'POST',
  body: unknown,
) {
  return request<TResponse>(path, {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method,
  });
}
