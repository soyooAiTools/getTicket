import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { VendorCallbackSecretGuard } from './vendor-callback-secret.guard';

describe('VendorCallbackSecretGuard', () => {
  const originalSecret = process.env.VENDOR_CALLBACK_SECRET;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    process.env.VENDOR_CALLBACK_SECRET = originalSecret;
  });

  it('accepts requests with the configured vendor callback secret header', async () => {
    process.env.VENDOR_CALLBACK_SECRET = 'vendor-secret';

    const moduleRef = await Test.createTestingModule({
      providers: [VendorCallbackSecretGuard],
    }).compile();

    const guard = moduleRef.get(VendorCallbackSecretGuard);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-vendor-callback-secret': 'vendor-secret',
          },
        }),
      }),
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects vendor callbacks without the configured secret header', async () => {
    process.env.VENDOR_CALLBACK_SECRET = 'vendor-secret';

    const moduleRef = await Test.createTestingModule({
      providers: [VendorCallbackSecretGuard],
    }).compile();

    const guard = moduleRef.get(VendorCallbackSecretGuard);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(
      new UnauthorizedException('Vendor callback secret is required.'),
    );
  });
});
