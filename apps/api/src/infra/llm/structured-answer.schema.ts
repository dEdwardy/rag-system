import { z } from "zod";

const positiveCitationSchema = z
  .union([z.number().int(), z.string().regex(/^\d+$/)])
  .transform(value => (typeof value === "number" ? value : Number.parseInt(value, 10)))
  .refine(value => value > 0, {
    message: "citation indexes must be positive integers"
  });

const citationEvidenceItemSchema = z.object({
  source: positiveCitationSchema,
  quote: z
    .string()
    .transform(value => value.trim())
    .refine(value => value.length > 0, {
      message: "citation quote must not be empty"
    })
});

export const structuredAnswerSchema = z.object({
  answer: z
    .string()
    .transform(value => value.trim())
    .refine(value => value.length > 0, {
      message: "answer must not be empty"
    }),
  status: z.enum(["grounded", "insufficient_context"]).optional(),
  citations: z
    .array(positiveCitationSchema)
    .optional()
    .transform(values => {
      if (!values) {
        return [];
      }

      const uniqueValues: number[] = [];
      for (const value of values) {
        if (!uniqueValues.includes(value)) {
          uniqueValues.push(value);
        }
      }
      return uniqueValues;
    }),
  citationEvidence: z
    .array(citationEvidenceItemSchema)
    .optional()
    .transform(values => {
      if (!values) {
        return [];
      }

      const uniqueValues: Array<{ source: number; quote: string }> = [];
      for (const value of values) {
        if (!uniqueValues.some(item => item.source === value.source && item.quote === value.quote)) {
          uniqueValues.push(value);
        }
      }

      return uniqueValues;
    }),
  missingInformation: z
    .array(
      z.string().transform(value => value.trim())
    )
    .optional()
    .transform(values => {
      if (!values) {
        return [];
      }

      return values.filter(value => value.length > 0);
    })
});
