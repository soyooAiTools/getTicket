import { z } from 'zod';

export const paymentIntentSchema = z
  .object({
    paymentId: z.string().min(1),
    orderId: z.string().min(1),
    method: z.enum(['EXTERNAL_PROVIDER']),
    status: z.enum(['PENDING']),
    intentToken: z.string().min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
