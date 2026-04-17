import { z } from 'zod';

const mainlandMobileRegex = /^1\d{10}$/;

export const viewerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mobile: z.string().regex(mainlandMobileRegex),
  idCard: z.string().length(18),
});

export type Viewer = z.infer<typeof viewerSchema>;
