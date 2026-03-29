import { z } from "zod";

const optionalBoundedListLimitSchema = z.coerce.number().int().min(1).max(100).optional();
const boundedListLimitSchema = optionalBoundedListLimitSchema.default(20);

export const listAuditEventsSchema = z.object({
  source: z.enum(["all", "trace", "document_run"]).optional().default("all"),
  issueOnly: z.coerce.boolean().optional().default(false),
  sinceHours: z.coerce.number().positive().max(24 * 30).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  limit: boundedListLimitSchema
});

export type ListAuditEventsInput = z.infer<typeof listAuditEventsSchema>;
