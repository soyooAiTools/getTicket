import Taro from '@tarojs/taro';

export const SESSION_STORAGE_KEY = 'customer-session-token';
export const SESSION_EXPIRES_AT_KEY = 'customer-session-expires-at';
const DEFAULT_API_BASE_URL = 'https://beta.example.com/api';

type WxLoginResult = {
  code?: string;
};

type WxRequestResult<TData> = {
  data: TData;
  statusCode: number;
};

type CustomerLoginResponse = {
  expiresAt: string;
  token: string;
};

export function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.TARO_APP_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  return DEFAULT_API_BASE_URL;
}

export function clearSession() {
  Taro.removeStorageSync(SESSION_STORAGE_KEY);
  Taro.removeStorageSync(SESSION_EXPIRES_AT_KEY);
}

function readStoredSession() {
  const token = Taro.getStorageSync(SESSION_STORAGE_KEY);
  const expiresAt = Taro.getStorageSync(SESSION_EXPIRES_AT_KEY);

  if (
    typeof token !== 'string' ||
    token.trim().length === 0 ||
    typeof expiresAt !== 'string' ||
    expiresAt.trim().length === 0
  ) {
    return null;
  }

  return {
    expiresAt: expiresAt.trim(),
    token: token.trim(),
  };
}

function isExpired(expiresAt: string) {
  const expiresAtMillis = Date.parse(expiresAt);

  return Number.isNaN(expiresAtMillis) || expiresAtMillis <= Date.now();
}

export function getSessionToken() {
  const session = readStoredSession();

  if (!session) {
    return null;
  }

  if (isExpired(session.expiresAt)) {
    clearSession();
    return null;
  }

  return session.token;
}

function setSession(session: CustomerLoginResponse) {
  Taro.setStorageSync(SESSION_STORAGE_KEY, session.token.trim());
  Taro.setStorageSync(SESSION_EXPIRES_AT_KEY, session.expiresAt.trim());
}

export async function ensureSession() {
  const existingSession = readStoredSession();

  if (existingSession && !isExpired(existingSession.expiresAt)) {
    return existingSession.token;
  }

  if (existingSession) {
    clearSession();
  }

  const loginCode = await new Promise<string>((resolve, reject) => {
    wx.login({
      fail: reject,
      success: (result: WxLoginResult) => {
        if (typeof result.code === 'string' && result.code.trim().length > 0) {
          resolve(result.code.trim());
          return;
        }

        reject(new Error('WeChat login did not return a code.'));
      },
    });
  });

  const session = await new Promise<CustomerLoginResponse>((resolve, reject) => {
    wx.request({
      data: { code: loginCode },
      header: {
        'content-type': 'application/json',
      },
      method: 'POST',
      success: (
        response: WxRequestResult<CustomerLoginResponse>,
      ) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const errorData = response.data as { message?: unknown };
          reject(
            new Error(
              typeof errorData.message === 'string'
                ? errorData.message
                : `Login failed with status ${response.statusCode}`,
            ),
          );
          return;
        }

        resolve(response.data);
      },
      url: `${resolveApiBaseUrl()}/auth/wechat/login`,
      fail: reject,
    });
  });

  if (
    typeof session.token !== 'string' ||
    session.token.trim().length === 0 ||
    typeof session.expiresAt !== 'string' ||
    session.expiresAt.trim().length === 0
  ) {
    throw new Error('Customer login did not return a session token.');
  }

  setSession(session);

  return session.token.trim();
}
