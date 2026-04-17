import { describe, expect, it, vi } from 'vitest';

import { schedulePaymentResultRedirect } from './redirect';

describe('schedulePaymentResultRedirect', () => {
  it('schedules an automatic redirect into the order detail page', () => {
    const navigate = vi.fn();
    const scheduler = vi.fn((callback: () => void, delayMs: number) => {
      callback();
      return delayMs;
    });

    const handle = schedulePaymentResultRedirect({
      delayMs: 1200,
      navigate,
      orderId: 'ord_1',
      scheduler,
    });

    expect(scheduler).toHaveBeenCalledWith(expect.any(Function), 1200);
    expect(navigate).toHaveBeenCalledWith('/pages/order-detail/index?id=ord_1');
    expect(handle).toBe(1200);
  });

  it('falls back to the order list when no order id is present', () => {
    const navigate = vi.fn();
    const scheduler = vi.fn((callback: () => void, delayMs: number) => {
      callback();
      return delayMs;
    });

    schedulePaymentResultRedirect({
      delayMs: 1200,
      navigate,
      orderId: '',
      scheduler,
    });

    expect(navigate).toHaveBeenCalledWith('/pages/orders/index');
  });
});
