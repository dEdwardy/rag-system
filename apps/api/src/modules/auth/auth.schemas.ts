import { z } from "zod";

export const loginSchema = z.object({
  userId: z.string().min(1).optional()
});

export type LoginInput = z.infer<typeof loginSchema>;
