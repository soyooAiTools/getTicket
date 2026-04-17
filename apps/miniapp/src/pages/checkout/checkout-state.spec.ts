import { describe, expect, it } from 'vitest';

import { parseCheckoutParams } from './checkout-state';

describe('parseCheckoutParams', () => {
  it('derives quantity from the selected viewers instead of trusting caller input', () => {
    expect(
      parseCheckoutParams({
        quantity: '99',
        ticketType: 'PAPER_TICKET',
        tierId: 'tier_001',
        viewerIds: 'viewer_1, viewer_2',
      }),
    ).toEqual({
      quantity: 2,
      ticketType: 'PAPER_TICKET',
      tierId: 'tier_001',
      viewerIds: ['viewer_1', 'viewer_2'],
    });
  });

  it('rejects checkout params without a real tier id or viewer ids', () => {
    expect(
      parseCheckoutParams({
        ticketType: 'E_TICKET',
        tierId: '',
        viewerIds: '',
      }),
    ).toBeNull();
  });
});
