import { describe, expect, it, vi } from 'vitest';

import { waitForOrderProcessing } from './polling';

describe('waitForOrderProcessing', () => {
  it('polls until the backend leaves the order in a non-pending payment state', async () => {
    const loadOrder = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'PENDING_PAYMENT',
      })
      .mockResolvedValueOnce({
        status: 'PENDING_PAYMENT',
      })
      .mockResolvedValueOnce({
        status: 'PAID_PENDING_FULFILLMENT',
      });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForOrderProcessing({
        loadOrder,
        maxAttempts: 5,
        orderId: 'ord_1',
        sleep,
      }),
    ).resolves.toEqual({
      ready: true,
      status: 'PAID_PENDING_FULFILLMENT',
    });
    expect(loadOrder).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('stops polling after the max attempts if the backend still has the order pending', async () => {
    const loadOrder = vi.fn().mockResolvedValue({
      status: 'PENDING_PAYMENT',
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForOrderProcessing({
        loadOrder,
        maxAttempts: 3,
        orderId: 'ord_1',
        sleep,
      }),
    ).resolves.toEqual({
      ready: false,
      status: 'PENDING_PAYMENT',
    });
    expect(loadOrder).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});
