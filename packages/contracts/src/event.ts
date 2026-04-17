import { z } from 'zod';

export const saleStatusSchema = z.enum(['UPCOMING', 'ON_SALE', 'SOLD_OUT']);

export const eventCatalogSummarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    city: z.string().min(1),
    venueName: z.string().min(1),
    coverImageUrl: z.string().url().optional(),
    description: z.string().min(1).optional(),
    saleStatus: saleStatusSchema,
    minPrice: z.number().int().nonnegative(),
    published: z.boolean(),
    refundEntryEnabled: z.boolean(),
  })
  .strict();

export const ticketTierSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
    inventory: z.number().int().nonnegative(),
    ticketType: z.enum(['E_TICKET', 'PAPER_TICKET']),
  })
  .strict();

export const eventTicketTierSchema = ticketTierSummarySchema;

export const eventSessionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    saleStartsAt: z.string().datetime().optional(),
    saleEndsAt: z.string().datetime().optional(),
    ticketTiers: z.array(eventTicketTierSchema),
  })
  .strict();

export const eventDetailSchema = eventCatalogSummarySchema
  .extend({
    sessions: z.array(eventSessionSchema),
  })
  .strict();

export const eventOperationsUpdateSchema = z
  .object({
    published: z.boolean().optional(),
    refundEntryEnabled: z.boolean().optional(),
    saleStatus: saleStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.published !== undefined ||
      value.refundEntryEnabled !== undefined ||
      value.saleStatus !== undefined,
    {
      message: 'At least one event operation field is required.',
    },
  );

export const eventSummarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    city: z.string().min(1),
    venueName: z.string().min(1),
    coverImageUrl: z.string().url().optional(),
    saleStatus: saleStatusSchema,
    minPrice: z.number().int().nonnegative(),
  })
  .strict();

export type SaleStatus = z.infer<typeof saleStatusSchema>;
export type EventCatalogSummary = z.infer<typeof eventCatalogSummarySchema>;
export type TicketTierSummary = z.infer<typeof ticketTierSummarySchema>;
export type EventTicketTier = z.infer<typeof eventTicketTierSchema>;
export type EventSession = z.infer<typeof eventSessionSchema>;
export type EventDetail = z.infer<typeof eventDetailSchema>;
export type EventOperationsUpdate = z.infer<typeof eventOperationsUpdateSchema>;
export type EventSummary = z.infer<typeof eventSummarySchema>;
