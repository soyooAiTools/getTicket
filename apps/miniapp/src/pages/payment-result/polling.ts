type OrderStatusSnapshot = {
  status: string;
};

type WaitForOrderProcessingInput = {
  loadOrder: (orderId: string) => Promise<OrderStatusSnapshot>;
  maxAttempts?: number;
  orderId: string;
  sleep?: (delayMs: number) => Promise<void>;
};

function sleepMs(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function waitForOrderProcessing({
  loadOrder,
  maxAttempts = 5,
  orderId,
  sleep = sleepMs,
}: WaitForOrderProcessingInput) {
  let latestStatus = 'PENDING_PAYMENT';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const order = await loadOrder(orderId);
    latestStatus = order.status;

    if (latestStatus !== 'PENDING_PAYMENT') {
      return {
        ready: true,
        status: latestStatus,
      };
    }

    if (attempt < maxAttempts) {
      await sleep(1000);
    }
  }

  return {
    ready: false,
    status: latestStatus,
  };
}
