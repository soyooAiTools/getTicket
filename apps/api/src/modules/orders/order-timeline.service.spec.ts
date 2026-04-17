import { OrderTimelineService } from './order-timeline.service';

describe('OrderTimelineService', () => {
  it('maps PAID_PENDING_FULFILLMENT for e-ticket orders to a user-facing timeline item', () => {
    const service = new OrderTimelineService();

    expect(
      service.toTimelineItem('PAID_PENDING_FULFILLMENT', 'E_TICKET'),
    ).toEqual({
      title: '待履约确认',
      description: expect.stringContaining('演出前三天'),
    });
  });

  it('maps PAID_PENDING_FULFILLMENT for paper-ticket orders with the paper delivery timing', () => {
    const service = new OrderTimelineService();

    expect(
      service.toTimelineItem('PAID_PENDING_FULFILLMENT', 'PAPER_TICKET'),
    ).toEqual({
      title: '待履约确认',
      description: expect.stringContaining('演出前七天'),
    });
  });

  it('returns a neutral fallback timeline item for statuses without a dedicated mapping yet', () => {
    const service = new OrderTimelineService();

    expect(service.toTimelineItem('COMPLETED', 'E_TICKET')).toEqual({
      title: '订单处理中',
      description: expect.stringContaining('继续同步后续处理进度'),
    });
  });
});
