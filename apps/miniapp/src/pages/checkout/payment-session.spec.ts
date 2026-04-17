import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage: Record<string, unknown> = {};

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn((key: string) => storage[key]),
    removeStorageSync: vi.fn((key: string) => {
      delete storage[key];
    }),
    setStorageSync: vi.fn((key: string, value: unknown) => {
      storage[key] = value;
    }),
  },
}));

import {
  readStoredDraftOrderId,
  resolvePayableOrderId,
  writeStoredDraftOrderId,
} from './payment-session';

const checkoutParams = {
  quantity: 2,
  ticketType: 'E_TICKET' as const,
  tierId: 'tier_001',
  viewerIds: ['viewer_1', 'viewer_2'],
};

describe('resolvePayableOrderId', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => {
      delete storage[key];
    });
  });

  it('reuses an existing draft order id instead of creating another pending order', async () => {
    const createDraftOrder = vi.fn();

    await expect(
      resolvePayableOrderId({
        createDraftOrder,
        currentOrderId: 'ord_existing',
      }),
    ).resolves.toBe('ord_existing');
    expect(createDraftOrder).not.toHaveBeenCalled();
  });

  it('creates a draft order when there is no reusable pending order id', async () => {
    const createDraftOrder = vi.fn().mockResolvedValue('ord_new');

    await expect(
      resolvePayableOrderId({
        createDraftOrder,
        currentOrderId: '',
      }),
    ).resolves.toBe('ord_new');
    expect(createDraftOrder).toHaveBeenCalledTimes(1);
  });

  it('reuses the stored draft order id even if the same viewers arrive in a different order', () => {
    writeStoredDraftOrderId(checkoutParams, 'ord_existing');

    expect(
      readStoredDraftOrderId({
        ...checkoutParams,
        viewerIds: ['viewer_2', 'viewer_1'],
      }),
    ).toBe('ord_existing');
  });

  it('ignores malformed stored draft order payloads instead of returning a non-string id', () => {
    storage['checkout-draft-order'] = {
      checkoutKey: 'tier_001|viewer_1,viewer_2',
      orderId: 123,
    };

    expect(readStoredDraftOrderId(checkoutParams)).toBe('');
  });
});
