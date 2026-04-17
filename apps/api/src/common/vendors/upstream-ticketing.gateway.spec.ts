import { BadRequestException } from '@nestjs/common';

import { UpstreamTicketingGateway } from './upstream-ticketing.gateway';

describe('UpstreamTicketingGateway', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VENDOR_API_BASE_URL: 'https://vendor.example.com/api',
      VENDOR_API_KEY: 'vendor-key-123',
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('posts order submissions with the configured vendor credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        externalRef: 'vendor_order_1',
      }),
      ok: true,
    });
    global.fetch = fetchMock as typeof global.fetch;

    const gateway = new UpstreamTicketingGateway();

    await expect(gateway.submitOrder({ orderId: 'ord_1' })).resolves.toEqual({
      externalRef: 'vendor_order_1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://vendor.example.com/api/orders',
      {
        body: JSON.stringify({
          orderId: 'ord_1',
        }),
        headers: {
          Authorization: 'Bearer vendor-key-123',
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('posts refund submissions with the configured vendor credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        externalRef: 'vendor_refund_1',
      }),
      ok: true,
    });
    global.fetch = fetchMock as typeof global.fetch;

    const gateway = new UpstreamTicketingGateway();

    await expect(
      gateway.submitRefund({
        amount: 80000,
        orderId: 'ord_1',
        refundNo: 'RFD-001',
      }),
    ).resolves.toEqual({
      externalRef: 'vendor_refund_1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://vendor.example.com/api/refunds',
      {
        body: JSON.stringify({
          amount: 80000,
          orderId: 'ord_1',
          refundNo: 'RFD-001',
        }),
        headers: {
          Authorization: 'Bearer vendor-key-123',
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    );
  });

  it('maps upstream request failures into bad-request exceptions', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        message: 'vendor rejected request',
      }),
      ok: false,
    });
    global.fetch = fetchMock as typeof global.fetch;

    const gateway = new UpstreamTicketingGateway();

    await expect(gateway.submitOrder({ orderId: 'ord_1' })).rejects.toThrow(
      new BadRequestException('vendor rejected request'),
    );
  });
});
