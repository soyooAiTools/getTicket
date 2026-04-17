import { z } from 'zod';

import { eventSummarySchema } from './event';
import { viewerSchema } from './viewer';

export const orderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PAID_PENDING_FULFILLMENT',
  'SUBMITTED_TO_VENDOR',
  'TICKET_ISSUED',
  'TICKET_FAILED',
  'REFUND_REVIEWING',
  'REFUND_PROCESSING',
  'REFUNDED',
  'COMPLETED',
  'CLOSED',
]);

export const ticketTypeSchema = z.enum(['E_TICKET', 'PAPER_TICKET']);

export const orderTimelineItemSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const orderDetailViewerSchema = z
  .object({
    id: z.string().min(1),
    mobile: z.string().regex(/^1\d{10}$/),
    name: z.string().min(1),
  })
  .strict();

export const orderItemSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sessionName: z.string().min(1),
  tierName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  totalAmount: z.number().int().nonnegative(),
});

export const orderDetailItemSchema = orderItemSchema
  .extend({
    viewer: orderDetailViewerSchema,
  })
  .strict();

export const orderListItemSchema = z
  .object({
    id: z.string().min(1),
    orderNumber: z.string().min(1),
    status: orderStatusSchema,
    ticketType: ticketTypeSchema,
    totalAmount: z.number().int().nonnegative(),
    currency: z.string().min(1),
    createdAt: z.string().datetime(),
    event: eventSummarySchema,
    timeline: orderTimelineItemSchema,
    refundEntryEnabled: z.boolean(),
  })
  .strict();

export const orderDetailSchema = z
  .object({
    id: z.string().min(1),
    orderNumber: z.string().min(1),
    status: orderStatusSchema,
    ticketType: ticketTypeSchema,
    totalAmount: z.number().int().nonnegative(),
    currency: z.string().min(1),
    createdAt: z.string().datetime(),
    event: eventSummarySchema,
    timeline: orderTimelineItemSchema,
    refundEntryEnabled: z.boolean(),
    items: z.array(orderDetailItemSchema).min(1),
  })
  .strict();

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type TicketType = z.infer<typeof ticketTypeSchema>;
export type OrderTimelineItem = z.infer<typeof orderTimelineItemSchema>;
export type OrderDetailViewer = z.infer<typeof orderDetailViewerSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderDetailItem = z.infer<typeof orderDetailItemSchema>;
export type OrderListItem = z.infer<typeof orderListItemSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
