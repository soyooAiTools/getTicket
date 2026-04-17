import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage: Record<string, string> = {};

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn((key: string) => storage[key]),
    removeStorageSync: vi.fn((key: string) => {
      delete storage[key];
    }),
    setStorageSync: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
  },
}));

describe('session service', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => {
      delete storage[key];
    });
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.TARO_APP_API_BASE_URL;
    (globalThis as typeof globalThis & { wx: never }).wx = {
      login: vi.fn(),
      request: vi.fn(),
    } as never;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the configured API base URL when exchanging a WeChat code', async () => {
    process.env.TARO_APP_API_BASE_URL = 'https://beta.example.com/api';
    const { ensureSession } = await import('./session');

    const wxLogin = vi.fn((options: { success: (result: { code: string }) => void }) => {
      options.success({ code: 'wechat-code-123' });
    });
    const wxRequest = vi.fn((options: {
      success: (result: { data: { token: string; expiresAt: string } }) => void;
    }) => {
      options.success({
        data: {
          expiresAt: '2026-04-24T09:30:00.000Z',
          token: 'session-token-123',
        },
      });
    });
    (globalThis as typeof globalThis & { wx: { login: typeof wxLogin; request: typeof wxRequest } }).wx = {
      login: wxLogin,
      request: wxRequest,
    };

    await expect(ensureSession()).resolves.toBe('session-token-123');
    expect(wxRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://beta.example.com/api/auth/wechat/login',
      }),
    );
  });

  it('reuses a non-expired session without calling wx.login', async () => {
    const futureExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    storage['customer-session-token'] = 'stored-token-123';
    storage['customer-session-expires-at'] = futureExpiresAt;

    const { ensureSession } = await import('./session');
    const wxLogin = vi.fn();
    const wxRequest = vi.fn();
    (globalThis as typeof globalThis & { wx: { login: typeof wxLogin; request: typeof wxRequest } }).wx = {
      login: wxLogin,
      request: wxRequest,
    };

    await expect(ensureSession()).resolves.toBe('stored-token-123');
    expect(wxLogin).not.toHaveBeenCalled();
    expect(wxRequest).not.toHaveBeenCalled();
  });

  it('clears an expired session before logging in again', async () => {
    storage['customer-session-token'] = 'stale-token';
    storage['customer-session-expires-at'] = '2026-04-16T09:30:00.000Z';

    const { ensureSession } = await import('./session');
    const wxLogin = vi.fn((options: { success: (result: { code: string }) => void }) => {
      options.success({ code: 'wechat-code-456' });
    });
    const wxRequest = vi.fn((options: {
      success: (result: { data: { token: string; expiresAt: string } }) => void;
    }) => {
      options.success({
        data: {
          expiresAt: '2026-04-24T09:30:00.000Z',
          token: 'fresh-token-456',
        },
      });
    });
    (globalThis as typeof globalThis & { wx: { login: typeof wxLogin; request: typeof wxRequest } }).wx = {
      login: wxLogin,
      request: wxRequest,
    };

    await expect(ensureSession()).resolves.toBe('fresh-token-456');
    expect(storage['customer-session-token']).toBe('fresh-token-456');
    expect(storage['customer-session-expires-at']).toBe('2026-04-24T09:30:00.000Z');
    expect(wxLogin).toHaveBeenCalledTimes(1);
  });
});
