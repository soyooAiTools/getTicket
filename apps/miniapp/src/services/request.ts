import {
  clearSession,
  ensureSession,
  resolveApiBaseUrl,
} from './session';

type RequestOptions<TData> = {
  data?: TData;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
};

export async function request<TResponse, TData = Record<string, unknown>>({
  data,
  method = 'GET',
  url,
}: RequestOptions<TData>) {
  const isAuthRoute = url.startsWith('/auth');

  const performRequest = (authorizationHeader?: string) =>
    new Promise<{ data: unknown; statusCode: number }>((resolve, reject) => {
      wx.request({
        data,
        header: {
          ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
          'content-type': 'application/json',
        },
        method,
        success: resolve,
        fail: reject,
        url: `${resolveApiBaseUrl()}${url}`,
      });
    });

  const parseResponse = (response: { data: unknown; statusCode: number }) => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      const message =
        typeof response.data === 'object' &&
        response.data !== null &&
        'message' in response.data &&
        typeof (response.data as { message?: unknown }).message === 'string'
          ? (response.data as { message: string }).message
          : `Request failed with status ${response.statusCode}`;

      const error = new Error(message) as Error & { statusCode?: number };
      error.statusCode = response.statusCode;
      throw error;
    }

    return response.data as TResponse;
  };

  const run = async (
    retryOnUnauthorized = true,
    sessionToken?: string,
  ): Promise<TResponse> => {
    const authorizationHeader = isAuthRoute
      ? undefined
      : `Bearer ${sessionToken ?? (await ensureSession())}`;

    try {
      return parseResponse(await performRequest(authorizationHeader));
    } catch (error) {
      const responseError = error as { statusCode?: number };
      if (
        retryOnUnauthorized &&
        !isAuthRoute &&
        responseError.statusCode === 401
      ) {
        clearSession();
        return run(false, await ensureSession());
      }

      throw error;
    }
  };

  return run();
}
