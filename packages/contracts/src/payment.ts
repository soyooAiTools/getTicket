import { z } from 'zod';

export const paymentIntentSchema = z
  .object({
    appId: z.string().min(1),
    nonceStr: z.string().min(1),
    packageValue: z.string().min(1),
    paySign: z.string().min(1),
    signType: z.enum(['RSA', 'MD5', 'HMAC-SHA256']),
    timeStamp: z.string().min(1),
  })
  .strict();

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
