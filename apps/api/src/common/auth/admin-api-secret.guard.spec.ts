import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AdminApiSecretGuard } from './admin-api-secret.guard';

describe('AdminApiSecretGuard', () => {
  const originalSecret = process.env.ADMIN_API_SECRET;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    process.env.ADMIN_API_SECRET = originalSecret;
  });

  it('accepts requests with the configured admin secret header', async () => {
    process.env.ADMIN_API_SECRET = 'super-secret';

    const guard = await Test.createTestingModule({
      providers: [AdminApiSecretGuard],
    }).compile();

    const instance = guard.get(AdminApiSecretGuard);
    const request = {
      headers: {
        'x-admin-secret': 'super-secret',
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as never;

    expect(instance.canActivate(context)).toBe(true);
  });

  it('rejects anonymous admin requests', async () => {
    process.env.ADMIN_API_SECRET = 'super-secret';

    const guard = await Test.createTestingModule({
      providers: [AdminApiSecretGuard],
    }).compile();

    const instance = guard.get(AdminApiSecretGuard);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as never;

    expect(() => instance.canActivate(context)).toThrow(
      new UnauthorizedException('Admin API secret is required.'),
    );
  });
});
