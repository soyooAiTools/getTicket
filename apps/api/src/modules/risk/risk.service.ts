import { Injectable } from '@nestjs/common';

export type CheckPurchaseLimitInput = {
  existingCount: number;
  requestedCount: number;
  limit: number;
};

export type CheckPurchaseLimitResult = {
  allowed: boolean;
  reason: 'ID_CARD_LIMIT_EXCEEDED' | 'OK';
};

@Injectable()
export class RiskService {
  checkPurchaseLimit({
    existingCount,
    requestedCount,
    limit,
  }: CheckPurchaseLimitInput): CheckPurchaseLimitResult {
    const total = existingCount + requestedCount;

    if (total > limit) {
      return {
        allowed: false,
        reason: 'ID_CARD_LIMIT_EXCEEDED',
      };
    }

    return {
      allowed: true,
      reason: 'OK',
    };
  }
}
