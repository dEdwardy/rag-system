import { z } from 'zod';

export const agentToolRequestSchema = z.object({
  secret: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1).optional()
});

const boundedMultiStepSchema = z
  .object({
    enabled: z.boolean().optional(),
    rewrittenQuery: z.string().min(1).max(4000).optional(),
    requestSecondPass: z.boolean().optional()
  })
  .optional();

export const ragSearchSchema = z.object({
  secret: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  assistantId: z.string().min(1),
  question: z.string().min(1).max(4000),
  conversationId: z.string().min(1).optional(),
  boundedMultiStep: boundedMultiStepSchema
});

export const ragAnswerSchema = ragSearchSchema;
export const langGraphAnswerSchema = ragSearchSchema;

export const traceLookupSchema = z.object({
  secret: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  traceId: z.string().min(1)
});

export const documentLookupSchema = z.object({
  secret: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  documentId: z.string().min(1)
});

export type RagSearchInput = z.infer<typeof ragSearchSchema>;
export type RagAnswerInput = z.infer<typeof ragAnswerSchema>;
export type LangGraphAnswerInput = z.infer<typeof langGraphAnswerSchema>;
export type TraceLookupInput = z.infer<typeof traceLookupSchema>;
export type DocumentLookupInput = z.infer<typeof documentLookupSchema>;
