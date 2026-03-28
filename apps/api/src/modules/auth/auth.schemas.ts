import { z } from "zod";

export const loginSchema = z.object({
  userId: z.string().min(1).optional()
});

export type LoginInput = z.infer<typeof loginSchema>;

const permissionActionSchema = z.enum(["read", "write"]);
const permissionResourceKindSchema = z.enum(["knowledge_base", "document", "assistant", "conversation", "trace"]);

export const permissionCheckSchema = z.object({
  action: permissionActionSchema,
  resource: z.object({
    kind: permissionResourceKindSchema,
    resourceId: z.string().min(1),
    tenantId: z.string().min(1),
    ownerId: z.string().min(1).nullable()
  })
});

export type PermissionCheckInput = z.infer<typeof permissionCheckSchema>;
