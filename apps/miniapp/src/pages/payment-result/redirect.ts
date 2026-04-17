type SchedulePaymentResultRedirectInput = {
  delayMs?: number;
  navigate: (url: string) => void;
  orderId: string;
  scheduler?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
};

export function resolvePaymentResultRedirectUrl(orderId: string) {
  const trimmedOrderId = orderId.trim();

  if (!trimmedOrderId) {
    return '/pages/orders/index';
  }

  return `/pages/order-detail/index?id=${trimmedOrderId}`;
}

export function schedulePaymentResultRedirect({
  delayMs = 1500,
  navigate,
  orderId,
  scheduler = setTimeout,
}: SchedulePaymentResultRedirectInput) {
  const targetUrl = resolvePaymentResultRedirectUrl(orderId);

  return scheduler(() => {
    navigate(targetUrl);
  }, delayMs);
}
