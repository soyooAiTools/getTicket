import Taro from '@tarojs/taro';

import type { CheckoutParams } from './checkout-state';

const DRAFT_ORDER_STORAGE_KEY = 'checkout-draft-order';

type StoredDraftOrder = {
  checkoutKey: string;
  orderId: string;
};

function buildCheckoutKey(checkoutParams: CheckoutParams) {
  const normalizedViewerIds = [...checkoutParams.viewerIds].sort();

  return [
    checkoutParams.ticketType,
    checkoutParams.tierId,
    normalizedViewerIds.join(','),
  ].join('|');
}

export function readStoredDraftOrderId(checkoutParams: CheckoutParams) {
  const storedValue = Taro.getStorageSync(DRAFT_ORDER_STORAGE_KEY) as
    | StoredDraftOrder
    | undefined;

  if (!storedValue || typeof storedValue !== 'object') {
    return '';
  }

  return storedValue.checkoutKey === buildCheckoutKey(checkoutParams) &&
    typeof storedValue.orderId === 'string'
    ? storedValue.orderId
    : '';
}

export function writeStoredDraftOrderId(
  checkoutParams: CheckoutParams,
  orderId: string,
) {
  Taro.setStorageSync(DRAFT_ORDER_STORAGE_KEY, {
    checkoutKey: buildCheckoutKey(checkoutParams),
    orderId,
  } satisfies StoredDraftOrder);
}

export function clearStoredDraftOrderId() {
  Taro.removeStorageSync(DRAFT_ORDER_STORAGE_KEY);
}

export async function resolvePayableOrderId(input: {
  createDraftOrder: () => Promise<string>;
  currentOrderId: string | null | undefined;
}) {
  const currentOrderId =
    typeof input.currentOrderId === 'string' ? input.currentOrderId.trim() : '';

  if (currentOrderId) {
    return currentOrderId;
  }

  return input.createDraftOrder();
}
