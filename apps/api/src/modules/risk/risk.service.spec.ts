import { RiskService } from './risk.service';

describe('RiskService', () => {
  it('blocks purchase totals that exceed the ID card limit', () => {
    const service = new RiskService();

    expect(
      service.checkPurchaseLimit({
        existingCount: 2,
        requestedCount: 1,
        limit: 2,
      }),
    ).toEqual({
      allowed: false,
      reason: 'ID_CARD_LIMIT_EXCEEDED',
    });
  });
});
