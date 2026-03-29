import { z } from "zod";
import { RESOURCE_ACCESS_ACTION_VALUES, RESOURCE_KIND_VALUES } from "@rag-system/shared";

export const loginSchema = z.object({
  userId: z.string().min(1).optional()
});

export type LoginInput = z.infer<typeof loginSchema>;

const permissionActionSchema = z.enum(RESOURCE_ACCESS_ACTION_VALUES);
const permissionResourceKindSchema = z.enum(RESOURCE_KIND_VALUES);

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
