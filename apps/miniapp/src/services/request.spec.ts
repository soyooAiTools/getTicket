import { beforeEach, describe, expect, it, vi } from 'vitest';

const sessionMock = {
  clearSession: vi.fn(),
  ensureSession: vi.fn(),
  resolveApiBaseUrl: vi.fn(
    () => process.env.TARO_APP_API_BASE_URL ?? 'https://beta.example.com/api',
  ),
};

vi.mock('./session', () => sessionMock);

describe('request service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.TARO_APP_API_BASE_URL;
    (globalThis as typeof globalThis & { wx: never }).wx = {
      request: vi.fn(),
    } as never;
  });

  it('uses the configured API base URL for protected requests', async () => {
    process.env.TARO_APP_API_BASE_URL = 'https://beta.example.com/api';
    sessionMock.ensureSession.mockResolvedValue('token-123');

    const wxRequest = vi.fn((options: {
      success: (result: { data: string; statusCode: number }) => void;
    }) => {
      options.success({ data: 'ok', statusCode: 200 });
    });
    (globalThis as typeof globalThis & { wx: { request: typeof wxRequest } }).wx = {
      request: wxRequest,
    };

    const { request } = await import('./request');

    await expect(request<string>({ url: '/viewers' })).resolves.toBe('ok');
    expect(wxRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        header: {
          Authorization: 'Bearer token-123',
          'content-type': 'application/json',
        },
        url: 'https://beta.example.com/api/viewers',
      }),
    );
  });

  it('retries a protected request once after a 401 by clearing the cached session', async () => {
    process.env.TARO_APP_API_BASE_URL = 'https://beta.example.com/api';
    sessionMock.ensureSession
      .mockResolvedValueOnce('token-old')
      .mockResolvedValueOnce('token-fresh');

    const wxRequest = vi.fn((options: {
      success: (result: { data: unknown; statusCode: number }) => void;
    }) => {
      if (wxRequest.mock.calls.length === 1) {
        options.success({
          data: { message: 'Unauthorized' },
          statusCode: 401,
        });
        return;
      }

      options.success({ data: { ok: true }, statusCode: 200 });
    });
    (globalThis as typeof globalThis & { wx: { request: typeof wxRequest } }).wx = {
      request: wxRequest,
    };

    const { request } = await import('./request');

    await expect(request<{ ok: boolean }>({ url: '/viewers' })).resolves.toEqual({
      ok: true,
    });
    expect(sessionMock.clearSession).toHaveBeenCalledTimes(1);
    expect(sessionMock.ensureSession).toHaveBeenCalledTimes(2);
    expect(wxRequest).toHaveBeenCalledTimes(2);
  });

  it('does not add an authorization header for auth routes', async () => {
    process.env.TARO_APP_API_BASE_URL = 'https://beta.example.com/api';

    const wxRequest = vi.fn((options: {
      success: (result: { data: string; statusCode: number }) => void;
    }) => {
      options.success({ data: 'ok', statusCode: 200 });
    });
    (globalThis as typeof globalThis & { wx: { request: typeof wxRequest } }).wx = {
      request: wxRequest,
    };

    const { request } = await import('./request');

    await expect(
      request<string>({
        data: { code: 'abc' },
        method: 'POST',
        url: '/auth/wechat/login',
      }),
    ).resolves.toBe('ok');
    expect(sessionMock.ensureSession).not.toHaveBeenCalled();
    expect(wxRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        header: {
          'content-type': 'application/json',
        },
        url: 'https://beta.example.com/api/auth/wechat/login',
      }),
    );
  });
});
