import { z } from 'zod';

export const customerIdentitySchema = z
  .object({
    id: z.string().min(1),
    accountKey: z.string().min(1),
  })
  .strict();

export const customerSessionSchema = z
  .object({
    token: z.string().min(1),
    customer: customerIdentitySchema,
    expiresAt: z.string().datetime(),
  })
  .strict();

export type CustomerIdentity = z.infer<typeof customerIdentitySchema>;
export type CustomerSession = z.infer<typeof customerSessionSchema>;
