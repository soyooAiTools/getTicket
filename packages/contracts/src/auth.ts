import { z } from 'zod';

export const miniappCustomerSchema = z
  .object({
    id: z.string().min(1),
    openId: z.string().min(1),
  })
  .strict();

export const miniappSessionSchema = z
  .object({
    token: z.string().min(1),
    customer: miniappCustomerSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();

export type MiniappCustomer = z.infer<typeof miniappCustomerSchema>;
export type MiniappSession = z.infer<typeof miniappSessionSchema>;
